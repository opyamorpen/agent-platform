import test from 'node:test';
import assert from 'node:assert/strict';
import { buildListAssignedIssuesQuery } from '../src/ones/issue.ts';
import {
  validateWorkflowNodeExecutorBindings,
  WorkflowNodeExecutorInvalidError
} from '../src/modules/workflows/service.ts';
import {
  buildTaskBlockedComment,
  buildWikiPageReferenceFieldValue,
  buildIssueOutputWritePlan,
  buildCreateIssueRequest,
  hasTaskCommentSinceQueuedAt,
  buildTaskStartedComment,
  didIssueTriggerChange,
  findExactFieldOptionMatches,
  findExactUserMatches,
  getExecutorOnesContext,
  getTaskExecuteOptionMetadata,
  hasTaskStartedCommentSinceQueuedAt,
  isUserReferenceField,
  normalizeExecutePayloadValue,
  selectConfiguredPostActionWorkflow,
  selectNextDispatchableTask,
  shouldSendTaskStartedComment,
  shouldBlockAfterConsecutiveFailures
} from '../src/modules/agent-clients/service.ts';
import { createWorkflowNodeSchema } from '../src/modules/workflows/dto.ts';
import { extractAgentClientTaskAttachments } from '../src/modules/agent-clients/controller.ts';
import {
  canRetryIssueAgentExecution,
  getExecutionStatus,
  isLatestDispatchedIssueExecution,
  isLatestIssueAgentExecution
} from '../src/modules/executions/service.ts';

