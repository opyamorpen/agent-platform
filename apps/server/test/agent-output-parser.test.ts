import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAgentOutputString
} from '../../../packages/shared/src/agent-output.ts';
import {
  buildAgentInputContextXml,
  buildAgentPrompt
} from '../src/modules/agents/prompt-render.ts';

test('parseAgentOutputString unwraps CDATA set-value blocks', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field001</field-uuid>',
      '    <set-value><![CDATA[Line 1',
      'Line 2',
      '<span data-ref-name="张三">mention</span>]]></set-value>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field001',
          name: '摘要',
          valueType: 'multi_line_text',
          referenceObjectType: null
        },
        description: 'summary output',
        subFields: []
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'set_value',
      fieldUUIDPath: 'field001',
      value: 'Line 1\nLine 2\n<span data-ref-name="张三">mention</span>'
    }
  ]);
});

test('parseAgentOutputString keeps plain set-value unchanged', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field001</field-uuid>',
      '    <set-value>plain text</set-value>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field001',
          name: '摘要',
          valueType: 'multi_line_text',
          referenceObjectType: null
        },
        description: 'summary output',
        subFields: []
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'set_value',
      fieldUUIDPath: 'field001',
      value: 'plain text'
    }
  ]);
});

test('parseAgentOutputString parses output fields blocks', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field014</field-uuid>',
      '    <objects>',
      '      <object>',
      '        <object-write-mode>update</object-write-mode>',
      '        <object-type>issue</object-type>',
      '        <object-uuid>issue-1</object-uuid>',
      '        <object-name>PROJ-1</object-name>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>field001</field-uuid>',
      '            <set-value>新的标题</set-value>',
      '          </field>',
      '          <field>',
      '            <field-uuid>field002</field-uuid>',
      '            <set-value><![CDATA[新的描述]]></set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field014',
          name: '关联工作项',
          valueType: 'single_reference_object',
          referenceObjectType: 'issue'
        },
        description: '',
        subFields: [
          {
            mode: 'set_value',
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '更新标题',
            subFields: []
          },
          {
            mode: 'set_value',
            field: {
              uuid: 'field002',
              name: '描述',
              valueType: 'multi_line_text',
              referenceObjectType: null
            },
            description: '更新描述',
            subFields: []
          }
        ]
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'field014',
      fieldWriteMode: null,
      objects: [
        {
          objectType: 'issue',
          objectWriteMode: 'update',
          objectUUID: 'issue-1',
          objectName: 'PROJ-1',
          fields: {
            field001: '新的标题',
            field002: '新的描述'
          }
        }
      ]
    }
  ]);
});

test('parseAgentOutputString accepts self-closing empty objects blocks', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>A2wqc8Kt</field-uuid>',
      '    <objects />',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'A2wqc8Kt',
          name: '关联逃逸缺陷',
          valueType: 'single_reference_object',
          referenceObjectType: 'issue'
        },
        description: '诊断结论为转逃逸缺陷时创建，否则不创建',
        subFields: [
          {
            mode: 'set_value',
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '新建逃逸缺陷标题',
            subFields: []
          }
        ]
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'A2wqc8Kt',
      fieldWriteMode: null,
      objects: []
    }
  ]);
});

test('parseAgentOutputString parses multiple created issue objects', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field200</field-uuid>',
      '    <field-write-mode>append</field-write-mode>',
      '    <objects>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>issue</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>field001</field-uuid>',
      '            <set-value>补齐接口单测</set-value>',
      '          </field>',
      '          <field>',
      '            <field-uuid>field002</field-uuid>',
      '            <set-value><![CDATA[Line 1',
      'Line 2]]></set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>issue</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>field001</field-uuid>',
      '            <set-value>补齐集成测试</set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field200',
          name: '关联工作项',
          valueType: 'multi_reference_object',
          referenceObjectType: 'issue'
        },
        description: '创建并关联工作项',
        subFields: [
          {
            mode: 'set_value',
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '标题',
            subFields: []
          },
          {
            mode: 'set_value',
            field: {
              uuid: 'field002',
              name: '描述',
              valueType: 'multi_line_text',
              referenceObjectType: null
            },
            description: '描述',
            subFields: []
          }
        ]
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'field200',
      fieldWriteMode: 'append',
      objects: [
        {
          objectType: 'issue',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            field001: '补齐接口单测',
            field002: 'Line 1\nLine 2'
          }
        },
        {
          objectType: 'issue',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            field001: '补齐集成测试'
          }
        }
      ]
    }
  ]);
});

