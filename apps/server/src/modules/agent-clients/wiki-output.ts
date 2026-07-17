import type {
  AgentWikiPageOutputField,
  ParsedAgentWikiPageOutput
} from '@ones-ai-workflow/shared';
import type { OnesOpenApiContext } from '../../ones/context.js';
import { createOnesOpenApiClient } from '../../ones/index.js';
import {
  appendWikiMarkdown,
  markdownToCollaborationContent,
  SUPPORTED_WIKI_PAGE_TYPES,
  wikiPageContentToMarkdown
} from '../../ones/wiki-content.js';
import type { OnesOpenApiWikiPage } from '../../ones/open-api/types.js';
import { findKnowledgeSourcesByUUIDs } from '../knowledge-sources/repository.js';
import type { WikiInputPageSnapshot } from './wiki-context.js';

const MAX_WIKI_OUTPUT_BYTES = 256 * 1024;
type WikiOutputFieldValueType =
  | 'single_reference_object'
  | 'multi_reference_object';

export interface WikiWritePlan {
  outputFieldUUIDPath: string;
  outputFieldUUID: string;
  outputFieldValueType: WikiOutputFieldValueType;
  action: 'create' | 'replace' | 'append';
  pageUUID: string | null;
  parentPageUUID: string | null;
  title: string | null;
  markdown: string;
  expectedUpdatedTime: number | null;
}

export interface AppliedWikiWrite {
  log: string;
  pageUUID: string;
  pageTitle: string;
}

type WikiExecutionContext = {
  inputPages: WikiInputPageSnapshot[];
  revisionPages: Array<WikiInputPageSnapshot & { fieldUUID: string }>;
};

function parseExecutionContext(value: unknown): WikiExecutionContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { inputPages: [], revisionPages: [] };
  }

  const wikiContext = (value as { wikiContext?: unknown }).wikiContext;
  if (
    !wikiContext ||
    typeof wikiContext !== 'object' ||
    Array.isArray(wikiContext)
  ) {
    return { inputPages: [], revisionPages: [] };
  }

  const inputPages = (wikiContext as { inputPages?: unknown }).inputPages;
  const revisionContext = (value as { revisionContext?: unknown })
    .revisionContext;
  const revisionPages =
    revisionContext &&
    typeof revisionContext === 'object' &&
    !Array.isArray(revisionContext) &&
    Array.isArray(
      (revisionContext as { currentWikiPages?: unknown }).currentWikiPages
    )
      ? (revisionContext as { currentWikiPages: unknown[] }).currentWikiPages
      : [];

  return {
    inputPages: (Array.isArray(inputPages) ? inputPages : []).flatMap(
      (item): WikiInputPageSnapshot[] => {
        if (!item || typeof item !== 'object') {
          return [];
        }
        const page = item as Record<string, unknown>;
        if (
          typeof page.uuid !== 'string' ||
          typeof page.title !== 'string' ||
          typeof page.spaceUUID !== 'string' ||
          typeof page.updatedTime !== 'number' ||
          typeof page.refType !== 'string'
        ) {
          return [];
        }
        return [page as unknown as WikiInputPageSnapshot];
      }
    ),
    revisionPages: revisionPages.flatMap(
      (item): Array<WikiInputPageSnapshot & { fieldUUID: string }> => {
        if (!item || typeof item !== 'object') {
          return [];
        }
        const page = item as Record<string, unknown>;
        if (
          typeof page.fieldUUID !== 'string' ||
          typeof page.uuid !== 'string' ||
          typeof page.title !== 'string' ||
          typeof page.spaceUUID !== 'string' ||
          typeof page.updatedTime !== 'number' ||
          typeof page.refType !== 'string'
        ) {
          return [];
        }
        return [
          page as unknown as WikiInputPageSnapshot & { fieldUUID: string }
        ];
      }
    )
  };
}

