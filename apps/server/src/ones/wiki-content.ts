import { randomUUID } from 'node:crypto';
import type { OnesOpenApiWikiPage } from './open-api/types.js';

export const SUPPORTED_WIKI_PAGE_TYPES = new Set(['default', 'collaboration']);

function renderTextSegments(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((segment) => {
      if (!segment || typeof segment !== 'object') {
        return '';
      }

      const insert = (segment as { insert?: unknown }).insert;
      return typeof insert === 'string' ? insert : '';
    })
    .join('');
}

function collaborationContentToMarkdown(content: string): string {
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    throw new Error('Invalid collaboration Wiki page content');
  }

  const blocks =
    document && typeof document === 'object'
      ? (document as { blocks?: unknown }).blocks
      : null;

  if (!Array.isArray(blocks)) {
    throw new Error('Invalid collaboration Wiki document structure');
  }

  return blocks
    .flatMap((block): string[] => {
      if (!block || typeof block !== 'object') {
        return [];
      }

      const record = block as Record<string, unknown>;
      if (record.type !== 'text') {
        return [];
      }

      const text = renderTextSegments(record.text).trimEnd();
      const heading =
        typeof record.heading === 'number' &&
        record.heading >= 1 &&
        record.heading <= 6
          ? record.heading
          : 0;

      return [heading > 0 ? `${'#'.repeat(heading)} ${text}` : text];
    })
    .join('\n\n')
    .trim();
}

export function wikiPageContentToMarkdown(page: OnesOpenApiWikiPage): string {
  if (!SUPPORTED_WIKI_PAGE_TYPES.has(page.refType)) {
    throw new Error(`Unsupported Wiki page type: ${page.refType}`);
  }

  const content = page.content ?? '';
  return page.refType === 'collaboration'
    ? collaborationContentToMarkdown(content)
    : content.trim();
}

function createBlockID(): string {
  return randomUUID().replace(/-/gu, '').slice(0, 12);
}

export function markdownToCollaborationContent(markdown: string): string {
  const blocks = markdown
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map((line) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/u);
      const text = headingMatch ? (headingMatch[2] ?? '') : line;

      return {
        id: createBlockID(),
        type: 'text',
        text: text ? [{ insert: text }] : [],
        ...(headingMatch ? { heading: headingMatch[1]?.length ?? 1 } : {})
      };
    });

  if (blocks.length === 0) {
    blocks.push({ id: createBlockID(), type: 'text', text: [] });
  }

  return JSON.stringify({ blocks });
}

export function appendWikiMarkdown(current: string, addition: string): string {
  const normalizedCurrent = current.trim();
  const normalizedAddition = addition.trim();

  if (!normalizedCurrent) {
    return normalizedAddition;
  }

  if (!normalizedAddition) {
    return normalizedCurrent;
  }

  return `${normalizedCurrent}\n\n${normalizedAddition}`;
}