test('parseAgentOutputString parses created issue objects with nested reference objects', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>A2wqc8Kt</field-uuid>',
      '    <objects>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>issue</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>field001</field-uuid>',
      '            <set-value>逃逸缺陷标题</set-value>',
      '          </field>',
      '          <field>',
      '            <field-uuid>field002</field-uuid>',
      '            <set-value><![CDATA[<p>描述正文</p>]]></set-value>',
      '          </field>',
      '          <field>',
      '            <field-uuid>field006</field-uuid>',
      '            <objects>',
      '              <object>',
      '                <object-type>project</object-type>',
      '                <object-uuid>project-1</object-uuid>',
      '                <object-name>项目A</object-name>',
      '              </object>',
      '            </objects>',
      '          </field>',
      '          <field>',
      '            <field-uuid>field047</field-uuid>',
      '            <objects>',
      '              <object>',
      '                <object-write-mode>create</object-write-mode>',
      '                <object-type>attachment</object-type>',
      '                <fields>',
      '                  <field>',
      '                    <field-uuid>local_path</field-uuid>',
      '                    <set-value>prepare_branch.py</set-value>',
      '                  </field>',
      '                </fields>',
      '              </object>',
      '            </objects>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'A2wqc8Kt',
          name: '关联逃逸缺陷',
          valueType: 'single_reference_object',
          referenceObjectType: 'issue'
        },
        description: '诊断结论为转逃逸缺陷时创建，否则不创建',
        subFields: [
          {
            mode: 'set_value',
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '新建逃逸缺陷标题',
            subFields: []
          },
          {
            mode: 'set_value',
            field: {
              uuid: 'field002',
              name: '描述',
              valueType: 'richtext',
              referenceObjectType: null
            },
            description: '新建逃逸缺陷描述',
            subFields: []
          },
          {
            mode: 'set_value',
            field: {
              uuid: 'field006',
              name: '所属项目',
              valueType: 'single_reference_object',
              referenceObjectType: 'project'
            },
            description: '和输入中的所属项目一样',
            subFields: []
          },
          {
            mode: 'set_value',
            field: {
              uuid: 'field047',
              name: '附件',
              valueType: 'multi_reference_object',
              referenceObjectType: 'attachment'
            },
            description: '上传附件',
            subFields: []
          }
        ]
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'A2wqc8Kt',
      fieldWriteMode: null,
      objects: [
        {
          objectType: 'issue',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            field001: '逃逸缺陷标题',
            field002: '<p>描述正文</p>',
            field006: [
              {
                objectType: 'project',
                objectWriteMode: null,
                objectUUID: 'project-1',
                objectName: '项目A',
                fields: {}
              }
            ],
            field047: [
              {
                objectType: 'attachment',
                objectWriteMode: 'create',
                objectUUID: null,
                objectName: null,
                fields: {
                  local_path: 'prepare_branch.py'
                }
              }
            ]
          }
        }
      ]
    }
  ]);
});

test('parseAgentOutputString parses non-issue reference objects', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field003</field-uuid>',
      '    <objects>',
      '      <object>',
      '        <object-type>user</object-type>',
      '        <object-uuid>user-1</object-uuid>',
      '        <object-name>张三</object-name>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field003',
          name: '负责人',
          valueType: 'single_reference_object',
          referenceObjectType: 'user'
        },
        description: '设置负责人',
        subFields: []
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'field003',
      fieldWriteMode: null,
      objects: [
        {
          objectType: 'user',
          objectWriteMode: null,
          objectUUID: 'user-1',
          objectName: '张三',
          fields: {}
        }
      ]
    }
  ]);
});

test('parseAgentOutputString parses comment objects', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field057</field-uuid>',
      '    <objects>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>comment</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>content</field-uuid>',
      '            <set-value><![CDATA[第一条评论]]></set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>comment</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>content</field-uuid>',
      '            <set-value>第二条评论</set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field057',
          name: '评论',
          valueType: 'multi_reference_object',
          referenceObjectType: 'comment'
        },
        description: '输出评论',
        subFields: []
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'field057',
      fieldWriteMode: null,
      objects: [
        {
          objectType: 'comment',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            content: '第一条评论'
          }
        },
        {
          objectType: 'comment',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            content: '第二条评论'
          }
        }
      ]
    }
  ]);
});

