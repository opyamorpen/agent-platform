import type {
  AgentConfig,
  AgentInput,
  AgentOutputField,
  AgentOutputSetValueField
} from '@ones-ai-workflow/shared';
import { AGENT_PROMPT_TEMPLATE } from './prompt-template.generated.js';

const READABLE_ENV_POLICY_BLOCK_PLACEHOLDER = '{{READABLE_ENV_POLICY_BLOCK}}';
const INPUT_CONTEXT_XML_PLACEHOLDER = '{{INPUT_CONTEXT_XML}}';
const OUTPUT_TEMPLATE_XML_PLACEHOLDER = '{{OUTPUT_TEMPLATE_XML}}';
const TASK_PROMPT_PLACEHOLDER = '{{TASK_PROMPT}}';

const ISSUE_ASSIGNEE_FIELD_UUID = 'field004';
const ISSUE_STATUS_FIELD_UUID = 'field005';
const ISSUE_PROJECT_FIELD_UUID = 'field006';
const ISSUE_TYPE_FIELD_UUID = 'field007';
const PARENT_ISSUE_FIELD_UUID = 'field014';
const ISSUE_COMMENT_FIELD_UUID = 'field057';
const ISSUE_ATTACHMENT_FIELD_UUID = 'field047';

export interface AgentInputContextEntry {
  fieldUUID: string;
  fieldName: string;
  fieldValueType: string;
  fieldReferenceObjectType?: string | null;
  description: string;
  value: unknown;
}

export interface AgentInputContextObject {
  objectType: string;
  objectUUID: string;
  objectName: string;
  fields: AgentInputContextEntry[];
}

type AgentInputObjectValue = {
  objectType?: string;
  uuid: string;
  name: string;
  fields?: AgentInputContextEntry[];
};

function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapXmlCdata(value: string): string {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function renderScalarXmlValue(value: string): string {
  return /[&<>"']/.test(value) ? wrapXmlCdata(value) : escapeXmlText(value);
}

function sanitizeXmlCommentText(value: string): string {
  return value.replaceAll('-->', '--&gt;').replace(/\s+/g, ' ').trim();
}

function inferObjectTypeFromField(field: {
  uuid: string;
  referenceObjectType?: string | null;
}): string {
  if (field.uuid === ISSUE_COMMENT_FIELD_UUID) {
    return 'comment';
  }

  if (field.referenceObjectType?.trim()) {
    return field.referenceObjectType;
  }

  if (field.uuid === ISSUE_ASSIGNEE_FIELD_UUID) {
    return 'user';
  }

  if (field.uuid === ISSUE_STATUS_FIELD_UUID) {
    return 'issue_status';
  }

  if (field.uuid === ISSUE_PROJECT_FIELD_UUID) {
    return 'project';
  }

  if (field.uuid === ISSUE_TYPE_FIELD_UUID) {
    return 'issue_type';
  }

  if (field.uuid === PARENT_ISSUE_FIELD_UUID) {
    return 'issue';
  }

  return 'object';
}

function isReferenceObjectValueType(valueType: string): boolean {
  return (
    valueType === 'single_reference_object' ||
    valueType === 'multi_reference_object'
  );
}

function isCommentObjectField(field: {
  uuid: string;
  referenceObjectType?: string | null;
}): boolean {
  return (
    field.uuid === ISSUE_COMMENT_FIELD_UUID ||
    field.referenceObjectType === 'comment'
  );
}

function isAttachmentObjectField(field: {
  uuid: string;
  referenceObjectType?: string | null;
}): boolean {
  return (
    field.uuid === ISSUE_ATTACHMENT_FIELD_UUID ||
    field.referenceObjectType === 'attachment'
  );
}

function supportsFieldWriteMode(field: AgentOutputField): boolean {
  if (field.kind === 'wiki_page') {
    return false;
  }

  return (
    field.field.valueType === 'multi_reference_object' &&
    !isCommentObjectField(field.field) &&
    !isAttachmentObjectField(field.field)
  );
}

function isReferenceObjectOutputField(field: AgentOutputField): boolean {
  if (field.kind === 'wiki_page') {
    return false;
  }

  return (
    isReferenceObjectValueType(field.field.valueType) ||
    isCommentObjectField(field.field) ||
    isAttachmentObjectField(field.field)
  );
}

function getAgentInputPreviewFields(
  fields: AgentInput[]
): AgentInputContextEntry[] {
  return fields.map((field) => {
    if (field.subFields.length === 0) {
      return {
        fieldUUID: field.field.uuid,
        fieldName: field.field.name,
        fieldValueType: field.field.valueType,
        fieldReferenceObjectType: field.field.referenceObjectType,
        description: field.description,
        value: 'Runtime value'
      };
    }

    return {
      fieldUUID: field.field.uuid,
      fieldName: field.field.name,
      fieldValueType: field.field.valueType,
      fieldReferenceObjectType: field.field.referenceObjectType,
      description: field.description,
      value: {
        objectType: inferObjectTypeFromField(field.field),
        uuid: 'Runtime value',
        name: 'Runtime value',
        fields: getAgentInputPreviewFields(field.subFields)
      }
    };
  });
}

function isInputObjectLike(value: unknown): value is AgentInputObjectValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { uuid?: unknown }).uuid === 'string' &&
    typeof (value as { name?: unknown }).name === 'string' &&
    ((value as { objectType?: unknown }).objectType === undefined ||
      typeof (value as { objectType?: unknown }).objectType === 'string') &&
    ((value as { fields?: unknown }).fields === undefined ||
      (Array.isArray((value as { fields?: unknown }).fields) &&
        (value as { fields: AgentInputContextEntry[] }).fields.every(
          (field) => typeof field === 'object' && field !== null
        )))
  );
}