function assertWritablePage(page: OnesOpenApiWikiPage): void {
  if (!SUPPORTED_WIKI_PAGE_TYPES.has(page.refType)) {
    throw new Error(`Unsupported Wiki page type: ${page.refType}`);
  }
  if (!page.canEdit) {
    throw new Error(`Wiki page is not editable: ${page.id}`);
  }
  if (page.locked) {
    throw new Error(`Wiki page is locked: ${page.id}`);
  }
  if (page.isArchived) {
    throw new Error(`Wiki page is archived: ${page.id}`);
  }
}

function resolveByName(
  name: string,
  candidates: OnesOpenApiWikiPage[]
): OnesOpenApiWikiPage {
  const matches = candidates.filter((page) => page.title === name);
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Wiki page name did not match: ${name}`
        : `Wiki page name is ambiguous: ${name}`
    );
  }
  return matches[0] as OnesOpenApiWikiPage;
}

export async function buildWikiWritePlan(input: {
  output: ParsedAgentWikiPageOutput;
  field: AgentWikiPageOutputField;
  executeOption: unknown;
  knowledgeSourceUUIDs: string[];
  onesContext: OnesOpenApiContext;
}): Promise<WikiWritePlan> {
  if (
    Buffer.byteLength(input.output.markdown, 'utf8') > MAX_WIKI_OUTPUT_BYTES
  ) {
    throw new Error('Wiki output content exceeds 256 KB');
  }

  if (
    input.field.field.valueType !== 'single_reference_object' &&
    input.field.field.valueType !== 'multi_reference_object'
  ) {
    throw new Error('Wiki output field must be a reference field');
  }

  const executionContext = parseExecutionContext(input.executeOption);
  const inputPageUUIDs = new Set(
    executionContext.inputPages.map((page) => page.uuid)
  );
  const revisionPages = executionContext.revisionPages.filter(
    (page) => page.fieldUUID === input.field.field.uuid
  );
  const revisionPageUUIDs = new Set(revisionPages.map((page) => page.uuid));
  if (input.output.action === 'create' && revisionPages.length > 0) {
    throw new Error(
      'Revision Wiki output must replace or append the existing page instead of creating a duplicate'
    );
  }
  const client = await createOnesOpenApiClient(input.onesContext);
  const sources = input.field.writeTarget
    ? []
    : await findKnowledgeSourcesByUUIDs(
        input.knowledgeSourceUUIDs,
        input.onesContext.teamUUID
      );
  const activeSources = sources.filter((source) => source.status === 'active');
  const knowledgePages = (
    await Promise.all(
      activeSources.map((source) => client.listWikiPages(source.spaceUUID))
    )
  ).flat();
  const writeTargetPages =
    input.field.writeTarget && input.output.action !== 'create'
      ? await client.listWikiPages(input.field.writeTarget.spaceUUID)
      : [];
  const inputPages = await Promise.all(
    executionContext.inputPages.map((page) => client.getWikiPage(page.uuid))
  );
  const existingRevisionPages = await Promise.all(
    revisionPages.map((page) => client.getWikiPage(page.uuid))
  );
  const candidates = Array.from(
    new Map(
      [
        ...inputPages,
        ...existingRevisionPages,
        ...knowledgePages,
        ...writeTargetPages
      ].map((page) => [page.id, page] as const)
    ).values()
  );

  if (input.output.action === 'create') {
    let parentPageUUID = input.field.writeTarget?.homePageUUID ?? null;
    if (input.field.writeTarget) {
      const parent = await client.getWikiPage(parentPageUUID as string);
      if (parent.spaceID !== input.field.writeTarget.spaceUUID) {
        throw new Error(
          'Configured Wiki write target home page does not belong to its space'
        );
      }
      assertWritablePage(parent);
    } else if (input.output.parentPageUUID) {
      parentPageUUID = input.output.parentPageUUID;
      const parent = candidates.find((page) => page.id === parentPageUUID);
      if (!parent) {
        throw new Error(
          'Wiki create parent must be an input page or belong to a bound knowledge source'
        );
      }
      assertWritablePage(await client.getWikiPage(parent.id));
    } else if (input.output.spaceUUID) {
      const source = activeSources.find(
        (item) => item.spaceUUID === input.output.spaceUUID
      );
      if (!source) {
        throw new Error(
          'Wiki create space must be a bound active knowledge source'
        );
      }
      parentPageUUID = source.homePageUUID;
      assertWritablePage(await client.getWikiPage(parentPageUUID));
    }

    if (!parentPageUUID) {
      throw new Error('Wiki create action has no valid parent page');
    }

    return {
      outputFieldUUIDPath: input.output.fieldUUIDPath,
      outputFieldUUID: input.field.field.uuid,
      outputFieldValueType: input.field.field.valueType,
      action: 'create',
      pageUUID: null,
      parentPageUUID,
      title: input.output.title,
      markdown: input.output.markdown,
      expectedUpdatedTime: null
    };
  }

  const target = input.output.targetPageUUID
    ? candidates.find((page) => page.id === input.output.targetPageUUID)
    : input.output.targetPageName
      ? resolveByName(input.output.targetPageName, candidates)
      : null;
  if (!target) {
    throw new Error(
      input.field.writeTarget
        ? 'Wiki output target is outside the allowed input/write-target scope'
        : 'Wiki output target is outside the allowed input/knowledge scope'
    );
  }
  if (
    input.output.action === 'replace' &&
    !inputPageUUIDs.has(target.id) &&
    !revisionPageUUIDs.has(target.id)
  ) {
    throw new Error(
      'Wiki replace is only allowed for a page read in this execution or created by an earlier revision round'
    );
  }

  const current = await client.getWikiPage(target.id);
  assertWritablePage(current);
  const snapshot =
    executionContext.inputPages.find((page) => page.uuid === target.id) ??
    revisionPages.find((page) => page.uuid === target.id);
  if (
    input.output.action === 'replace' &&
    (!snapshot || snapshot.updatedTime !== current.updatedTime)
  ) {
    throw new Error('Wiki page changed after it was read; replace was blocked');
  }

  return {
    outputFieldUUIDPath: input.output.fieldUUIDPath,
    outputFieldUUID: input.field.field.uuid,
    outputFieldValueType: input.field.field.valueType,
    action: input.output.action,
    pageUUID: current.id,
    parentPageUUID: null,
    title: input.output.title,
    markdown: input.output.markdown,
    expectedUpdatedTime:
      input.output.action === 'replace' ? current.updatedTime : null
  };
}

export async function applyWikiWritePlan(
  plan: WikiWritePlan,
  onesContext: OnesOpenApiContext
): Promise<AppliedWikiWrite> {
  const client = await createOnesOpenApiClient(onesContext);

  if (plan.action === 'create') {
    const page = await client.createWikiPage({
      parentPageID: plan.parentPageUUID as string,
      title: plan.title as string,
      content: markdownToCollaborationContent(plan.markdown)
    });
    return {
      log: `[system] created Wiki page ${page.id} for output ${plan.outputFieldUUIDPath}`,
      pageUUID: page.id,
      pageTitle: page.title
    };
  }

  const page = await client.getWikiPage(plan.pageUUID as string);
  assertWritablePage(page);
  if (
    plan.action === 'replace' &&
    page.updatedTime !== plan.expectedUpdatedTime
  ) {
    throw new Error('Wiki page changed before write; replace was blocked');
  }

  const markdown =
    plan.action === 'append'
      ? appendWikiMarkdown(wikiPageContentToMarkdown(page), plan.markdown)
      : plan.markdown;
  const content =
    page.refType === 'collaboration'
      ? markdownToCollaborationContent(markdown)
      : markdown;

  await client.updateWikiPage(page.id, {
    ...(plan.title ? { title: plan.title } : {}),
    content
  });
  return {
    log: `[system] ${plan.action}ed Wiki page ${page.id} for output ${plan.outputFieldUUIDPath}`,
    pageUUID: page.id,
    pageTitle: plan.title ?? page.title
  };
}