test('buildListAssignedIssuesQuery uses explicit assignee UUIDs', () => {
  const query = buildListAssignedIssuesQuery(
    ['executor-a', 'executor-a', "executor-b'quoted"],
    20
  );

  assert.match(
    query,
    /WHERE uid\(field004\) IN \('executor-a', 'executor-b\\'quoted'\)/
  );
  assert.doesNotMatch(query, /currentUser\(\)/);
  assert.match(query, /LIMIT 1000, 20$/);
});

test('buildListAssignedIssuesQuery pushes workflow node filters into query', () => {
  const query = buildListAssignedIssuesQuery(['executor-a'], 20, [
    {
      projectUUID: 'project-1',
      issueTypeUUID: 'type-1',
      statusUUID: 'status-1'
    },
    {
      projectUUID: 'project-1',
      issueTypeUUID: 'type-1',
      statusUUID: 'status-1'
    },
    {
      projectUUID: 'project-2',
      issueTypeUUID: 'type-2',
      statusUUID: 'status-2'
    }
  ]);

  assert.match(
    query,
    /AND \(\( uid\(field006\) = 'project-1' AND uid\(field007\) = 'type-1' AND uid\(field005\) = 'status-1' \) OR \( uid\(field006\) = 'project-2' AND uid\(field007\) = 'type-2' AND uid\(field005\) = 'status-2' \)\)/
  );
});

test('buildListAssignedIssuesQuery rejects empty assignee lists', () => {
  assert.throws(
    () => buildListAssignedIssuesQuery([], 20),
    /At least one assignee UUID is required/
  );
});

test('validateWorkflowNodeExecutorBindings accepts shared executor', () => {
  assert.doesNotThrow(() =>
    validateWorkflowNodeExecutorBindings([
      {
        uuid: 'agent-1',
        name: 'Agent 1',
        executor: {
          uuid: 'user-1',
          name: 'User 1'
        }
      },
      {
        uuid: 'agent-2',
        name: 'Agent 2',
        executor: {
          uuid: 'user-1',
          name: 'User 1'
        }
      }
    ])
  );
});

test('workflow node DTO keeps old nodes compatible without post-actions', () => {
  const parsed = createWorkflowNodeSchema.parse({
    project: { uuid: 'project-1', name: 'Project' },
    issueType: { uuid: 'type-1', name: 'Requirement' },
    status: { uuid: 'status-1', name: 'In progress' },
    agentUUID: 'agent-1'
  });

  assert.deepEqual(parsed.postActions, []);
  assert.deepEqual(parsed.revisionContext, { enabled: false });
});

test('workflow node DTO accepts revision context opt-in', () => {
  const parsed = createWorkflowNodeSchema.parse({
    project: { uuid: 'project-1', name: 'Project' },
    issueType: { uuid: 'type-1', name: 'Requirement' },
    status: { uuid: 'status-1', name: 'In progress' },
    agentUUID: 'agent-1',
    revisionContext: { enabled: true }
  });

  assert.equal(parsed.revisionContext.enabled, true);
});

test('workflow node DTO rejects a post-action that keeps the trigger status', () => {
  assert.throws(
    () =>
      createWorkflowNodeSchema.parse({
        project: { uuid: 'project-1', name: 'Project' },
        issueType: { uuid: 'type-1', name: 'Requirement' },
        status: { uuid: 'status-1', name: 'In progress' },
        agentUUID: 'agent-1',
        postActions: [
          {
            type: 'transition_issue_status',
            targetStatus: { uuid: 'status-1', name: 'In progress' }
          }
        ]
      }),
    /must differ from trigger status/u
  );
});

test('configured post-action selects exactly one executable workflow', () => {
  const workflow = selectConfiguredPostActionWorkflow(
    [
      {
        id: 'workflow-1',
        name: 'Approve',
        start: 'status-1',
        end: 'status-2'
      }
    ],
    { uuid: 'status-2', name: 'Approved' },
    'In progress'
  );

  assert.equal(workflow.id, 'workflow-1');
  assert.throws(
    () =>
      selectConfiguredPostActionWorkflow(
        [],
        { uuid: 'status-2', name: 'Approved' },
        'In progress'
      ),
    /No executable workflow found/u
  );
});

test('Wiki output association appends and deduplicates multi-value fields', () => {
  assert.deepEqual(
    buildWikiPageReferenceFieldValue(
      'multi_reference_object',
      [
        { uuid: 'page-1', name: 'Existing' },
        { uuid: 'page-2', name: 'Created' }
      ],
      'page-2'
    ),
    ['page-1', 'page-2']
  );
  assert.equal(
    buildWikiPageReferenceFieldValue(
      'single_reference_object',
      { uuid: 'page-1', name: 'Existing' },
      'page-2'
    ),
    'page-2'
  );
});

test('validateWorkflowNodeExecutorBindings rejects agents without executor', () => {
  assert.throws(
    () =>
      validateWorkflowNodeExecutorBindings([
        {
          uuid: 'agent-1',
          name: 'Agent 1',
          executor: null
        }
      ]),
    (error) =>
      error instanceof WorkflowNodeExecutorInvalidError &&
      /must have executor/.test(error.message)
  );
});

test('validateWorkflowNodeExecutorBindings rejects mismatched executors', () => {
  assert.throws(
    () =>
      validateWorkflowNodeExecutorBindings([
        {
          uuid: 'agent-1',
          name: 'Agent 1',
          executor: {
            uuid: 'user-1',
            name: 'User 1'
          }
        },
        {
          uuid: 'agent-2',
          name: 'Agent 2',
          executor: {
            uuid: 'user-2',
            name: 'User 2'
          }
        }
      ]),
    (error) =>
      error instanceof WorkflowNodeExecutorInvalidError &&
      /same executor/.test(error.message)
  );
});

test('getExecutorOnesContext maps executor UUID into ONES user context', () => {
  assert.deepEqual(
    getExecutorOnesContext(
      {
        executorUUID: 'user-42'
      },
      'team-99'
    ),
    {
      teamUUID: 'team-99',
      userUUID: 'user-42'
    }
  );
});

test('normalizeExecutePayloadValue formats ref objects with name and uuid', () => {
  assert.equal(
    normalizeExecutePayloadValue({
      uuid: 'status-1',
      name: '进行中'
    }),
    '进行中 [uuid=status-1]'
  );

  assert.equal(
    normalizeExecutePayloadValue([
      {
        uuid: 'user-1',
        name: '张三'
      },
      {
        uuid: 'user-2',
        name: '李四'
      }
    ]),
    ['- 张三 [uuid=user-1]', '- 李四 [uuid=user-2]'].join('\n')
  );
});

test('findExactFieldOptionMatches normalizes whitespace and display keys', () => {
  const matches = findExactFieldOptionMatches(
    [
      {
        uuid: 'status-1',
        name: '待补充信息'
      },
      {
        uuid: 'status-2',
        label: '处理中'
      },
      {
        uuid: 'status-3',
        value: '待  补充   信息'
      }
    ],
    '  待 补充 信息 '
  );

  assert.deepEqual(matches, [
    {
      uuid: 'status-1',
      name: '待补充信息'
    },
    {
      uuid: 'status-3',
      value: '待  补充   信息'
    }
  ]);
});

test('findExactUserMatches supports exact match by name, email, and staff id', () => {
  const users = [
    {
      id: 'user-1',
      name: '张三',
      email: 'zhangsan@example.com',
      staffID: 'A001'
    },
    {
      id: 'user-2',
      name: '李四',
      email: 'lisi@example.com',
      staffID: 'A002'
    }
  ];

  assert.deepEqual(findExactUserMatches(users, ' 张三 '), [users[0]]);
  assert.deepEqual(findExactUserMatches(users, 'lisi@example.com'), [users[1]]);
  assert.deepEqual(findExactUserMatches(users, 'a001'), [users[0]]);
});

test('buildCreateIssueRequest maps create field values into ONES create payload', () => {
  assert.deepEqual(
    buildCreateIssueRequest({
      outputFieldUUIDPath: 'field200',
      targetIssueUUID: 'issue-1',
      targetFieldUUID: 'field200',
      targetFieldValueType: 'multi_reference_object',
      fieldWriteMode: 'set',
      fieldValues: [
        {
          fieldUUID: 'field006',
          value: 'project-1'
        },
        {
          fieldUUID: 'field007',
          value: 'issue-type-1'
        },
        {
          fieldUUID: 'field001',
          value: '补齐接口单测'
        },
        {
          fieldUUID: 'field004',
          value: 'user-1'
        },
        {
          fieldUUID: 'field008',
          value: ['user-2', 'user-3']
        },
        {
          fieldUUID: 'field014',
          value: 'parent-1'
        },
        {
          fieldUUID: 'field002',
          value: '这是描述'
        }
      ]
    }),
    {
      projectID: 'project-1',
      issueTypeID: 'issue-type-1',
      title: '补齐接口单测',
      assignee: 'user-1',
      watchers: ['user-2', 'user-3'],
      parentID: 'parent-1',
      fieldValues: [
        {
          fieldID: 'field002',
          value: '这是描述'
        }
      ]
    }
  );
});

test('buildCreateIssueRequest ignores displayId routing field', () => {
  assert.deepEqual(
    buildCreateIssueRequest({
      outputFieldUUIDPath: 'field200',
      targetIssueUUID: 'issue-1',
      targetFieldUUID: 'field200',
      targetFieldValueType: 'multi_reference_object',
      fieldWriteMode: 'set',
      fieldValues: [
        {
          fieldUUID: 'field903',
          value: 'PROJ-123'
        },
        {
          fieldUUID: 'field006',
          value: 'project-1'
        },
        {
          fieldUUID: 'field007',
          value: 'issue-type-1'
        },
        {
          fieldUUID: 'field001',
          value: '补齐接口单测'
        }
      ]
    }),
    {
      projectID: 'project-1',
      issueTypeID: 'issue-type-1',
      title: '补齐接口单测',
      assignee: undefined,
      watchers: undefined,
      parentID: undefined,
      fieldValues: undefined
    }
  );
});

test('isUserReferenceField recognizes assignee and member field types', () => {
  assert.equal(
    isUserReferenceField({
      fieldUUID: 'field004',
      fieldName: '负责人',
      fieldValueType: 'single_reference_object',
      fieldReferenceObjectType: null
    }),
    true
  );

  assert.equal(
    isUserReferenceField({
      fieldUUID: 'field-custom',
      fieldName: '关注人',
      fieldValueType: 'multi_reference_object',
      fieldReferenceObjectType: 'user'
    }),
    true
  );

  assert.equal(
    isUserReferenceField({
      fieldUUID: 'field-custom',
      fieldName: '创建者',
      fieldValueType: 'single_reference_object',
      fieldReferenceObjectType: 'user'
    }),
    true
  );

  assert.equal(
    isUserReferenceField({
      fieldUUID: 'field-status',
      fieldName: '状态',
      fieldValueType: 'single_reference_object',
      fieldReferenceObjectType: 'issue_status'
    }),
    false
  );
});

test('didIssueTriggerChange detects consumed trigger by status or assignee change', () => {
  assert.equal(
    didIssueTriggerChange(
      {
        statusUUID: 'status-a',
        assigneeUUID: 'user-a'
      },
      {
        statusUUID: 'status-b',
        assigneeUUID: 'user-a'
      }
    ),
    true
  );

  assert.equal(
    didIssueTriggerChange(
      {
        statusUUID: 'status-a',
        assigneeUUID: 'user-a'
      },
      {
        statusUUID: 'status-a',
        assigneeUUID: 'user-b'
      }
    ),
    true
  );

  assert.equal(
    didIssueTriggerChange(
      {
        statusUUID: 'status-a',
        assigneeUUID: 'user-a'
      },
      {
        statusUUID: 'status-a',
        assigneeUUID: 'user-a'
      }
    ),
    false
  );
});

test('shouldBlockAfterConsecutiveFailures blocks after one prior failure on same node', () => {
  assert.equal(
    shouldBlockAfterConsecutiveFailures('node-1', [
      {
        workflowNodeUUID: 'node-1',
        status: 'failure'
      }
    ]),
    true
  );

  assert.equal(
    shouldBlockAfterConsecutiveFailures('node-1', [
      {
        workflowNodeUUID: 'node-2',
        status: 'failure'
      },
      {
        workflowNodeUUID: 'node-1',
        status: 'failure'
      }
    ]),
    false
  );

  assert.equal(
    shouldBlockAfterConsecutiveFailures('node-1', [
      {
        workflowNodeUUID: 'node-1',
        status: 'success'
      },
      {
        workflowNodeUUID: 'node-1',
        status: 'failure'
      }
    ]),
    false
  );
});

test('selectNextDispatchableTask dispatches the latest created retry attempt', () => {
  const selected = selectNextDispatchableTask({
    agentExecutions: [
      {
        uuid: 'attempt-1',
        status: 'blocked'
      },
      {
        uuid: 'attempt-2',
        status: 'created'
      }
    ]
  } as any);

  assert.equal(selected?.uuid, 'attempt-2');
});

test('getExecutionStatus follows the latest attempt instead of historical blocked state', () => {
  const status = getExecutionStatus({
    agentExecutions: [
      {
        uuid: 'attempt-1',
        status: 'blocked'
      },
      {
        uuid: 'attempt-2',
        status: 'created'
      }
    ]
  } as any);

  assert.equal(status, 'created');
});

test('buildTaskStartedComment formats fixed start notification', () => {
  assert.equal(
    buildTaskStartedComment('代码助手'),
    '[代码助手] 已开始工作，稍后通知你结果。'
  );
});

test('buildTaskBlockedComment formats fixed blocked notification', () => {
  assert.equal(
    buildTaskBlockedComment('代码助手'),
    '[代码助手] 执行阻塞，联系管理员处理。'
  );
});

test('hasTaskCommentSinceQueuedAt matches same comment after queued time', () => {
  assert.equal(
    hasTaskCommentSinceQueuedAt(
      [
        {
          id: 'comment-1',
          text: '[代码助手] 已开始工作，稍后通知你结果。',
          createTime: '2026-06-26T10:00:05.000Z'
        }
      ],
      '[代码助手] 已开始工作，稍后通知你结果。',
      new Date('2026-06-26T10:00:00.000Z')
    ),
    true
  );
});

test('hasTaskStartedCommentSinceQueuedAt delegates to generic comment matcher', () => {
  assert.equal(
    hasTaskStartedCommentSinceQueuedAt(
      [
        {
          id: 'comment-1',
          text: '[代码助手] 已开始工作，稍后通知你结果。',
          createTime: '2026-06-26T10:00:05.000Z'
        }
      ],
      '[代码助手] 已开始工作，稍后通知你结果。',
      new Date('2026-06-26T10:00:00.000Z')
    ),
    true
  );
});

test('hasTaskCommentSinceQueuedAt matches numeric millisecond timestamps', () => {
  assert.equal(
    hasTaskCommentSinceQueuedAt(
      [
        {
          id: 'comment-1',
          text: '[代码助手] 已开始工作，稍后通知你结果。',
          createTime: '1782468005000'
        }
      ],
      '[代码助手] 已开始工作，稍后通知你结果。',
      new Date('2026-06-26T10:00:00.000Z')
    ),
    true
  );
});

test('hasTaskCommentSinceQueuedAt ignores comments before queued time', () => {
  assert.equal(
    hasTaskCommentSinceQueuedAt(
      [
        {
          id: 'comment-1',
          text: '[代码助手] 已开始工作，稍后通知你结果。',
          createTime: '2026-06-26T09:59:59.000Z'
        },
        {
          id: 'comment-2',
          text: '[别的代理] 已开始工作，稍后通知你结果。',
          createTime: '2026-06-26T10:00:10.000Z'
        }
      ],
      '[代码助手] 已开始工作，稍后通知你结果。',
      new Date('2026-06-26T10:00:00.000Z')
    ),
    false
  );
});

test('shouldSendTaskStartedComment only returns true for non-running to running transition', () => {
  assert.equal(shouldSendTaskStartedComment('queued', 'running'), true);
  assert.equal(shouldSendTaskStartedComment('running', 'running'), false);
  assert.equal(shouldSendTaskStartedComment('running', 'success'), false);
});

test('canRetryIssueAgentExecution only allows failure and blocked', () => {
  assert.equal(canRetryIssueAgentExecution('failure'), true);
  assert.equal(canRetryIssueAgentExecution('blocked'), true);
  assert.equal(canRetryIssueAgentExecution('created'), false);
  assert.equal(canRetryIssueAgentExecution('queued'), false);
  assert.equal(canRetryIssueAgentExecution('running'), false);
  assert.equal(canRetryIssueAgentExecution('success'), false);
});

test('isLatestIssueAgentExecution only allows the latest attempt', () => {
  const issueExecution = {
    agentExecutions: [
      {
        uuid: 'attempt-1',
        status: 'failure'
      },
      {
        uuid: 'attempt-2',
        status: 'blocked'
      }
    ]
  } as any;

  assert.equal(isLatestIssueAgentExecution(issueExecution, 'attempt-1'), false);
  assert.equal(isLatestIssueAgentExecution(issueExecution, 'attempt-2'), true);
});

test('isLatestDispatchedIssueExecution only allows the latest execution history', () => {
  assert.equal(
    isLatestDispatchedIssueExecution(
      {
        latestExecutionUUID: 'execution-2'
      },
      'execution-1'
    ),
    false
  );
  assert.equal(
    isLatestDispatchedIssueExecution(
      {
        latestExecutionUUID: 'execution-2'
      },
      'execution-2'
    ),
    true
  );
});

test('extractAgentClientTaskAttachments preserves uploaded file accessors', async () => {
  const formData = new FormData();
  const file = new File([Uint8Array.from([1, 2, 3])], 'report.txt', {
    type: 'text/plain'
  });

  formData.append('files', file);
  formData.append('localPaths', 'outputs/report.txt');

  const [attachment] = extractAgentClientTaskAttachments(formData);

  assert.equal(attachment?.localPath, 'outputs/report.txt');
  assert.equal(attachment?.name, 'report.txt');
  assert.equal(attachment?.type, 'text/plain');
  assert.deepEqual(
    Array.from(new Uint8Array(await attachment.arrayBuffer())),
    [1, 2, 3]
  );
});

test('buildIssueOutputWritePlan skips empty object outputs', async () => {
  const plan = await buildIssueOutputWritePlan(
    {
      agentUUID: 'agent-1',
      agentVersion: 1,
      executeOption: null,
      issueExecution: {
        dispatchedIssueUUID: 'issue-1'
      }
    } as any,
    [
      {
        mode: 'object_values',
        fieldUUIDPath: 'A2wqc8Kt',
        fieldWriteMode: null,
        objects: []
      }
    ],
    null,
    new Map([
      [
        'team-1:agent-1:1',
        {
          outputs: [
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
        }
      ]
    ]) as any,
    'team-1',
    {
      teamUUID: 'team-1',
      userUUID: 'user-1'
    }
  );

  assert.deepEqual(plan, {
    createRefObjectPlans: [],
    deferredIssueReferenceWrites: [],
    deferredIssueAttachmentFieldWrites: [],
    issueFieldValues: [],
    issueComments: [],
    issueAttachments: [],
    statusFieldValues: [],
    wikiWrites: []
  });
});

test('revision issue output rejects duplicate create', async () => {
  await assert.rejects(
    () =>
      buildIssueOutputWritePlan(
        {
          agentUUID: 'agent-1',
          agentVersion: 1,
          executeOption: {
            revisionContext: {
              currentOutputs: [
                {
                  fieldUUID: 'A2wqc8Kt',
                  value: { uuid: 'issue-existing', name: '已有缺陷' }
                }
              ]
            }
          },
          issueExecution: { dispatchedIssueUUID: 'issue-1' }
        } as unknown as Parameters<typeof buildIssueOutputWritePlan>[0],
        [
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
                fields: { field001: '重复缺陷' }
              }
            ]
          }
        ],
        null,
        new Map([
          [
            'team-1:agent-1:1',
            {
              outputs: [
                {
                  mode: 'set_value',
                  field: {
                    uuid: 'A2wqc8Kt',
                    name: '关联逃逸缺陷',
                    valueType: 'single_reference_object',
                    referenceObjectType: 'issue'
                  },
                  description: '更新已有缺陷',
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
            }
          ]
        ]) as unknown as Parameters<typeof buildIssueOutputWritePlan>[3],
        'team-1',
        { teamUUID: 'team-1', userUUID: 'user-1' }
      ),
    /must update an existing issue instead of creating a duplicate/u
  );
});

test('getTaskExecuteOptionMetadata treats field047 as attachment even without reference object type', () => {
  const metadata = getTaskExecuteOptionMetadata({
    outputs: [
      {
        mode: 'set_value',
        field: {
          uuid: 'field047',
          name: '附件',
          valueType: 'multi_reference_object',
          referenceObjectType: null
        },
        description: '顶层附件输出',
        subFields: []
      },
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
              uuid: 'field047',
              name: '附件',
              valueType: 'multi_reference_object',
              referenceObjectType: null
            },
            description: '上传新的附件',
            subFields: []
          }
        ]
      }
    ]
  } as any);

  assert.deepEqual(metadata, {
    outputPaths: ['field047', 'A2wqc8Kt'],
    attachmentOutputPaths: ['field047', 'A2wqc8Kt.field047']
  });
});