function renderInputObjectLines(
  value: AgentInputObjectValue,
  fallbackObjectType: string
): string[] {
  const objectType = value.objectType?.trim() || fallbackObjectType;
  const nestedFields = value.fields ?? [];

  return [
    '<object>',
    `  <object-type>${escapeXmlText(objectType)}</object-type>`,
    `  <object-uuid>${escapeXmlText(value.uuid)}</object-uuid>`,
    `  <object-name>${escapeXmlText(value.name)}</object-name>`,
    ...(nestedFields.length > 0
      ? [
          '  <fields>',
          ...nestedFields.flatMap((field) =>
            renderInputFieldLines(field).map((line) => `    ${line}`)
          ),
          '  </fields>'
        ]
      : []),
    '</object>'
  ];
}

function renderFieldValueLines(
  value: unknown,
  fallbackObjectType: string | null
): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (isInputObjectLike(value)) {
    return renderInputObjectLines(value, fallbackObjectType ?? 'object');
  }

  if (Array.isArray(value)) {
    const nonNullItems = value.filter(
      (item) => item !== null && item !== undefined
    );

    if (nonNullItems.every((item) => isInputObjectLike(item))) {
      return nonNullItems.flatMap((item) =>
        renderInputObjectLines(item, fallbackObjectType ?? 'object')
      );
    }

    return nonNullItems.map(
      (item) => `<value>${renderScalarXmlValue(String(item))}</value>`
    );
  }

  return [renderScalarXmlValue(String(value))];
}

export function buildAgentInputContextXml(
  input: AgentInputContextObject
): string {
  return [
    '<input>',
    '  <object>',
    `    <object-type>${escapeXmlText(input.objectType)}</object-type>`,
    `    <object-uuid>${escapeXmlText(input.objectUUID)}</object-uuid>`,
    `    <object-name>${escapeXmlText(input.objectName)}</object-name>`,
    '    <fields>',
    ...input.fields.flatMap((field) =>
      renderInputFieldLines(field).map((line) => `      ${line}`)
    ),
    '    </fields>',
    '  </object>',
    '</input>'
  ].join('\n');
}

function buildPreviewAgentInputContextXml(fields: AgentInput[]): string {
  return buildAgentInputContextXml({
    objectType: 'issue',
    objectUUID: 'Runtime value',
    objectName: 'Runtime value',
    fields: getAgentInputPreviewFields(fields)
  });
}