test('parseAgentOutputString parses attachment objects', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field047</field-uuid>',
      '    <objects>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>attachment</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>local_path</field-uuid>',
      '            <set-value>artifacts/report.md</set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '      <object>',
      '        <object-write-mode>create</object-write-mode>',
      '        <object-type>attachment</object-type>',
      '        <fields>',
      '          <field>',
      '            <field-uuid>local_path</field-uuid>',
      '            <set-value><![CDATA[artifacts/screenshot.png]]></set-value>',
      '          </field>',
      '        </fields>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field047',
          name: '附件',
          valueType: 'multi_reference_object',
          referenceObjectType: 'attachment'
        },
        description: '输出附件',
        subFields: []
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'field047',
      fieldWriteMode: null,
      objects: [
        {
          objectType: 'attachment',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            local_path: 'artifacts/report.md'
          }
        },
        {
          objectType: 'attachment',
          objectWriteMode: 'create',
          objectUUID: null,
          objectName: null,
          fields: {
            local_path: 'artifacts/screenshot.png'
          }
        }
      ]
    }
  ]);
});

test('parseAgentOutputString parses attachment reference objects without fields', () => {
  const result = parseAgentOutputString(
    [
      '<outputs>',
      '  <output>',
      '    <field-uuid>field047</field-uuid>',
      '    <objects>',
      '      <object>',
      '        <object-type>attachment</object-type>',
      '        <object-uuid>attachment-1</object-uuid>',
      '        <object-name>prepare_branch.py</object-name>',
      '      </object>',
      '    </objects>',
      '  </output>',
      '</outputs>'
    ].join('\n'),
    [
      {
        mode: 'set_value',
        field: {
          uuid: 'field047',
          name: '附件',
          valueType: 'multi_reference_object',
          referenceObjectType: 'attachment'
        },
        description: '引用已有附件',
        subFields: []
      }
    ]
  );

  assert.deepEqual(result, [
    {
      mode: 'object_values',
      fieldUUIDPath: 'field047',
      fieldWriteMode: null,
      objects: [
        {
          objectType: 'attachment',
          objectWriteMode: null,
          objectUUID: 'attachment-1',
          objectName: 'prepare_branch.py',
          fields: {}
        }
      ]
    }
  ]);
});

test('buildAgentInputContextXml renders nested issue input fields as a tree', () => {
  const xml = buildAgentInputContextXml({
    objectType: 'issue',
    objectUUID: 'issue-current',
    objectName: 'PROJ-100',
    fields: [
      {
        fieldUUID: 'field014',
        fieldName: '父工作项',
        fieldValueType: 'single_reference_object',
        fieldReferenceObjectType: 'issue',
        description: '父工作项',
        value: {
          objectType: 'issue',
          uuid: 'issue-1',
          name: 'PROJ-123',
          fields: [
            {
              fieldUUID: 'field001',
              fieldName: '标题',
              fieldValueType: 'text',
              description: '父工作项标题',
              value: '补齐单测'
            }
          ]
        }
      },
      {
        fieldUUID: 'field003',
        fieldName: '创建者',
        fieldValueType: 'single_reference_object',
        fieldReferenceObjectType: 'user',
        description: '创建者信息',
        value: {
          objectType: 'user',
          uuid: 'user-1',
          name: '张三'
        }
      }
    ]
  });

  assert.match(xml, /^<input>[\s\S]*<\/input>$/);
  assert.match(xml, /<object-type>issue<\/object-type>/);
  assert.match(xml, /<object-uuid>issue-current<\/object-uuid>/);
  assert.match(xml, /<object-name>PROJ-100<\/object-name>/);
  assert.match(xml, /<field-uuid>field014<\/field-uuid>/);
  assert.match(xml, /<field-name>父工作项<\/field-name>/);
  assert.match(
    xml,
    /<field-uuid>field014<\/field-uuid>[\s\S]*<object>[\s\S]*<object-type>issue<\/object-type>[\s\S]*<object-uuid>issue-1<\/object-uuid>[\s\S]*<object-name>PROJ-123<\/object-name>[\s\S]*<fields>[\s\S]*<field-uuid>field001<\/field-uuid>[\s\S]*<field-name>标题<\/field-name>[\s\S]*<field-value-type>text<\/field-value-type>[\s\S]*<field-description>父工作项标题<\/field-description>[\s\S]*<field-value>补齐单测<\/field-value>[\s\S]*<\/field>[\s\S]*<\/fields>[\s\S]*<\/object>/
  );
  assert.match(
    xml,
    /<field-uuid>field003<\/field-uuid>[\s\S]*<field-value-type>single_reference_object<\/field-value-type>[\s\S]*<field-reference-object-type>user<\/field-reference-object-type>[\s\S]*<object>[\s\S]*<object-type>user<\/object-type>[\s\S]*<object-uuid>user-1<\/object-uuid>[\s\S]*<object-name>张三<\/object-name>[\s\S]*<\/object>/
  );
});

