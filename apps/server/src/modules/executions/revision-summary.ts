import type { ParsedAgentRevisionSummary } from '@ones-ai-workflow/shared';

const MAX_COMMENT_BYTES = 8 * 1024;
const MAX_ACTUAL_WRITE_COUNT = 8;
const TRUNCATION_SUFFIX = '\n\n[内容已截断，完整信息见执行记录。]';

function normalizeLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function sanitizeHeaderPart(value: string, fallback: string): string {
  return (
    normalizeLine(value).replaceAll('[', '(').replaceAll(']', ')') || fallback
  );
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (utf8ByteLength(value) <= maxBytes) {
    return value;
  }

  const contentBudget = Math.max(
    0,
    maxBytes - utf8ByteLength(TRUNCATION_SUFFIX)
  );
  let result = '';

  for (const character of value) {
    if (utf8ByteLength(result + character) > contentBudget) {
      break;
    }
    result += character;
  }

  return `${result.trimEnd()}${TRUNCATION_SUFFIX}`;
}

export function isRevisionSummaryCommentText(value: string): boolean {
  return /^\[AI返工摘要\]/u.test(value.trim());
}

export function buildRevisionSummaryComment(input: {
  agentName: string;
  iteration: number;
  feedbackCommentCount: number;
  revisionSummary: ParsedAgentRevisionSummary | null;
  actualWrites: string[];
}): string {
  const agentName = sanitizeHeaderPart(input.agentName, 'Agent');
  const iteration = Math.max(2, Math.trunc(input.iteration) || 2);
  const feedbackCommentCount = Math.max(
    0,
    Math.trunc(input.feedbackCommentCount) || 0
  );
  const summary = normalizeLine(
    input.revisionSummary?.summary || '已根据本轮审核意见完成返工。'
  );
  const changes = (input.revisionSummary?.changes ?? [])
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 5);
  const actualWrites = Array.from(
    new Set(input.actualWrites.map(normalizeLine).filter(Boolean))
  ).slice(0, MAX_ACTUAL_WRITE_COUNT);
  const lines = [
    `[AI返工摘要][${agentName}][第${iteration}轮]`,
    '',
    `本轮相比第${iteration - 1}轮：`,
    summary,
    ...changes.map((change) => `- ${change}`),
    '',
    '实际写入：',
    ...(actualWrites.length > 0
      ? actualWrites.map((write) => `- ${write}`)
      : ['- 未检测到可枚举的 ONES 写入目标，完整结果见执行记录。']),
    '',
    `本轮处理了 ${feedbackCommentCount} 条人工审核意见。`
  ];

  return truncateUtf8(lines.join('\n'), MAX_COMMENT_BYTES);
}
