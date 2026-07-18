import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import {
  type AgentTokenUsage,
  parseAttachmentOutputContent,
  type AgentClientTaskAttachmentOutput,
  type AgentClientVerificationProfileResult,
  type AgentClientWorkspacePatchUpload
} from '@ones-ai-workflow/shared';
import {
  AgentSessionExecutionError,
  createAgentSession,
  type AgentSession
} from '../agent-session/index.js';
import type { Skill } from '../skill/index.js';
import type { PrepareWorkspaceResult, Workspace } from '../workspace/index.js';
import type {
  TaskRunAttachmentUploadFile,
  TaskRunCallback,
  TaskRunDependencies,
  TaskRunInput
} from './types.js';
import {
  applyWorkspacePatchBundle,
  createWorkspacePatchBundle,
  runWorkspaceVerificationProfiles
} from './workspace-verification.js';

export interface TaskRunServiceDependencies extends TaskRunDependencies {}

const defaultDependencies: TaskRunServiceDependencies = {
  createAgentSession,
  listWorkspaceRepoNames,
  listMountedSkillNames,
  fetchTaskRuntimeEnv: async () => ({ env: {} }),
  uploadTaskAttachments: async () => ({ uploads: [] }),
  downloadPreviousWorkspacePatch: async () => {
    throw new Error('Previous workspace patch download is not configured');
  },
  uploadTaskWorkspacePatch: async () => {
    throw new Error('Workspace patch upload is not configured');
  }
};

export class TaskRun {
  protected readonly input: TaskRunInput;
  protected readonly workspace: Workspace;
  protected readonly skill: Skill;
  protected agentSession: AgentSession | null = null;
  protected readonly dependencies: TaskRunServiceDependencies;