test('buildIssueOutputWritePlan treats field047 as attachment without reference object type', async () => {
  const plan = await buildIssueOutputWritePlan(
    {
      agentUUID: 'agent-1',
      agentVersion: 1,
      executeOption: null,
      issueExecution: {
        dispatchedIssueUUID: 'issue-1'
      }
    } as any,
    [
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
              field047: [
                {
                  objectType: 'attachment',
                  objectWriteMode: 'create',
                  objectUUID: null,
                  objectName: null,
                  fields: {
                    local_path: 'artifacts/report.md'
                  }
                }
              ]
            }
          }
        ]
      }
    ],
    [
      {
        outputName: 'A2wqc8Kt.field047',
        uploads: [
          {
            resourceToken: 'token-1',
            fileName: 'report.md',
            localPath: 'artifacts/report.md'
          }
        ]
      }
    ],
    new Map([
      [
        'team-1:agent-1:1',
        {
          outputs: [
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
                    uuid: 'field047',
                    name: '附件',
                    valueType: 'multi_reference_object',
                    referenceObjectType: null
                  },
                  description: '上传新的附件',
                  subFields: []
                }
              ]
            }
          ]
        }
      ]
    ]) as any,
    'team-1',
    {
      teamUUID: 'team-1',
      userUUID: 'user-1'
    }
  );

  assert.deepEqual(plan.createRefObjectPlans, [
    {
      outputFieldUUIDPath: 'A2wqc8Kt',
      targetIssueUUID: 'issue-1',
      targetFieldUUID: 'A2wqc8Kt',
      targetFieldValueType: 'single_reference_object',
      fieldWriteMode: 'set',
      fieldValues: [
        {
          fieldUUID: 'field001',
          value: '逃逸缺陷标题'
        }
      ]
    }
  ]);
  assert.deepEqual(plan.deferredIssueAttachmentFieldWrites, [
    {
      outputFieldUUIDPath: 'A2wqc8Kt.field047',
      targetFieldUUID: 'field047',
      targetFieldValueType: 'multi_reference_object',
      existingAttachmentUUIDs: [],
      uploads: [
        {
          resourceToken: 'token-1',
          fileName: 'report.md',
          localPath: 'artifacts/report.md'
        }
      ],
      createPlanIndex: 0
    }
  ]);
});