function renderInputFieldLines(field: AgentInputContextEntry): string[] {
  const description =
    field.description.trim() || 'No field description provided';
  const fieldValueLines = renderFieldValueLines(
    field.value,
    field.fieldReferenceObjectType ?? null
  );
  const fieldValueBlock =
    fieldValueLines.length === 0
      ? ['  <field-value></field-value>']
      : fieldValueLines.length === 1 &&
          (!fieldValueLines[0]?.startsWith('<') ||
            fieldValueLines[0]?.startsWith('<![CDATA['))
        ? [`  <field-value>${fieldValueLines[0]}</field-value>`]
        : [
            '  <field-value>',
            ...fieldValueLines.map((line) => `    ${line}`),
            '  </field-value>'
          ];

  return [
    '<field>',
    `  <field-uuid>${escapeXmlText(field.fieldUUID)}</field-uuid>`,
    `  <field-name>${escapeXmlText(field.fieldName)}</field-name>`,
    `  <field-value-type>${escapeXmlText(field.fieldValueType)}</field-value-type>`,
    ...(field.fieldReferenceObjectType
      ? [
          `  <field-reference-object-type>${escapeXmlText(field.fieldReferenceObjectType)}</field-reference-object-type>`
        ]
      : []),
    `  <field-description>${escapeXmlText(description)}</field-description>`,
    ...fieldValueBlock,
    '</field>'
  ];
}

function renderReferenceFieldObjectTemplateLines(
  field: AgentOutputSetValueField,
  indent: string
): string[] {
  const objectType = inferObjectTypeFromField(field.field);

  if (isCommentObjectField(field.field)) {
    return [
      `${indent}<!-- If no object needs to be created for this field in this run, output <objects /> instead of omitting the entire <output> -->`,
      `${indent}<objects>`,
      `${indent}  <object>`,
      `${indent}    <object-write-mode>create</object-write-mode>`,
      `${indent}    <object-type>comment</object-type>`,
      `${indent}    <fields>`,
      `${indent}      <field>`,
      `${indent}        <field-uuid>content</field-uuid>`,
      `${indent}        <field-name>Content</field-name>`,
      `${indent}        <field-value-type>richtext</field-value-type>`,
      `${indent}        <field-description>Comment body.</field-description>`,
      `${indent}        <set-value></set-value>`,
      `${indent}      </field>`,
      `${indent}    </fields>`,
      `${indent}  </object>`,
      `${indent}</objects>`
    ];
  }

  if (isAttachmentObjectField(field.field)) {
    return [
      `${indent}<!-- If no object needs to be created for this field in this run, output <objects /> instead of omitting the entire <output> -->`,
      `${indent}<!-- For a new upload, use object-write-mode=create with local_path. To reuse an existing attachment, fill object-uuid or object-name and do not include local_path -->`,
      `${indent}<objects>`,
      `${indent}  <object>`,
      `${indent}    <object-write-mode>create</object-write-mode>`,
      `${indent}    <object-type>attachment</object-type>`,
      `${indent}    <fields>`,
      `${indent}      <field>`,
      `${indent}        <field-uuid>local_path</field-uuid>`,
      `${indent}        <field-name>Local path</field-name>`,
      `${indent}        <field-value-type>text</field-value-type>`,
      `${indent}        <field-description>Workspace-relative path used to upload this attachment.</field-description>`,
      `${indent}        <set-value></set-value>`,
      `${indent}      </field>`,
      `${indent}    </fields>`,
      `${indent}  </object>`,
      `${indent}</objects>`
    ];
  }

  if (field.subFields.length === 0) {
    return [
      `${indent}<!-- If no object needs to be selected for this field in this run, output <objects /> instead of omitting the entire <output> -->`,
      `${indent}<objects>`,
      `${indent}  <object>`,
      `${indent}    <object-type>${escapeXmlText(objectType)}</object-type>`,
      `${indent}    <object-uuid></object-uuid>`,
      `${indent}    <object-name></object-name>`,
      `${indent}  </object>`,
      `${indent}</objects>`
    ];
  }

  return [
    `${indent}<!-- If no object needs to be created or updated for this field in this run, output <objects /> instead of omitting the entire <output> -->`,
    `${indent}<objects>`,
    `${indent}  <object>`,
    `${indent}    <!-- Choose create or update according to field-description -->`,
    `${indent}    <object-write-mode></object-write-mode>`,
    `${indent}    <!-- Fill only for update -->`,
    `${indent}    <object-uuid></object-uuid>`,
    `${indent}    <object-name></object-name>`,
    `${indent}    <object-type>${escapeXmlText(objectType)}</object-type>`,
    `${indent}    <fields>`,
    ...field.subFields.flatMap((subField) => {
      const entryDescription = sanitizeXmlCommentText(
        subField.description.trim() || 'No field description provided'
      );

      return [
        `${indent}      <field>`,
        `${indent}        <field-uuid>${escapeXmlText(subField.field.uuid)}</field-uuid>`,
        `${indent}        <field-name>${escapeXmlText(subField.field.name)}</field-name>`,
        `${indent}        <field-value-type>${escapeXmlText(subField.field.valueType)}</field-value-type>`,
        ...(subField.field.referenceObjectType
          ? [
              `${indent}        <field-reference-object-type>${escapeXmlText(subField.field.referenceObjectType)}</field-reference-object-type>`
            ]
          : []),
        `${indent}        <field-description>${escapeXmlText(entryDescription)}</field-description>`,
        ...(isReferenceObjectOutputField(subField)
          ? renderReferenceFieldObjectTemplateLines(
              subField,
              `${indent}        `
            )
          : [`${indent}        <set-value></set-value>`]),
        `${indent}      </field>`
      ];
    }),
    `${indent}    </fields>`,
    `${indent}  </object>`,
    `${indent}</objects>`
  ];
}

