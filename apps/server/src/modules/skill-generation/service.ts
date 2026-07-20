import { createHash, randomUUID } from 'node:crypto';
import type {
  SkillGenerationFile,
  SkillGenerationMessage,
  SkillGenerationSession,
  SkillGenerationSessionSummary,
  SkillSummary
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  deleteObject,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';
import {
  completeAIChatCompletion,
  streamAIChatCompletion,
  type AIChatMessage
} from '../ai-model/client.js';
import {
  createSkillRecord,
  getSkillSummaries,
  SkillConflictError
} from '../skills/service.js';
import type { SkillGenerationFileDTO } from './dto.js';
import {
  createSkillGenerationSessionRecord,
  deleteSkillGenerationSessionRecord,
  findSkillGenerationSessionRecord,
  listSkillGenerationSessionRecords,
  updateSkillGenerationSessionRecord,
  type SkillGenerationSessionRecord
} from './repository.js';
import { validateGeneratedSkillFiles } from './validation.js';

const MAX_MESSAGES = 50;
const MAX_MODEL_OUTPUT_BYTES = 4 * 1024 * 1024;
const activeSessions = new Set<string>();

function deterministicUUID(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

interface SkillGenerationDraftObject {
  schemaVersion: 1;
  messages: SkillGenerationMessage[];
  files: SkillGenerationFile[];
}

export class SkillGenerationSessionNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Skill generation session not found: ${uuid}`);
    this.name = 'SkillGenerationSessionNotFoundError';
  }
}

export class SkillGenerationRevisionConflictError extends Error {
  constructor() {
    super('Skill generation draft has changed; reload it before continuing');
    this.name = 'SkillGenerationRevisionConflictError';
  }
}

export class SkillGenerationBusyError extends Error {
  constructor() {
    super('This Skill generation session already has an active request');
    this.name = 'SkillGenerationBusyError';
  }
}

export class SkillGenerationScriptReviewRequiredError extends Error {
  constructor() {
    super('Generated scripts must be reviewed before publishing');
    this.name = 'SkillGenerationScriptReviewRequiredError';
  }
}

export async function createSkillGenerationSession(input: {
  teamUUID: string;
  creatorUUID: string;
  title?: string;
}): Promise<SkillGenerationSession> {
  const uuid = randomUUID();
  const draftObjectKey = buildHostedObjectKey(
    'skill-generation',
    input.teamUUID,
    uuid
  );
  const draft: SkillGenerationDraftObject = {
    schemaVersion: 1,
    messages: [],
    files: []
  };

  await uploadObjectJson(draftObjectKey, draft);
  const record = await createSkillGenerationSessionRecord({
    teamUUID: input.teamUUID,
    uuid,
    creatorUUID: input.creatorUUID,
    title: input.title?.trim() || 'Untitled Skill',
    draftObjectKey
  });
  return toSession(record, draft);
}

export async function listOwnSkillGenerationSessions(input: {
  teamUUID: string;
  creatorUUID: string;
}): Promise<SkillGenerationSessionSummary[]> {
  return listSkillGenerationSessionRecords(input);
}

export async function getOwnSkillGenerationSession(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
}): Promise<SkillGenerationSession> {
  const record = await getOwnedRecord(input);
  return toSession(record, await readDraft(record));
}

export async function deleteOwnSkillGenerationSession(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
}): Promise<void> {
  const record = await getOwnedRecord(input);
  assertNotBusy(record.uuid);
  await deleteObject(record.draftObjectKey).catch(() => undefined);
  await deleteSkillGenerationSessionRecord(record.uuid);
}

export async function updateOwnSkillGenerationDraft(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
  expectedRevision: number;
  files: SkillGenerationFileDTO[];
}): Promise<SkillGenerationSession> {
  return withSessionLock(input.uuid, async () => {
    const record = await getOwnedRecord(input);
    assertRevision(record, input.expectedRevision);
    const validated = validateGeneratedSkillFiles(input.files);
    const draft = await readDraft(record);
    draft.files = validated.files;
    await uploadObjectJson(record.draftObjectKey, draft);
    const updated = await updateSkillGenerationSessionRecord(record, {
      revision: record.revision + 1,
      status: 'ready'
    });
    return toSession(updated, draft);
  });
}

export async function streamSkillGenerationConversation(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
  message: string;
  signal: AbortSignal;
  onDelta: (delta: string) => Promise<void>;
}): Promise<SkillGenerationSession> {
  return withSessionLock(input.uuid, async () => {
    let record = await getOwnedRecord(input);
    const draft = await readDraft(record);

    if (draft.messages.length + 2 > MAX_MESSAGES) {
      throw new Error(
        `A Skill generation session supports at most ${MAX_MESSAGES} messages`
      );
    }

    const now = new Date().toISOString();
    draft.messages.push({
      uuid: randomUUID(),
      role: 'user',
      content: input.message,
      status: 'complete',
      createdAt: now
    });
    await uploadObjectJson(record.draftObjectKey, draft);
    record = await updateSkillGenerationSessionRecord(record, {
      title:
        record.title === 'Untitled Skill'
          ? input.message.slice(0, 80)
          : record.title,
      status: 'generating',
      revision: record.revision + 1
    });

    let partial = '';
    try {
      const result = await streamAIChatCompletion({
        teamUUID: input.teamUUID,
        feature: 'skill-chat',
        signal: input.signal,
        messages: buildConversationMessages(draft),
        onDelta: async (delta) => {
          partial += delta;
          await input.onDelta(delta);
        }
      });
      draft.messages.push({
        uuid: randomUUID(),
        role: 'assistant',
        content: result.content.trim(),
        status: 'complete',
        createdAt: new Date().toISOString()
      });
      await uploadObjectJson(record.draftObjectKey, draft);
      record = await updateSkillGenerationSessionRecord(record, {
        status: draft.files.length > 0 ? 'ready' : 'draft',
        revision: record.revision + 1
      });
      return toSession(record, draft);
    } catch (error) {
      if (partial.trim()) {
        draft.messages.push({
          uuid: randomUUID(),
          role: 'assistant',
          content: partial,
          status: 'interrupted',
          createdAt: new Date().toISOString()
        });
        await uploadObjectJson(record.draftObjectKey, draft).catch(
          () => undefined
        );
      }
      await updateSkillGenerationSessionRecord(record, {
        status: 'failed'
      }).catch(() => undefined);
      throw error;
    }
  });
}

export async function generateSkillDraft(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
  expectedRevision: number;
  signal: AbortSignal;
  onStage: (stage: string) => Promise<void>;
}): Promise<SkillGenerationSession> {
  return withSessionLock(input.uuid, async () => {
    let record = await getOwnedRecord(input);
    assertRevision(record, input.expectedRevision);
    const draft = await readDraft(record);

    if (
      draft.messages.filter((message) => message.role === 'user').length === 0
    ) {
      throw new Error('Describe the Skill before generating files');
    }

    record = await updateSkillGenerationSessionRecord(record, {
      status: 'generating'
    });
    await input.onStage('generating_files');

    try {
      let raw = (
        await completeAIChatCompletion({
          teamUUID: input.teamUUID,
          feature: 'skill-generation',
          signal: input.signal,
          messages: buildGenerationMessages(draft)
        })
      ).content;
      let generated: { assistantMessage: string; files: SkillGenerationFile[] };

      try {
        generated = parseGeneratedSkill(raw);
      } catch (firstError) {
        await input.onStage('repairing_structure');
        raw = (
          await completeAIChatCompletion({
            teamUUID: input.teamUUID,
            feature: 'skill-repair',
            signal: input.signal,
            temperature: 0,
            messages: [
              {
                role: 'system',
                content:
                  'Repair the supplied response into valid JSON with exactly assistantMessage and files[{path,content}]. Return JSON only.'
              },
              {
                role: 'user',
                content: `Validation error: ${firstError instanceof Error ? firstError.message : 'invalid response'}\n\nResponse:\n${raw.slice(0, 1024 * 1024)}`
              }
            ]
          })
        ).content;
        generated = parseGeneratedSkill(raw);
      }

      const validated = validateGeneratedSkillFiles(generated.files);
      const latestRecord = await getOwnedRecord(input);
      assertRevision(latestRecord, record.revision);
      record = latestRecord;
      draft.files = validated.files;
      if (draft.messages.length < MAX_MESSAGES) {
        draft.messages.push({
          uuid: randomUUID(),
          role: 'assistant',
          content:
            generated.assistantMessage.trim() || 'Skill draft generated.',
          status: 'complete',
          createdAt: new Date().toISOString()
        });
      }
      await uploadObjectJson(record.draftObjectKey, draft);
      record = await updateSkillGenerationSessionRecord(record, {
        status: 'ready',
        revision: record.revision + 1
      });
      return toSession(record, draft);
    } catch (error) {
      if (error instanceof SkillGenerationRevisionConflictError) {
        throw error;
      }
      await updateSkillGenerationSessionRecord(record, {
        status: 'failed'
      }).catch(() => undefined);
      throw error;
    }
  });
}

export async function publishGeneratedSkill(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
  expectedRevision: number;
  scriptReviewed: boolean;
}): Promise<SkillSummary> {
  return withSessionLock(input.uuid, async () => {
    let record = await getOwnedRecord(input);

    if (record.publishedSkillUUID) {
      const existing = (await getSkillSummaries(input.teamUUID)).find(
        (skill) => skill.uuid === record.publishedSkillUUID
      );
      if (existing) return existing;
    }

    assertRevision(record, input.expectedRevision);
    const draft = await readDraft(record);
    const validated = validateGeneratedSkillFiles(draft.files);
    if (validated.hasScripts && !input.scriptReviewed) {
      throw new SkillGenerationScriptReviewRequiredError();
    }

    const skillUUID = deterministicUUID(
      `skill-generation:${input.teamUUID}:${input.uuid}`
    );
    let created: SkillSummary;
    try {
      created = await createSkillRecord(
        {
          uuid: skillUUID,
          files: validated.files.map((file) => ({
            relativePath: file.path,
            file: new File([file.content], file.path, {
              type: 'text/plain;charset=utf-8'
            })
          }))
        },
        input.teamUUID
      );
    } catch (error) {
      if (!(error instanceof SkillConflictError)) throw error;
      const existing = (await getSkillSummaries(input.teamUUID)).find(
        (skill) => skill.uuid === skillUUID
      );
      if (!existing) throw error;
      created = existing;
    }
    record = await updateSkillGenerationSessionRecord(record, {
      status: 'published',
      publishedSkillUUID: created.uuid
    });
    return created;
  });
}

function buildConversationMessages(
  draft: SkillGenerationDraftObject
): AIChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are helping a user design a reusable Agent Skill. Ask concise, concrete clarification questions about the goal, trigger, inputs, workflow, constraints, tools, outputs, and acceptance criteria. Reflect confirmed decisions and point out unsafe or ambiguous requirements. Do not generate the file package in this chat; the user has a separate Generate Skill action. Never request secrets or credentials.`
    },
    ...draft.messages.map(
      (message) =>
        ({
          role: message.role,
          content: message.content
        }) satisfies AIChatMessage
    )
  ];
}