test('buildIssueOutputWritePlan keeps existing refs and deferred uploads on created issue attachment fields', async () => {
  const plan = await buildIssueOutputWritePlan(
    {
      agentUUID: 'agent-1',
      agentVersion: 1,
      executeOption: null,
      issueExecution: {
        dispatchedIssueUUID: 'issue-1'
      }
    } as any,
    [
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
              field006: [
                {
                  objectType: 'project',
                  objectWriteMode: null,
                  objectUUID: 'project-1',
                  objectName: '项目A',
                  fields: {}
                }
              ],
              field007: [
                {
                  objectType: 'issue_type',
                  objectWriteMode: null,
                  objectUUID: 'type-1',
                  objectName: '缺陷',
                  fields: {}
                }
              ],
              field047: [
                {
                  objectType: 'attachment',
                  objectWriteMode: null,
                  objectUUID: 'attachment-1',
                  objectName: 'prepare_branch.py',
                  fields: {}
                },
                {
                  objectType: 'attachment',
                  objectWriteMode: 'create',
                  objectUUID: null,
                  objectName: null,
                  fields: {
                    local_path: 'artifacts/report.md'
                  }
                }
              ]
            }
          }
        ]
      }
    ],
    [
      {
        outputName: 'A2wqc8Kt.field047',
        uploads: [
          {
            resourceToken: 'token-1',
            fileName: 'report.md',
            localPath: 'artifacts/report.md'
          }
        ]
      }
    ],
    new Map([
      [
        'team-1:agent-1:1',
        {
          outputs: [
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
                    uuid: 'field006',
                    name: '所属项目',
                    valueType: 'single_reference_object',
                    referenceObjectType: 'project'
                  },
                  description: '所属项目',
                  subFields: []
                },
                {
                  mode: 'set_value',
                  field: {
                    uuid: 'field007',
                    name: '工作项类型',
                    valueType: 'single_reference_object',
                    referenceObjectType: 'issue_type'
                  },
                  description: '工作项类型',
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
                  description: '引用已有附件',
                  subFields: []
                }
              ]
            }
          ]
        }
      ]
    ]) as any,
    'team-1',
    {
      teamUUID: 'team-1',
      userUUID: 'user-1'
    }
  );

  assert.deepEqual(plan.createRefObjectPlans, [
    {
      outputFieldUUIDPath: 'A2wqc8Kt',
      targetIssueUUID: 'issue-1',
      targetFieldUUID: 'A2wqc8Kt',
      targetFieldValueType: 'single_reference_object',
      fieldWriteMode: 'set',
      fieldValues: [
        {
          fieldUUID: 'field001',
          value: '逃逸缺陷标题'
        },
        {
          fieldUUID: 'field006',
          value: 'project-1'
        },
        {
          fieldUUID: 'field007',
          value: 'type-1'
        },
        {
          fieldUUID: 'field047',
          value: ['attachment-1']
        }
      ]
    }
  ]);
  assert.deepEqual(plan.deferredIssueAttachmentFieldWrites, [
    {
      outputFieldUUIDPath: 'A2wqc8Kt.field047',
      targetFieldUUID: 'field047',
      targetFieldValueType: 'multi_reference_object',
      existingAttachmentUUIDs: ['attachment-1'],
      uploads: [
        {
          resourceToken: 'token-1',
          fileName: 'report.md',
          localPath: 'artifacts/report.md'
        }
      ],
      createPlanIndex: 0
    }
  ]);
});