  constructor(
    input: TaskRunInput,
    workspace: Workspace,
    skill: Skill,
    dependencies?: Partial<TaskRunServiceDependencies>
  ) {
    this.input = input;
    this.workspace = workspace;
    this.skill = skill;
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  start(callback: TaskRunCallback) {
    void this.run(callback);
  }

  abort(): Promise<void> {
    return Promise.resolve(this.agentSession?.abort());
  }

  private async run(callback: TaskRunCallback): Promise<void> {
    let result: string | null = null;
    let attachmentUploads: AgentClientTaskAttachmentOutput[] | undefined;
    let taskError: Error | null = null;
    let usage: AgentTokenUsage | null = null;
    let preparedWorkspace: PrepareWorkspaceResult | null = null;
    let runtimeEnv: Record<string, string> = {};
    let agentExecutionStarted = false;
    let verificationResults:
      | AgentClientVerificationProfileResult[]
      | undefined;
    let workspacePatch: AgentClientWorkspacePatchUpload | undefined;

    try {
      callback.onProgress({
        logs: `[task-run] task uuid: ${this.input.taskUUID}`
      });

      callback.onProgress({
        logs: '[task-run] preparing workspace'
      });

      const workspace = await this.workspace.prepareWorkspace({
        taskUUID: this.input.taskUUID,
        sourceWorkspaceUUID: this.input.sourceWorkspaceUUID
      });
      preparedWorkspace = workspace;
      const repoNames = await this.dependencies.listWorkspaceRepoNames(
        workspace.workspaceRoot
      );

      callback.onProgress({
        logs: `[task-run] workspace repos: ${formatNameList(repoNames)}`
      });

      if (this.input.previousWorkspacePatch) {
        callback.onProgress({
          logs: `[task-run] applying previous workspace patch from ${this.input.previousWorkspacePatch.sourceTaskUUID}`
        });
        const patchBytes = await this.dependencies.downloadPreviousWorkspacePatch(
          this.input.previousWorkspacePatch
        );
        await applyWorkspacePatchBundle({
          bytes: patchBytes,
          expectedSha256: this.input.previousWorkspacePatch.sha256,
          repositories: workspace.repos ?? [],
          gitEnv: workspace.gitEnv
        });
      }

      callback.onProgress({
        logs: '[task-run] mounting skills'
      });

      await this.skill.mountSkills({
        taskUUID: this.input.taskUUID,
        skillUUIDs: this.input.skillUUIDs
      });
      const skillNames = await this.dependencies.listMountedSkillNames(
        workspace.workspaceRoot
      );

      callback.onProgress({
        logs: `[task-run] mounted skills: ${formatNameList(skillNames)}`
      });

      const runtimeEnvResponse = await this.dependencies.fetchTaskRuntimeEnv(
        this.input.taskUUID
      );
      runtimeEnv = normalizeStringRecord(runtimeEnvResponse.env);
      const runtimeEnvKeys = Object.keys(runtimeEnv).sort((left, right) =>
        left.localeCompare(right)
      );

      callback.onProgress({
        logs: `[task-run] injected workspace secrets: ${formatNameList(runtimeEnvKeys)}`
      });

      callback.onProgress({
        logs: '[task-run] executing agent session'
      });

      this.agentSession = this.dependencies.createAgentSession({
        workspaceRoot: workspace.workspaceRoot,
        prompt: this.input.prompt,
        env: {
          ...normalizeStringRecord(workspace.gitEnv),
          ...runtimeEnv
        },
        codexHomePath: this.input.codexHomePath,
        codexApiKey: this.input.codexApiKey,
        codexBaseUrl: this.input.codexBaseUrl,
        hermesExecutablePath: this.input.hermesExecutablePath,
        hermesProfile: this.input.hermesProfile,
        hermesProvider: this.input.hermesProvider,
        hermesToolsets: this.input.hermesToolsets,
        model: this.input.model,
        modelReasoningEffort: this.input.modelReasoningEffort
      }, this.input.executeAgentType) as AgentSession;

      agentExecutionStarted = true;
      const execution = await this.agentSession.execute(callback.onProgress);
      result = execution.result;
      usage = execution.usage;

      attachmentUploads = await this.collectAttachmentUploads(
        workspace.workspaceRoot,
        execution.result,
        callback
      );
    } catch (error) {
      taskError = toError(error);
      usage = extractUsage(error);
    }

    if (preparedWorkspace && agentExecutionStarted) {
      try {
        if (!taskError && (this.input.verificationProfiles?.length ?? 0) > 0) {
          callback.onProgress({
            logs: '[task-run] running workspace verification'
          });
          verificationResults = await runWorkspaceVerificationProfiles({
            profiles: this.input.verificationProfiles ?? [],
            repositories: preparedWorkspace.repos ?? [],
            env: {
              ...normalizeStringRecord(preparedWorkspace.gitEnv),
              ...runtimeEnv
            },
            onLog: (logs) => callback.onProgress({ logs })
          });
        }

        const shouldCaptureWorkspacePatch =
          (this.input.verificationProfiles?.length ?? 0) > 0 ||
          Boolean(this.input.previousWorkspacePatch);
        if (
          shouldCaptureWorkspacePatch &&
          (preparedWorkspace.repos?.length ?? 0) > 0
        ) {
          callback.onProgress({
            logs: '[task-run] generating workspace patch'
          });
          const patchBundle = await createWorkspacePatchBundle({
            taskUUID: this.input.taskUUID,
            repositories: preparedWorkspace.repos ?? [],
            gitEnv: preparedWorkspace.gitEnv
          });
          if (patchBundle.bundle.repositories.length > 0) {
            workspacePatch = (
              await this.dependencies.uploadTaskWorkspacePatch(
                this.input.taskUUID,
                patchBundle.bytes
              )
            ).patch;
            callback.onProgress({
              logs: `[task-run] uploaded workspace patch: ${workspacePatch.changedFiles} file(s), +${workspacePatch.additions}/-${workspacePatch.deletions}`
            });
          } else {
            callback.onProgress({
              logs: '[task-run] workspace patch: no code changes'
            });
          }
        }
      } catch (error) {
        taskError = mergePostExecutionError(taskError, error);
      }
    }

    callback.onProgress({
      logs: '[task-run] cleaning up workspace'
    });

    try {
      await this.workspace.cleanupTaskWorkspace(this.input.taskUUID);
    } catch (error) {
      taskError = mergeCleanupError(taskError, error);
    }

    if (taskError) {
      callback.onError(taskError, usage, verificationResults, workspacePatch);
      return;
    }

    callback.onFinish(
      result ?? '',
      attachmentUploads,
      usage,
      verificationResults,
      workspacePatch
    );
  }

  private async collectAttachmentUploads(
    workspaceRoot: string,
    executeResult: string,
    callback: TaskRunCallback
  ): Promise<AgentClientTaskAttachmentOutput[] | undefined> {
    const attachmentOutputPaths = normalizeStringArray(
      this.input.executeOption?.attachmentOutputPaths
    );

    callback.onProgress({
      logs: `[task-run] attachment output paths: ${formatNameList(attachmentOutputPaths)}`
    });

    if (attachmentOutputPaths.length === 0) {
      return undefined;
    }

    const uploadsByOutput: AgentClientTaskAttachmentOutput[] = [];
    const outputMap = extractTopLevelAttachmentOutputPaths(executeResult);

    for (const outputPath of attachmentOutputPaths) {
      const relativePaths = outputMap.get(outputPath) ?? [];

      if (relativePaths.length === 0) {
        continue;
      }

      callback.onProgress({
        logs: `[task-run] uploading ${relativePaths.length} attachment(s) for output "${outputPath}"`
      });

      const files = await Promise.all(
        relativePaths.map((relativePath: string) =>
          this.readAttachmentFile(workspaceRoot, relativePath)
        )
      );
      const response = await this.dependencies.uploadTaskAttachments(
        this.input.taskUUID,
        files
      );

      uploadsByOutput.push({
        outputName: outputPath,
        uploads: response.uploads
      });
    }

    return uploadsByOutput.length > 0 ? uploadsByOutput : undefined;
  }

  private async readAttachmentFile(
    workspaceRoot: string,
    relativePath: string
  ): Promise<TaskRunAttachmentUploadFile> {
    const normalizedPath = relativePath.trim();

    if (!normalizedPath) {
      throw new Error('Attachment path cannot be empty');
    }

    if (path.isAbsolute(normalizedPath)) {
      throw new Error(`Attachment path must be relative: ${relativePath}`);
    }

    const resolvedPath = path.resolve(workspaceRoot, normalizedPath);
    const relativeToWorkspace = path.relative(workspaceRoot, resolvedPath);

    if (
      relativeToWorkspace.startsWith('..') ||
      path.isAbsolute(relativeToWorkspace)
    ) {
      throw new Error(`Attachment path is outside workspace: ${relativePath}`);
    }

    const bytes = new Uint8Array(await readFile(resolvedPath));

    return {
      localPath: normalizedPath,
      fileName: path.basename(normalizedPath),
      bytes
    };
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function extractUsage(error: unknown): AgentTokenUsage | null {
  return error instanceof AgentSessionExecutionError ? error.usage : null;
}

function mergeCleanupError(
  taskError: Error | null,
  cleanupError: unknown
): Error {
  const normalizedCleanupError = toError(cleanupError);
  const cleanupMessage = `[task-run] cleanup failed: ${normalizedCleanupError.message}`;

  if (!taskError) {
    return new Error(cleanupMessage, {
      cause: normalizedCleanupError
    });
  }

  return new Error(`${taskError.message}\n${cleanupMessage}`, {
    cause: normalizedCleanupError
  });
}

function mergePostExecutionError(
  taskError: Error | null,
  error: unknown
): Error {
  const normalizedError = toError(error);
  const message = `[task-run] workspace verification or patch failed: ${normalizedError.message}`;
  return taskError
    ? new Error(`${taskError.message}\n${message}`, { cause: normalizedError })
    : new Error(message, { cause: normalizedError });
}

async function listWorkspaceRepoNames(workspaceRoot: string): Promise<string[]> {
  const entries = await readdir(workspaceRoot, {
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== '.agents')
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function listMountedSkillNames(workspaceRoot: string): Promise<string[]> {
  const skillsRoot = path.join(workspaceRoot, '.agents', 'skills');

  try {
    const entries = await readdir(skillsRoot, {
      withFileTypes: true
    });

    return entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function formatNameList(names: string[]): string {
  return names.length > 0 ? names.join(', ') : '(none)';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseXmlTagContent(source: string, tagName: string): string | null {
  const match = source.match(
    new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`)
  );

  return match ? match[1].trim() : null;
}

function unwrapCdataIfPresent(value: string): string {
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? (cdataMatch[1] ?? '') : value;
}

function extractDirectChildTagContents(source: string, tagName: string): string[] {
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;
  const blocks: string[] = [];
  let searchIndex = 0;

  while (true) {
    const startIndex = source.indexOf(openTag, searchIndex);

    if (startIndex < 0) {
      return blocks;
    }

    let depth = 1;
    let cursor = startIndex + openTag.length;

    while (depth > 0) {
      const nextOpenIndex = source.indexOf(openTag, cursor);
      const nextCloseIndex = source.indexOf(closeTag, cursor);

      if (nextCloseIndex < 0) {
        return blocks;
      }

      if (nextOpenIndex >= 0 && nextOpenIndex < nextCloseIndex) {
        depth += 1;
        cursor = nextOpenIndex + openTag.length;
        continue;
      }

      depth -= 1;

      if (depth === 0) {
        blocks.push(source.slice(startIndex + openTag.length, nextCloseIndex));
        searchIndex = nextCloseIndex + closeTag.length;
        break;
      }

      cursor = nextCloseIndex + closeTag.length;
    }
  }
}

function extractFirstTagContent(source: string, tagName: string): string | null {
  return extractDirectChildTagContents(source, tagName)[0]?.trim() ?? null;
}

function appendAttachmentOutputPaths(
  outputMap: Map<string, string[]>,
  outputName: string,
  relativePaths: string[]
) {
  if (relativePaths.length === 0) {
    return;
  }

  const existingPaths = outputMap.get(outputName) ?? [];
  outputMap.set(outputName, [...existingPaths, ...relativePaths]);
}

function extractAttachmentLocalPathsFromObjects(objectsContent: string): string[] {
  return extractDirectChildTagContents(objectsContent, 'object').flatMap((objectBlock) => {
    const fieldsContent = extractFirstTagContent(objectBlock, 'fields');

    if (!fieldsContent) {
      return [];
    }

    const fieldBlocks = extractDirectChildTagContents(fieldsContent, 'field');
    const localPathField = fieldBlocks.find(
      (fieldBlock) => parseXmlTagContent(fieldBlock, 'field-uuid') === 'local_path'
    );

    if (!localPathField) {
      return [];
    }

    const setValue = parseXmlTagContent(localPathField, 'set-value');

    if (setValue === null) {
      return [];
    }

    const normalizedPath = unwrapCdataIfPresent(setValue).trim();
    return normalizedPath ? [normalizedPath] : [];
  });
}

function extractTopLevelAttachmentOutputPaths(executeResult: string): Map<string, string[]> {
  const outputsContent = extractFirstTagContent(executeResult, 'outputs');

  if (outputsContent === null) {
    return new Map();
  }

  const outputMap = new Map<string, string[]>();
  for (const outputBlock of extractDirectChildTagContents(outputsContent, 'output')) {
    const fieldUUID = parseXmlTagContent(outputBlock, 'field-uuid');

    if (!fieldUUID) {
      continue;
    }

    const objectsContent = extractFirstTagContent(outputBlock, 'objects');

    if (objectsContent !== null) {
      appendAttachmentOutputPaths(
        outputMap,
        fieldUUID,
        extractAttachmentLocalPathsFromObjects(objectsContent)
      );

      for (const objectBlock of extractDirectChildTagContents(objectsContent, 'object')) {
        const fieldsContent = extractFirstTagContent(objectBlock, 'fields');

        if (!fieldsContent) {
          continue;
        }

        const fieldBlocks = extractDirectChildTagContents(fieldsContent, 'field');

        for (const fieldBlock of fieldBlocks) {
          const childFieldUUID = parseXmlTagContent(fieldBlock, 'field-uuid');
          const childObjectsContent = extractFirstTagContent(fieldBlock, 'objects');

          if (!childFieldUUID || childObjectsContent === null) {
            continue;
          }

          appendAttachmentOutputPaths(
            outputMap,
            `${fieldUUID}.${childFieldUUID}`,
            extractAttachmentLocalPathsFromObjects(childObjectsContent)
          );
        }
      }

      continue;
    }

    const setValue = parseXmlTagContent(outputBlock, 'set-value');

    if (setValue === null) {
      continue;
    }

    outputMap.set(fieldUUID, parseAttachmentOutputContent(unwrapCdataIfPresent(setValue)));
  }

  return outputMap;
}

function normalizeStringRecord(
  value: NodeJS.ProcessEnv | Record<string, string> | undefined
): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );

  return Object.fromEntries(entries);
}