function buildGenerationMessages(
  draft: SkillGenerationDraftObject
): AIChatMessage[] {
  return [
    {
      role: 'system',
      content: `Generate a complete, reusable Agent Skill package from the conversation. Return strict JSON only with this shape: {"assistantMessage":"short summary","files":[{"path":"SKILL.md","content":"..."}]}. Include exactly one root SKILL.md with YAML frontmatter containing name and description. You may add UTF-8 documentation, configuration, and scripts when needed. Do not include binary data, base64 data, hidden files, absolute paths, path traversal, external download commands, credentials, or generated lock files. Keep scripts narrowly scoped and safe. Do not wrap JSON in Markdown fences.`
    },
    ...draft.messages.map(
      (message) =>
        ({
          role: message.role,
          content: message.content
        }) satisfies AIChatMessage
    ),
    ...(draft.files.length > 0
      ? [
          {
            role: 'user' as const,
            content: `Update the current draft as needed. Current files:\n${JSON.stringify(draft.files)}`
          }
        ]
      : [])
  ];
}

function parseGeneratedSkill(raw: string): {
  assistantMessage: string;
  files: SkillGenerationFile[];
} {
  if (Buffer.byteLength(raw, 'utf8') > MAX_MODEL_OUTPUT_BYTES) {
    throw new Error('AI-generated Skill response exceeds 4 MB');
  }

  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const value = JSON.parse(normalized) as {
    assistantMessage?: unknown;
    files?: unknown;
  };

  if (
    typeof value.assistantMessage !== 'string' ||
    !Array.isArray(value.files) ||
    !value.files.every(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as { path?: unknown }).path === 'string' &&
        typeof (file as { content?: unknown }).content === 'string'
    )
  ) {
    throw new Error(
      'AI-generated Skill does not match the required file schema'
    );
  }

  return {
    assistantMessage: value.assistantMessage,
    files: value.files as SkillGenerationFile[]
  };
}

