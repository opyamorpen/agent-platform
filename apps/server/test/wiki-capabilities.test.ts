import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgentOutputString } from '@ones-ai-workflow/shared';
import { agentConfigSchema } from '../src/modules/agents/dto.js';
import { buildAgentPrompt } from '../src/modules/agents/prompt-render.js';
import { buildWikiWritePlan } from '../src/modules/agent-clients/wiki-output.js';
import {
  appendWikiMarkdown,
  markdownToCollaborationContent,
  wikiPageContentToMarkdown
} from '../src/ones/wiki-content.js';

const wikiOutputField = {
  kind: 'wiki_page' as const,
  mode: 'wiki_page' as const,
  field: {
    uuid: 'fieldWiki',
    name: '需求文档',
    valueType: 'multi_reference_object',
    referenceObjectType: 'wiki_page'
  },
  description: '在输入页面末尾追加验收结论',
  writeTarget: {
    type: 'space' as const,
    spaceUUID: 'space-output',
    spaceName: '交付文档库',
    homePageUUID: 'page-home'
  },
  subFields: []
};

test('agentConfigSchema keeps legacy configs compatible', () => {
  const parsed = agentConfigSchema.parse({
    description: '',
    prompt: '',
    inputs: [],
    outputs: []
  });

  assert.deepEqual(parsed.knowledgeSourceUUIDs, []);
});

test('agentConfigSchema accepts related Wiki page work item fields', () => {
  const parsed = agentConfigSchema.parse({
    description: '',
    prompt: '',
    knowledgeSourceUUIDs: ['knowledge-1'],
    inputs: [
      {
        kind: 'wiki_page',
        field: wikiOutputField.field,
        description: '阅读关联设计文档',
        subFields: []
      }
    ],
    outputs: [wikiOutputField]
  });

  assert.equal(parsed.inputs[0]?.field.uuid, 'fieldWiki');
  assert.equal(parsed.outputs[0]?.field.uuid, 'fieldWiki');
});

test('agentConfigSchema keeps legacy Wiki outputs readable', () => {
  const parsed = agentConfigSchema.parse({
    description: '',
    prompt: '',
    inputs: [],
    outputs: [
      {
        kind: 'wiki_page',
        mode: 'wiki_page',
        field: wikiOutputField.field,
        description: '',
        subFields: []
      }
    ]
  });

  const output = parsed.outputs[0];
  assert.equal(output?.kind, 'wiki_page');
  if (output?.kind === 'wiki_page') {
    assert.equal(output.writeTarget, null);
  }
});

test('parseAgentOutputString parses a structured Wiki append action', () => {
  const result = parseAgentOutputString(
    `<outputs>
      <output>
        <field-uuid>fieldWiki</field-uuid>
        <wiki-action>
          <action>append</action>
          <target-page-uuid>page1234</target-page-uuid>
          <markdown><![CDATA[## 验收结论\n\n已通过。]]></markdown>
        </wiki-action>
      </output>
    </outputs>`,
    [wikiOutputField]
  );

  assert.deepEqual(result, [
    {
      mode: 'wiki_page',
      fieldUUIDPath: 'fieldWiki',
      action: 'append',
      targetPageUUID: 'page1234',
      targetPageName: null,
      parentPageUUID: null,
      spaceUUID: null,
      title: null,
      markdown: '## 验收结论\n\n已通过。'
    }
  ]);
});

test('parseAgentOutputString rejects an incomplete Wiki create action', () => {
  const legacyWikiOutputField = {
    ...wikiOutputField,
    writeTarget: null
  };
  assert.throws(
    () =>
      parseAgentOutputString(
        `<outputs><output><field-uuid>fieldWiki</field-uuid><wiki-action><action>create</action><title>新页面</title><markdown>正文</markdown></wiki-action></output></outputs>`,
        [legacyWikiOutputField]
      ),
    /requires parent-page-uuid or space-uuid/u
  );
});

test('parseAgentOutputString uses configured target for Wiki create', () => {
  const result = parseAgentOutputString(
    `<outputs><output><field-uuid>fieldWiki</field-uuid><wiki-action><action>create</action><title>验收报告</title><markdown>正文</markdown></wiki-action></output></outputs>`,
    [wikiOutputField]
  );

  assert.deepEqual(result, [
    {
      mode: 'wiki_page',
      fieldUUIDPath: 'fieldWiki',
      action: 'create',
      targetPageUUID: null,
      targetPageName: null,
      parentPageUUID: null,
      spaceUUID: null,
      title: '验收报告',
      markdown: '正文'
    }
  ]);
});

test('buildAgentPrompt renders Wiki input context and action schema', () => {
  const prompt = buildAgentPrompt(
    {
      description: '',
      prompt: '更新文档',
      inputs: [],
      outputs: [wikiOutputField]
    },
    {
      wikiInputsXml: '<wiki-inputs><page uuid="page1234" /></wiki-inputs>',
      knowledgeContextXml:
        '<knowledge-context><knowledge-source uuid="knowledge-1" /></knowledge-context>'
    }
  );

  assert.match(prompt, /<wiki-inputs>/u);
  assert.match(prompt, /<knowledge-context>/u);
  assert.match(prompt, /<wiki-action>/u);
  assert.match(prompt, /<field-uuid>fieldWiki<\/field-uuid>/u);
  assert.match(prompt, /<configured-write-target>/u);
  assert.match(prompt, /<space-uuid>space-output<\/space-uuid>/u);
  assert.doesNotMatch(prompt, /<parent-page-uuid><\/parent-page-uuid>/u);
});

test('revision Wiki output rejects duplicate create before calling ONES', async () => {
  await assert.rejects(
    () =>
      buildWikiWritePlan({
        output: {
          mode: 'wiki_page',
          fieldUUIDPath: 'fieldWiki',
          action: 'create',
          targetPageUUID: null,
          targetPageName: null,
          parentPageUUID: null,
          spaceUUID: null,
          title: '重复页面',
          markdown: '正文'
        },
        field: wikiOutputField,
        executeOption: {
          wikiContext: { inputPages: [] },
          revisionContext: {
            currentWikiPages: [
              {
                fieldUUID: 'fieldWiki',
                uuid: 'page-existing',
                title: '已有页面',
                spaceUUID: 'space-output',
                updatedTime: 1,
                refType: 'collaboration'
              }
            ]
          }
        },
        knowledgeSourceUUIDs: [],
        onesContext: { teamUUID: 'team-1', userUUID: 'user-1' }
      }),
    /must replace or append the existing page/u
  );
});

test('collaboration Wiki content converts to Markdown and back', () => {
  const content = markdownToCollaborationContent('# 标题\n\n正文');
  const markdown = wikiPageContentToMarkdown({
    id: 'page1234',
    title: '页面',
    spaceID: 'space123',
    parentID: '',
    refType: 'collaboration',
    updatedTime: 1,
    isArchived: false,
    canEdit: true,
    locked: false,
    content
  });

  assert.equal(markdown, '# 标题\n\n\n\n正文');
  assert.equal(appendWikiMarkdown('原文', '追加'), '原文\n\n追加');
});