function buildAgentOutputTemplateXml(
  fields: AgentOutputField[],
  revisionMode: boolean
): string {
  const revisionSummaryLines = revisionMode
    ? [
        '  <!-- Required for revision runs. Describe actual changes made compared with the previous iteration; do not merely repeat the review feedback. -->',
        '  <revision-summary>',
        '    <summary><![CDATA[]]></summary>',
        '    <changes>',
        '      <change><![CDATA[]]></change>',
        '    </changes>',
        '  </revision-summary>'
      ]
    : [];

  return fields.length === 0
    ? ['<outputs>', ...revisionSummaryLines, '</outputs>'].join('\n')
    : [
        '<outputs>',
        ...revisionSummaryLines,
        ...fields.flatMap((field) => {
          const description = sanitizeXmlCommentText(
            field.description.trim() || 'No field description provided'
          );

          if (field.kind === 'wiki_page') {
            const configuredWriteTarget = field.writeTarget
              ? [
                  '    <configured-write-target>',
                  '      <target-type>space</target-type>',
                  `      <space-uuid>${escapeXmlText(field.writeTarget.spaceUUID)}</space-uuid>`,
                  `      <space-name>${escapeXmlText(field.writeTarget.spaceName)}</space-name>`,
                  '    </configured-write-target>'
                ]
              : [];
            const createTargetFields = field.writeTarget
              ? []
              : [
                  '      <parent-page-uuid></parent-page-uuid>',
                  '      <space-uuid></space-uuid>'
                ];
            return [
              '  <output>',
              `    <field-uuid>${escapeXmlText(field.field.uuid)}</field-uuid>`,
              `    <field-name>${escapeXmlText(field.field.name)}</field-name>`,
              '    <field-value-type>wiki_page</field-value-type>',
              `    <field-description>${escapeXmlText(description)}</field-description>`,
              ...configuredWriteTarget,
              field.writeTarget
                ? '    <!-- Emit exactly one action: create, replace, or append. Create always uses the configured write target; do not invent a parent page or space UUID. -->'
                : '    <!-- Emit exactly one action: create, replace, or append. Prefer UUID. Name lookup is restricted and ambiguous names are rejected. -->',
              '    <wiki-action>',
              '      <action></action>',
              '      <target-page-uuid></target-page-uuid>',
              '      <target-page-name></target-page-name>',
              ...createTargetFields,
              '      <title></title>',
              '      <markdown><![CDATA[]]></markdown>',
              '    </wiki-action>',
              '  </output>'
            ];
          }

          return [
            '  <output>',
            `    <field-uuid>${escapeXmlText(field.field.uuid)}</field-uuid>`,
            `    <field-name>${escapeXmlText(field.field.name)}</field-name>`,
            `    <field-value-type>${escapeXmlText(field.field.valueType)}</field-value-type>`,
            ...(field.field.referenceObjectType
              ? [
                  `    <field-reference-object-type>${escapeXmlText(field.field.referenceObjectType)}</field-reference-object-type>`
                ]
              : []),
            `    <field-description>${escapeXmlText(description)}</field-description>`,
            ...(supportsFieldWriteMode(field)
              ? [
                  '    <!-- Only multi_reference_object supports set or append. Leave empty to use the default: set -->',
                  '    <field-write-mode></field-write-mode>'
                ]
              : []),
            ...(isReferenceObjectOutputField(field)
              ? renderReferenceFieldObjectTemplateLines(field, '    ')
              : ['    <set-value></set-value>']),
            '  </output>'
          ];
        }),
        '</outputs>'
      ].join('\n');
}