test('buildIssueOutputWritePlan consumes nested attachment uploads in object order', async () => {
  const plan = await buildIssueOutputWritePlan(
    {
      agentUUID: 'agent-1',
      agentVersion: 1,
      executeOption: null,
      issueExecution: {
        dispatchedIssueUUID: 'issue-1'
      }
    } as any,
    [
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
              field001: '逃逸缺陷标题1',
              field006: [
                {
                  objectType: 'project',
                  objectWriteMode: null,
                  objectUUID: 'project-1',
                  objectName: '项目A',
                  fields: {}
                }
              ],
              field007: [
                {
                  objectType: 'issue_type',
                  objectWriteMode: null,
                  objectUUID: 'type-1',
                  objectName: '缺陷',
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
                    local_path: 'artifacts/report-1.md'
                  }
                }
              ]
            }
          },
          {
            objectType: 'issue',
            objectWriteMode: 'create',
            objectUUID: null,
            objectName: null,
            fields: {
              field001: '逃逸缺陷标题2',
              field006: [
                {
                  objectType: 'project',
                  objectWriteMode: null,
                  objectUUID: 'project-1',
                  objectName: '项目A',
                  fields: {}
                }
              ],
              field007: [
                {
                  objectType: 'issue_type',
                  objectWriteMode: null,
                  objectUUID: 'type-1',
                  objectName: '缺陷',
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
                    local_path: 'artifacts/report-2.md'
                  }
                }
              ]
            }
          }
        ]
      }
    ],
    [
      {
        outputName: 'A2wqc8Kt.field047',
        uploads: [
          {
            resourceToken: 'token-1',
            fileName: 'report-1.md',
            localPath: 'artifacts/report-1.md'
          },
          {
            resourceToken: 'token-2',
            fileName: 'report-2.md',
            localPath: 'artifacts/report-2.md'
          }
        ]
      }
    ],
    new Map([
      [
        'team-1:agent-1:1',
        {
          outputs: [
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
                    uuid: 'field006',
                    name: '所属项目',
                    valueType: 'single_reference_object',
                    referenceObjectType: 'project'
                  },
                  description: '所属项目',
                  subFields: []
                },
                {
                  mode: 'set_value',
                  field: {
                    uuid: 'field007',
                    name: '工作项类型',
                    valueType: 'single_reference_object',
                    referenceObjectType: 'issue_type'
                  },
                  description: '工作项类型',
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
                  description: '上传新的附件',
                  subFields: []
                }
              ]
            }
          ]
        }
      ]
    ]) as any,
    'team-1',
    {
      teamUUID: 'team-1',
      userUUID: 'user-1'
    }
  );

  assert.deepEqual(plan.deferredIssueAttachmentFieldWrites, [
    {
      outputFieldUUIDPath: 'A2wqc8Kt.field047',
      targetFieldUUID: 'field047',
      targetFieldValueType: 'multi_reference_object',
      existingAttachmentUUIDs: [],
      uploads: [
        {
          resourceToken: 'token-1',
          fileName: 'report-1.md',
          localPath: 'artifacts/report-1.md'
        }
      ],
      createPlanIndex: 0
    },
    {
      outputFieldUUIDPath: 'A2wqc8Kt.field047',
      targetFieldUUID: 'field047',
      targetFieldValueType: 'multi_reference_object',
      existingAttachmentUUIDs: [],
      uploads: [
        {
          resourceToken: 'token-2',
          fileName: 'report-2.md',
          localPath: 'artifacts/report-2.md'
        }
      ],
      createPlanIndex: 1
    }
  ]);
});