test('buildAgentInputContextXml renders attachment download url as attachment field', () => {
  const xml = buildAgentInputContextXml({
    objectType: 'issue',
    objectUUID: 'issue-current',
    objectName: 'PROJ-100',
    fields: [
      {
        fieldUUID: 'field047',
        fieldName: '附件',
        fieldValueType: 'multi_reference_object',
        fieldReferenceObjectType: 'attachment',
        description: '当前工作项附件',
        value: [
          {
            objectType: 'attachment',
            uuid: 'attachment-1',
            name: 'report.pdf',
            fields: [
              {
                fieldUUID: 'download_url',
                fieldName: '下载地址',
                fieldValueType: 'text',
                description: '附件下载地址',
                value:
                  'https://example.com/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260703T034119Z&response-content-type=application%2Foctet-stream'
              },
              {
                fieldUUID: 'created_at',
                fieldName: '上传时间',
                fieldValueType: 'datetime',
                description: '附件上传时间',
                value: '2026-06-22T10:30:45.000Z'
              },
              {
                fieldUUID: 'creator',
                fieldName: '创建者',
                fieldValueType: 'single_reference_object',
                fieldReferenceObjectType: 'user',
                description: '附件创建者',
                value: {
                  objectType: 'user',
                  uuid: 'user-1',
                  name: '张三'
                }
              }
            ]
          }
        ]
      }
    ]
  });

  assert.match(xml, /<field-uuid>field047<\/field-uuid>/);
  assert.match(xml, /<field-value-type>multi_reference_object<\/field-value-type>/);
  assert.match(
    xml,
    /<field-reference-object-type>attachment<\/field-reference-object-type>/
  );
  assert.match(xml, /<object-uuid>attachment-1<\/object-uuid>/);
  assert.match(xml, /<object-name>report\.pdf<\/object-name>/);
  assert.match(xml, /<fields>/);
  assert.match(xml, /<field-uuid>download_url<\/field-uuid>/);
  assert.match(xml, /<field-name>下载地址<\/field-name>/);
  assert.match(xml, /<field-value-type>text<\/field-value-type>/);
  assert.match(
    xml,
    /<field-value><!\[CDATA\[https:\/\/example\.com\/report\.pdf\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260703T034119Z&response-content-type=application%2Foctet-stream\]\]><\/field-value>/
  );
  assert.match(xml, /<field-uuid>created_at<\/field-uuid>/);
  assert.match(xml, /<field-name>上传时间<\/field-name>/);
  assert.match(xml, /<field-value-type>datetime<\/field-value-type>/);
  assert.match(xml, /<field-value>2026-06-22T10:30:45.000Z<\/field-value>/);
  assert.match(xml, /<field-uuid>creator<\/field-uuid>/);
  assert.match(xml, /<field-name>创建者<\/field-name>/);
  assert.match(xml, /<field-reference-object-type>user<\/field-reference-object-type>/);
  assert.match(
    xml,
    /<field-uuid>creator<\/field-uuid>[\s\S]*<object>[\s\S]*<object-type>user<\/object-type>[\s\S]*<object-uuid>user-1<\/object-uuid>[\s\S]*<object-name>张三<\/object-name>[\s\S]*<\/object>/
  );
});