function normalizeReadableEnvKeys(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function buildReadableEnvPolicyBlock(readableEnvKeys: string[]): string {
  if (readableEnvKeys.length === 0) {
    return '2. No environment variables are authorized for access in the current run. All environment variables are forbidden to read, use, or output.';
  }

  return [
    `2. Exception: the following system-injected environment variables may be read and used when needed: ${readableEnvKeys.join(', ')}.`,
    '3. For the environment variables above, you may use them only as runtime credentials. Do not print, restate, or leak their values in any output, including final answers, intermediate logs, command output, file content, code comments, commit messages, or error messages. If you need to refer to them, mention only the key name, never the value.',
    '4. Any environment variable not listed above remains forbidden to read, use, or output.'
  ].join('\n');
}

function buildAcceptancePolicyXml(
  policy: AgentConfig['acceptancePolicy'] | undefined
): string {
  const criteria = policy?.criteria ?? [];

  return [
    '<acceptance-policy>',
    `  <knowledge-requirement>${policy?.knowledgeRequirement === 'required' ? 'required' : 'optional'}</knowledge-requirement>`,
    '  <criteria>',
    ...criteria.flatMap((criterion) => [
      '    <criterion>',
      `      <criterion-uuid>${escapeXmlText(criterion.uuid)}</criterion-uuid>`,
      `      <criterion-name>${escapeXmlText(criterion.name)}</criterion-name>`,
      `      <criterion-description>${wrapXmlCdata(criterion.description)}</criterion-description>`,
      '    </criterion>'
    ]),
    '  </criteria>',
    '</acceptance-policy>'
  ].join('\n');
}

export function buildAgentPrompt(
  config: Pick<
    AgentConfig,
    'description' | 'inputs' | 'outputs' | 'prompt' | 'acceptancePolicy'
  >,
  options: {
    inputContextXml?: string;
    wikiInputsXml?: string;
    knowledgeContextXml?: string;
    revisionContextXml?: string;
    loopContextXml?: string;
    readableEnvKeys?: string[];
  } = {}
): string {
  const revisionContextXml =
    options.revisionContextXml?.trim() ||
    '<revision-context><mode>initial</mode></revision-context>';
  const revisionMode = /<mode>\s*revision\s*<\/mode>/u.test(revisionContextXml);

  return AGENT_PROMPT_TEMPLATE.replace(
    READABLE_ENV_POLICY_BLOCK_PLACEHOLDER,
    buildReadableEnvPolicyBlock(
      normalizeReadableEnvKeys(options.readableEnvKeys)
    )
  )
    .replace(
      INPUT_CONTEXT_XML_PLACEHOLDER,
      [
        options.inputContextXml?.trim() ||
          buildPreviewAgentInputContextXml(config.inputs),
        options.wikiInputsXml?.trim() || '<wiki-inputs />',
        options.knowledgeContextXml?.trim() || '<knowledge-context />',
        revisionContextXml,
        buildAcceptancePolicyXml(config.acceptancePolicy),
        options.loopContextXml?.trim() ||
          '<loop-context><mode>initial</mode></loop-context>'
      ]
        .join('\n\n')
        .trim()
    )
    .replace(
      OUTPUT_TEMPLATE_XML_PLACEHOLDER,
      buildAgentOutputTemplateXml(config.outputs, revisionMode)
    )
    .replace(
      TASK_PROMPT_PLACEHOLDER,
      config.prompt.trim() || 'No prompt provided'
    );
}
