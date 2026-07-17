import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgentRevisionSummary } from '../../../packages/shared/src/agent-output.ts';
import { buildAgentPrompt } from '../src/modules/agents/prompt-render.ts';
import {
  buildRevisionSummaryComment,
  isRevisionSummaryCommentText
} from '../src/modules/executions/revision-summary.ts';

test('parseAgentRevisionSummary parses a valid summary block', () => {
  const summary = parseAgentRevisionSummary(
    [
      '<outputs>',
      '  <revision-summary>',
      '    <summary><![CDATA[完善了方案说明。]]></summary>',
      '    <changes>',
      '      <change><![CDATA[补充执行边界。]]></change>',
      '      <change><![CDATA[增加异常处理。]]></change>',
      '    </changes>',
      '  </revision-summary>',
      '</outputs>'
    ].join('\n')
  );

  assert.deepEqual(summary, {
    summary: '完善了方案说明。',
    changes: ['补充执行边界。', '增加异常处理。']
  });
});

test('parseAgentRevisionSummary returns null when the block is absent', () => {
  assert.equal(parseAgentRevisionSummary('<outputs></outputs>'), null);
});

test('parseAgentRevisionSummary rejects invalid summary limits', () => {
  assert.throws(
    () =>
      parseAgentRevisionSummary(
        `<outputs><revision-summary><summary>${'a'.repeat(501)}</summary></revision-summary></outputs>`
      ),
    /exceeds 500 characters/u
  );

  assert.throws(
    () =>
      parseAgentRevisionSummary(
        [
          '<outputs><revision-summary><summary>summary</summary><changes>',
          ...Array.from(
            { length: 6 },
            (_, index) => `<change>change-${index}</change>`
          ),
          '</changes></revision-summary></outputs>'
        ].join('')
      ),
    /exceeds 5 changes/u
  );
});

test('buildAgentPrompt adds revision summary only for revision runs', () => {
  const config = {
    description: '',
    prompt: '根据审核意见修改',
    inputs: [],
    outputs: []
  };
  const initialPrompt = buildAgentPrompt(config);
  const revisionPrompt = buildAgentPrompt(config, {
    revisionContextXml:
      '<revision-context><mode>revision</mode><current-iteration>2</current-iteration></revision-context>'
  });

  assert.match(initialPrompt, /```xml\n<outputs>\n<\/outputs>\n```/u);
  assert.match(
    revisionPrompt,
    /```xml\n<outputs>[\s\S]*<revision-summary>[\s\S]*<\/outputs>\n```/u
  );
  assert.match(revisionPrompt, /do not merely restate the review feedback/iu);
});

test('buildRevisionSummaryComment combines semantic and deterministic facts', () => {
  const comment = buildRevisionSummaryComment({
    agentName: '需求方案设计',
    iteration: 2,
    feedbackCommentCount: 1,
    revisionSummary: {
      summary: '完善了 Agent Client 配置方案。',
      changes: ['补充无需 Client 的场景。', '明确两种模式的边界。']
    },
    actualWrites: ['更新「需求分析报告」', '状态流转至「方案评审-人」']
  });

  assert.match(comment, /^\[AI返工摘要\]\[需求方案设计\]\[第2轮\]/u);
  assert.match(comment, /本轮相比第1轮/u);
  assert.match(comment, /- 补充无需 Client 的场景。/u);
  assert.match(comment, /- 更新「需求分析报告」/u);
  assert.match(comment, /本轮处理了 1 条人工审核意见/u);
  assert.equal(isRevisionSummaryCommentText(comment), true);
});

test('buildRevisionSummaryComment falls back without blocking the run', () => {
  const comment = buildRevisionSummaryComment({
    agentName: 'Agent',
    iteration: 3,
    feedbackCommentCount: 2,
    revisionSummary: null,
    actualWrites: []
  });

  assert.match(comment, /已根据本轮审核意见完成返工/u);
  assert.match(comment, /未检测到可枚举的 ONES 写入目标/u);
});