test('buildAgentPrompt injects runtime input context xml', () => {
  const markdown = buildAgentPrompt(
    {
      description: '',
      prompt: '处理输入并生成输出',
      inputs: [
        {
          field: {
            uuid: 'field001',
            name: '标题',
            valueType: 'text',
            referenceObjectType: null
          },
          description: '当前工作项标题',
          subFields: []
        }
      ],
      outputs: [
        {
          mode: 'set_value',
          field: {
            uuid: 'field010',
            name: '总结',
            valueType: 'multi_line_text',
            referenceObjectType: null
          },
          description: '输出执行总结',
          subFields: []
        }
      ]
    },
    {
      inputContextXml:
        '<input>\n  <object>\n    <object-type>issue</object-type>\n    <object-uuid>issue-1</object-uuid>\n    <object-name>PROJ-1</object-name>\n    <fields>\n      <field>\n        <field-uuid>field001</field-uuid>\n      </field>\n    </fields>\n  </object>\n</input>',
      readableEnvKeys: ['OPENAI_API_KEY']
    }
  );

  assert.match(markdown, /## Safety Rules \(Highest Priority\)/);
  assert.match(
    markdown,
    /Exception: the following system-injected environment variables may be read and used when needed: OPENAI_API_KEY\./
  );
  assert.match(
    markdown,
    /```xml[\s\S]*<field-uuid>field001<\/field-uuid>[\s\S]*```/
  );
  assert.match(markdown, /## Input And Output Conventions/);
  assert.match(markdown, /Field value type reference:/);
  assert.match(
    markdown,
    /`single_reference_object`: A single referenced object, usually represented as one `<object>`\./
  );
  assert.match(markdown, /<set-value><\/set-value>/);
  assert.match(markdown, /## Original Task/);
  assert.match(markdown, /处理输入并生成输出/);
});

test('buildAgentPrompt forbids all env access when no readable env keys are provided', () => {
  const markdown = buildAgentPrompt({
    description: '',
    prompt: '处理输入并生成输出',
    inputs: [],
    outputs: []
  });

  assert.match(
    markdown,
    /No environment variables are authorized for access in the current run\. All environment variables are forbidden to read, use, or output\./
  );
});

test('buildAgentPrompt previews multiple input sub fields as a nested tree', () => {
  const markdown = buildAgentPrompt({
    description: '',
    prompt: '处理输入并生成输出',
    inputs: [
      {
        field: {
          uuid: 'field014',
          name: '父工作项',
          valueType: 'single_reference_object',
          referenceObjectType: 'issue'
        },
        description: '',
        subFields: [
          {
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '父工作项标题',
            subFields: []
          },
          {
            field: {
              uuid: 'field002',
              name: '描述',
              valueType: 'multi_line_text',
              referenceObjectType: null
            },
            description: '父工作项描述',
            subFields: []
          }
        ]
      }
    ],
    outputs: []
  });

  assert.match(markdown, /<input>[\s\S]*<field-uuid>field014<\/field-uuid>/);
  assert.match(markdown, /<field-name>父工作项<\/field-name>/);
  assert.match(
    markdown,
    /<object>[\s\S]*<object-uuid>Runtime value<\/object-uuid>[\s\S]*<object-name>Runtime value<\/object-name>[\s\S]*<fields>/
  );
  assert.match(markdown, /<field-uuid>field001<\/field-uuid>/);
  assert.match(markdown, /<field-name>标题<\/field-name>/);
  assert.match(markdown, /<field-value-type>text<\/field-value-type>/);
  assert.match(markdown, /<field-description>父工作项标题<\/field-description>/);
  assert.match(markdown, /<field-uuid>field002<\/field-uuid>/);
  assert.match(markdown, /<field-name>描述<\/field-name>/);
  assert.match(markdown, /<field-value-type>multi_line_text<\/field-value-type>/);
  assert.match(markdown, /<field-description>父工作项描述<\/field-description>/);
});

test('buildAgentPrompt previews multiple output sub fields as separate entries', () => {
  const markdown = buildAgentPrompt({
    description: '',
    prompt: '处理输入并生成输出',
    inputs: [],
    outputs: [
      {
        mode: 'set_value',
        field: {
          uuid: 'field014',
          name: '关联工作项',
          valueType: 'single_reference_object',
          referenceObjectType: 'issue'
        },
        description: '',
        subFields: [
          {
            mode: 'set_value',
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '更新标题',
            subFields: []
          },
          {
            mode: 'set_value',
            field: {
              uuid: 'field002',
              name: '描述',
              valueType: 'multi_line_text',
              referenceObjectType: null
            },
            description: '更新描述',
            subFields: []
          }
        ]
      }
    ]
  });

  assert.match(markdown, /<field-uuid>field014<\/field-uuid>/);
  assert.match(markdown, /<field-name>关联工作项<\/field-name>/);
  assert.match(
    markdown,
    /<field-value-type>single_reference_object<\/field-value-type>/
  );
  assert.match(
    markdown,
    /<field-reference-object-type>issue<\/field-reference-object-type>/
  );
  assert.match(markdown, /<objects>/);
  assert.match(markdown, /<object-write-mode><\/object-write-mode>/);
  assert.match(markdown, /<field-uuid>field001<\/field-uuid>/);
  assert.match(markdown, /<field-name>标题<\/field-name>/);
  assert.match(markdown, /<field-value-type>text<\/field-value-type>/);
  assert.match(markdown, /<field-description>更新标题<\/field-description>/);
  assert.match(markdown, /<field-uuid>field002<\/field-uuid>/);
  assert.match(markdown, /<field-name>描述<\/field-name>/);
  assert.match(markdown, /<field-value-type>multi_line_text<\/field-value-type>/);
  assert.match(markdown, /<field-description>更新描述<\/field-description>/);
});

test('buildAgentPrompt previews field-write-mode for multi reference outputs', () => {
  const markdown = buildAgentPrompt({
    description: '',
    prompt: '输出关联对象',
    inputs: [],
    outputs: [
      {
        mode: 'set_value',
        field: {
          uuid: 'field200',
          name: '关联工作项',
          valueType: 'multi_reference_object',
          referenceObjectType: 'issue'
        },
        description: '追加关联工作项',
        subFields: [
          {
            mode: 'set_value',
            field: {
              uuid: 'field001',
              name: '标题',
              valueType: 'text',
              referenceObjectType: null
            },
            description: '标题',
            subFields: []
          }
        ]
      }
    ]
  });

  assert.match(markdown, /<field-uuid>field200<\/field-uuid>/);
  assert.match(markdown, /<field-write-mode><\/field-write-mode>/);
});

test('buildAgentPrompt previews comment output as comment objects', () => {
  const markdown = buildAgentPrompt({
    description: '',
    prompt: '输出评论',
    inputs: [],
    outputs: [
      {
        mode: 'set_value',
        field: {
          uuid: 'field057',
          name: '评论',
          valueType: 'multi_reference_object',
          referenceObjectType: 'comment'
        },
        description: '补充评论',
        subFields: []
      }
    ]
  });

  assert.match(markdown, /<field-uuid>field057<\/field-uuid>/);
  assert.match(markdown, /<field-reference-object-type>comment<\/field-reference-object-type>/);
  assert.match(markdown, /<object-write-mode>create<\/object-write-mode>/);
  assert.match(markdown, /<object-type>comment<\/object-type>/);
  assert.match(markdown, /<field-uuid>content<\/field-uuid>/);
  assert.match(markdown, /<field-name>Content<\/field-name>/);
  assert.match(markdown, /<field-value-type>richtext<\/field-value-type>/);
  assert.match(markdown, /<field-description>Comment body\.<\/field-description>/);
});

test('buildAgentPrompt previews attachment output as attachment objects', () => {
  const markdown = buildAgentPrompt({
    description: '',
    prompt: '输出附件',
    inputs: [],
    outputs: [
      {
        mode: 'set_value',
        field: {
          uuid: 'field047',
          name: '附件',
          valueType: 'multi_reference_object',
          referenceObjectType: 'attachment'
        },
        description: '补充附件',
        subFields: []
      }
    ]
  });

  assert.match(markdown, /<field-uuid>field047<\/field-uuid>/);
  assert.match(markdown, /<field-reference-object-type>attachment<\/field-reference-object-type>/);
  assert.match(markdown, /<object-write-mode>create<\/object-write-mode>/);
  assert.match(markdown, /<object-type>attachment<\/object-type>/);
  assert.match(markdown, /<field-uuid>local_path<\/field-uuid>/);
  assert.match(markdown, /<field-name>Local path<\/field-name>/);
  assert.match(markdown, /<field-value-type>text<\/field-value-type>/);
  assert.match(
    markdown,
    /<field-description>Workspace-relative path used to upload this attachment\.<\/field-description>/
  );
});
