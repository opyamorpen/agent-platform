import type { AgentInput, KnowledgeSource } from '@ones-ai-workflow/shared';
import { getIssueFieldValues } from '../../ones/issue.js';
import type { OnesOpenApiContext } from '../../ones/context.js';
import { createOnesOpenApiClient } from '../../ones/index.js';
import { wikiPageContentToMarkdown } from '../../ones/wiki-content.js';
import {
  findKnowledgeSourcesByUUIDs,
  updateKnowledgeSourceQueryState
} from '../knowledge-sources/repository.js';

const MAX_WIKI_INPUT_PAGES = 5;
const MAX_WIKI_INPUT_BYTES = 256 * 1024;

export interface WikiInputPageSnapshot {
  uuid: string;
  title: string;
  spaceUUID: string;
  updatedTime: number;
  refType: string;
}

export interface AgentWikiRuntimeContext {
  wikiInputsXml: string;
  knowledgeContextXml: string;
  inputPages: WikiInputPageSnapshot[];
  knowledgeSources: Array<
    Pick<KnowledgeSource, 'uuid' | 'spaceUUID' | 'homePageUUID'>
  >;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function toWikiRefs(value: unknown): Array<{ uuid: string; name: string }> {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Record<string, unknown>;
    const uuid =
      typeof record.uuid === 'string'
        ? record.uuid
        : typeof record.id === 'string'
          ? record.id
          : '';
    const name =
      typeof record.name === 'string'
        ? record.name
        : typeof record.title === 'string'
          ? record.title
          : uuid;

    return uuid ? [{ uuid, name }] : [];
  });
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const result: R[] = new Array(values.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        result[index] = await mapper(values[index] as T);
      }
    })
  );

  return result;
}

export async function buildAgentWikiRuntimeContext(input: {
  issueUUID: string;
  issueName: string;
  taskPrompt: string;
  inputSummary: string;
  inputs: AgentInput[];
  knowledgeSourceUUIDs: string[];
  onesContext: OnesOpenApiContext;
}): Promise<AgentWikiRuntimeContext> {
  const wikiInputs = input.inputs.filter((field) => field.kind === 'wiki_page');
  const client = await createOnesOpenApiClient(input.onesContext);
  const fieldValues =
    wikiInputs.length === 0
      ? {}
      : await getIssueFieldValues(
          input.issueUUID,
          wikiInputs.map((field) => ({
            uuid: field.field.uuid,
            alias: field.field.uuid,
            valueType: field.field.valueType,
            referenceObjectType: field.field.referenceObjectType
          })),
          input.onesContext
        );

  if (wikiInputs.length > 0 && !fieldValues) {
    throw new Error(
      `ONES issue not found when loading Wiki inputs: ${input.issueUUID}`
    );
  }

  const pageRefs = Array.from(
    new Map(
      wikiInputs
        .flatMap((field) => toWikiRefs(fieldValues?.[field.field.uuid]))
        .map((page) => [page.uuid, page] as const)
    ).values()
  );

  if (pageRefs.length > MAX_WIKI_INPUT_PAGES) {
    throw new Error(`Wiki input exceeds ${MAX_WIKI_INPUT_PAGES} pages`);
  }

  const pages = await Promise.all(
    pageRefs.map(async (pageRef) => {
      const page = await client.getWikiPage(pageRef.uuid);
      const markdown = wikiPageContentToMarkdown(page);
      return { page, markdown };
    })
  );
  const totalBytes = pages.reduce(
    (total, page) => total + Buffer.byteLength(page.markdown, 'utf8'),
    0
  );

  if (totalBytes > MAX_WIKI_INPUT_BYTES) {
    throw new Error('Wiki input content exceeds 256 KB');
  }

  const wikiInputsXml =
    pages.length === 0
      ? '<wiki-inputs />'
      : [
          '<wiki-inputs>',
          ...pages.flatMap(({ page, markdown }) => [
            `  <page uuid="${escapeXml(page.id)}" title="${escapeXml(page.title)}" space-uuid="${escapeXml(page.spaceID)}" updated-time="${page.updatedTime}" ref-type="${escapeXml(page.refType)}">`,
            `    <content>${cdata(markdown)}</content>`,
            '  </page>'
          ]),
          '</wiki-inputs>'
        ].join('\n');

  const knowledgeSources = (
    await findKnowledgeSourcesByUUIDs(
      input.knowledgeSourceUUIDs,
      input.onesContext.teamUUID
    )
  ).filter((source) => source.status === 'active');
  const query = [
    input.taskPrompt.trim(),
    `工作项：${input.issueName}`,
    input.inputSummary.trim() ? `输入摘要：${input.inputSummary.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const answers = await mapWithConcurrency(
    knowledgeSources,
    2,
    async (source) => {
      try {
        const answer = await client.askWiki({
          scopeType: 'space',
          scopeID: source.spaceUUID,
          query,
          language: 'Chinese',
          expandQuery: true,
          enableCache: true
        });
        await updateKnowledgeSourceQueryState(
          source.uuid,
          input.onesContext.teamUUID,
          { success: true }
        );
        const references = answer.references.filter(
          (reference) => reference.contentType === 'page'
        );
        return references.length === 0
          ? null
          : { source, content: answer.content, references };
      } catch (error) {
        await updateKnowledgeSourceQueryState(
          source.uuid,
          input.onesContext.teamUUID,
          {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        );
        throw error;
      }
    }
  );
  const matchedAnswers = answers.filter(
    (answer): answer is NonNullable<typeof answer> => Boolean(answer)
  );
  const knowledgeContextXml =
    matchedAnswers.length === 0
      ? '<knowledge-context />'
      : [
          '<knowledge-context>',
          ...matchedAnswers.flatMap((answer) => [
            `  <knowledge-source uuid="${escapeXml(answer.source.uuid)}" space-uuid="${escapeXml(answer.source.spaceUUID)}" name="${escapeXml(answer.source.name)}">`,
            `    <answer>${cdata(answer.content)}</answer>`,
            '    <references>',
            ...answer.references.map(
              (reference) =>
                `      <page uuid="${escapeXml(reference.itemID)}" />`
            ),
            '    </references>',
            '  </knowledge-source>'
          ]),
          '</knowledge-context>'
        ].join('\n');

  return {
    wikiInputsXml,
    knowledgeContextXml,
    inputPages: pages.map(({ page }) => ({
      uuid: page.id,
      title: page.title,
      spaceUUID: page.spaceID,
      updatedTime: page.updatedTime,
      refType: page.refType
    })),
    knowledgeSources: knowledgeSources.map((source) => ({
      uuid: source.uuid,
      spaceUUID: source.spaceUUID,
      homePageUUID: source.homePageUUID
    }))
  };
}