async function getOwnedRecord(input: {
  uuid: string;
  teamUUID: string;
  creatorUUID: string;
}): Promise<SkillGenerationSessionRecord> {
  const record = await findSkillGenerationSessionRecord(input.uuid);
  if (
    !record ||
    record.teamUUID !== input.teamUUID ||
    record.creatorUUID !== input.creatorUUID
  ) {
    throw new SkillGenerationSessionNotFoundError(input.uuid);
  }
  return record;
}

async function readDraft(
  record: SkillGenerationSessionRecord
): Promise<SkillGenerationDraftObject> {
  const draft = await readObjectJson<SkillGenerationDraftObject>(
    record.draftObjectKey
  );
  if (
    !draft ||
    draft.schemaVersion !== 1 ||
    !Array.isArray(draft.messages) ||
    !Array.isArray(draft.files)
  ) {
    throw new Error('Skill generation draft is missing or invalid');
  }
  return draft;
}

function toSession(
  record: SkillGenerationSessionRecord,
  draft: SkillGenerationDraftObject
): SkillGenerationSession {
  return {
    uuid: record.uuid,
    title: record.title,
    status: record.status,
    revision: record.revision,
    publishedSkillUUID: record.publishedSkillUUID,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    messages: draft.messages,
    files: draft.files
  };
}

function assertRevision(
  record: SkillGenerationSessionRecord,
  expectedRevision: number
): void {
  if (record.revision !== expectedRevision) {
    throw new SkillGenerationRevisionConflictError();
  }
}

function assertNotBusy(uuid: string): void {
  if (activeSessions.has(uuid)) {
    throw new SkillGenerationBusyError();
  }
}

async function withSessionLock<T>(
  uuid: string,
  action: () => Promise<T>
): Promise<T> {
  assertNotBusy(uuid);
  activeSessions.add(uuid);
  try {
    return await action();
  } finally {
    activeSessions.delete(uuid);
  }
}
