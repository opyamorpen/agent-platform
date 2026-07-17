import type { AgentOutputField, AgentOutputSetValueField } from './types.js';

const ISSUE_COMMENT_FIELD_UUID = 'field057';
const ISSUE_ATTACHMENT_FIELD_UUID = 'field047';
const MAX_REVISION_SUMMARY_CHARS = 500;
const MAX_REVISION_CHANGE_COUNT = 5;
const MAX_REVISION_CHANGE_CHARS = 500;
const MAX_REVISION_SUMMARY_BYTES = 4 * 1024;

type ObjectSubFieldConfig = {
  kind?: 'issue_field';
  mode: 'set_value';
  field: AgentOutputSetValueField['field'];
  description: string;
  subFields: AgentOutputSetValueField[];
};

type ParsedFieldWriteMode = 'set' | 'append' | null;

type XmlTagBounds = {
  innerContent: string;
  outerStart: number;
  outerEnd: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findXmlTagBounds(
  source: string,
  tagName: string,
  fromIndex = 0
): XmlTagBounds | null {
  const escapedTagName = escapeRegExp(tagName);
  const openTagPattern = new RegExp(
    `<${escapedTagName}(?:\\s*\\/\\s*>|>)`,
    'g'
  );
  openTagPattern.lastIndex = fromIndex;

  const openTagMatch = openTagPattern.exec(source);

  if (!openTagMatch) {
    return null;
  }

  const openTag = openTagMatch[0];
  const innerStart = openTagMatch.index + openTag.length;

  if (/\/\s*>$/.test(openTag)) {
    return {
      innerContent: '',
      outerStart: openTagMatch.index,
      outerEnd: innerStart
    };
  }

  const tagTokenPattern = new RegExp(
    `<${escapedTagName}(?:\\s*\\/\\s*>|>)|</${escapedTagName}>`,
    'g'
  );
  tagTokenPattern.lastIndex = innerStart;
  let depth = 1;

  while (true) {
    const tagTokenMatch = tagTokenPattern.exec(source);

    if (!tagTokenMatch) {
      return null;
    }

    const tagToken = tagTokenMatch[0];

    if (tagToken.startsWith('</')) {
      depth -= 1;

      if (depth === 0) {
        return {
          innerContent: source.slice(innerStart, tagTokenMatch.index).trim(),
          outerStart: openTagMatch.index,
          outerEnd: tagTokenMatch.index + tagToken.length
        };
      }

      continue;
    }

    if (!/\/\s*>$/.test(tagToken)) {
      depth += 1;
    }
  }
}

function collectXmlTagContents(source: string, tagName: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;

  while (true) {
    const bounds = findXmlTagBounds(source, tagName, cursor);

    if (!bounds) {
      return blocks;
    }

    blocks.push(bounds.innerContent);
    cursor = bounds.outerEnd;
  }
}

function parseXmlTagContent(source: string, tagName: string): string | null {
  return findXmlTagBounds(source, tagName)?.innerContent ?? null;
}

function unwrapCdataIfPresent(value: string): string {
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? (cdataMatch[1] ?? '') : value;
}

function isReferenceValueType(valueType: string): boolean {
  return (
    valueType === 'single_reference_object' ||
    valueType === 'multi_reference_object'
  );
}

function isCommentObjectField(field: AgentOutputField['field']): boolean {
  return (
    field.uuid === ISSUE_COMMENT_FIELD_UUID ||
    field.referenceObjectType === 'comment'
  );
}

function isAttachmentObjectField(field: AgentOutputField['field']): boolean {
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

function usesObjectOutput(field: AgentOutputField): boolean {
  if (field.kind === 'wiki_page') {
    return false;
  }

  return (
    isReferenceValueType(field.field.valueType) ||
    isCommentObjectField(field.field) ||
    isAttachmentObjectField(field.field)
  );
}

function getAllowedSubFields(
  field: AgentOutputField
): Map<string, ObjectSubFieldConfig> {
  if (field.kind === 'wiki_page') {
    return new Map();
  }

  if (isCommentObjectField(field.field)) {
    return new Map([
      [
        'content',
        {
          mode: 'set_value',
          field: {
            uuid: 'content',
            name: '内容',
            valueType: 'richtext',
            referenceObjectType: null
          },
          description: '评论正文。',
          subFields: []
        }
      ]
    ]);
  }

  if (isAttachmentObjectField(field.field)) {
    return new Map([
      [
        'local_path',
        {
          mode: 'set_value',
          field: {
            uuid: 'local_path',
            name: '本地路径',
            valueType: 'text',
            referenceObjectType: null
          },
          description: '工作区相对路径，用于上传该附件。',
          subFields: []
        }
      ]
    ]);
  }

  return new Map(
    field.subFields.map(
      (subField) => [subField.field.uuid.trim(), subField] as const
    )
  );
}

function parseObjectType(
  source: string,
  fallbackObjectType: string | null
): string {
  const objectType =
    parseXmlTagContent(source, 'object-type') ?? fallbackObjectType;

  if (!objectType) {
    throw new Error('Missing <object-type> in <object> block');
  }

  return objectType;
}

function parseOutputFieldEntryValue(
  fieldBlock: string,
  fieldConfig: ObjectSubFieldConfig
): ParsedAgentObjectFieldValue {
  if (usesObjectOutput(fieldConfig)) {
    return parseObjectCollection(
      fieldBlock,
      fieldConfig,
      `field "${fieldConfig.field.uuid}"`
    );
  }

  const childFieldValue = parseXmlTagContent(fieldBlock, 'set-value');

  if (childFieldValue === null) {
    throw new Error(
      `Missing <set-value> for child field "${fieldConfig.field.uuid}"`
    );
  }

  return unwrapCdataIfPresent(childFieldValue);
}

function parseObjectFields(
  fieldValuesContent: string,
  fieldConfig: AgentOutputField
): Record<string, ParsedAgentObjectFieldValue> {
  const allowedSubFields = getAllowedSubFields(fieldConfig);
  const fieldValues: Record<string, ParsedAgentObjectFieldValue> = {};
  const fieldBlocks = collectXmlTagContents(fieldValuesContent, 'field');

  for (const fieldBlock of fieldBlocks) {
    const childFieldUUID = parseXmlTagContent(fieldBlock, 'field-uuid');

    if (!childFieldUUID) {
      throw new Error(
        `Missing <field-uuid> in <fields> for output field "${fieldConfig.field.uuid}"`
      );
    }

    const allowedSubField = allowedSubFields.get(childFieldUUID);

    if (!allowedSubField) {
      throw new Error(
        `Unknown child field "${childFieldUUID}" for output field "${fieldConfig.field.uuid}"`
      );
    }

    if (childFieldUUID in fieldValues) {
      throw new Error(
        `Duplicated child field "${childFieldUUID}" for output field "${fieldConfig.field.uuid}"`
      );
    }

    fieldValues[childFieldUUID] = parseOutputFieldEntryValue(
      fieldBlock,
      allowedSubField
    );
  }

  return fieldValues;
}

function parseObjectCollection(
  source: string,
  fieldConfig: AgentOutputField,
  contextLabel: string
): ParsedAgentOutputObject[] {
  const objectsContent = parseXmlTagContent(source, 'objects');

  if (objectsContent === null) {
    throw new Error(`Missing <objects> for ${contextLabel}`);
  }

  const objects = collectXmlTagContents(objectsContent, 'object').map(
    (objectBlock) => {
      const fieldsBounds = findXmlTagBounds(objectBlock, 'fields');
      const objectHeaderContent =
        fieldsBounds === null
          ? objectBlock
          : objectBlock.slice(0, fieldsBounds.outerStart).trim();
      const objectType = parseObjectType(
        objectHeaderContent,
        fieldConfig.field.referenceObjectType ?? null
      );
      const rawObjectWriteMode = parseXmlTagContent(
        objectHeaderContent,
        'object-write-mode'
      );
      const objectWriteMode: 'create' | 'update' | null =
        rawObjectWriteMode === 'create' || rawObjectWriteMode === 'update'
          ? rawObjectWriteMode
          : null;
      const objectUUID = parseXmlTagContent(objectHeaderContent, 'object-uuid');
      const objectName = parseXmlTagContent(objectHeaderContent, 'object-name');
      const fieldsContent = fieldsBounds?.innerContent ?? null;
      const requiresFields = getAllowedSubFields(fieldConfig).size > 0;
      const isAttachmentObject = isAttachmentObjectField(fieldConfig.field);

      if (
        requiresFields &&
        fieldsContent === null &&
        (!isAttachmentObject || (!objectUUID && !objectName))
      ) {
        throw new Error(`Missing <fields> in <object> for ${contextLabel}`);
      }

      return {
        objectType,
        objectWriteMode,
        objectUUID: objectUUID || null,
        objectName: objectName || null,
        fields:
          fieldsContent === null
            ? {}
            : parseObjectFields(fieldsContent, fieldConfig)
      };
    }
  );

  if (
    fieldConfig.field.valueType === 'single_reference_object' &&
    objects.length > 1
  ) {
    throw new Error(
      `Field "${fieldConfig.field.uuid}" expects at most one <object>`
    );
  }

  return objects;
}

export function parseAgentOutputString(
  outputText: string,
  fields: AgentOutputField[]
): ParsedAgentOutput[] {
  const outputsContent = parseXmlTagContent(outputText, 'outputs');

  if (outputsContent === null) {
    if (fields.length === 0) {
      return [];
    }

    throw new Error('Missing <outputs> block');
  }

  const allowedFields = new Map(
    fields.map((field) => [field.field.uuid, field] as const)
  );
  const result: ParsedAgentOutput[] = [];
  const seenFieldUUIDPaths = new Set<string>();
  const outputBlocks = collectXmlTagContents(outputsContent, 'output');

  for (const outputBlock of outputBlocks) {
    const fieldUUIDPath = parseXmlTagContent(outputBlock, 'field-uuid');

    if (!fieldUUIDPath) {
      throw new Error('Missing <field-uuid> in <output> block');
    }

    const field = allowedFields.get(fieldUUIDPath);

    if (!field) {
      throw new Error(`Unknown output field "${fieldUUIDPath}"`);
    }

    if (seenFieldUUIDPaths.has(fieldUUIDPath)) {
      throw new Error(`Duplicated output field "${fieldUUIDPath}"`);
    }

    seenFieldUUIDPaths.add(fieldUUIDPath);

    if (field.kind === 'wiki_page') {
      const actionBlock = parseXmlTagContent(outputBlock, 'wiki-action');
      if (actionBlock === null) {
        throw new Error(
          `Missing <wiki-action> for output field "${fieldUUIDPath}"`
        );
      }

      const rawAction = parseXmlTagContent(actionBlock, 'action');
      if (
        rawAction !== 'create' &&
        rawAction !== 'replace' &&
        rawAction !== 'append'
      ) {
        throw new Error(
          `Output field "${fieldUUIDPath}" has invalid Wiki action "${rawAction ?? ''}"`
        );
      }

      const targetPageUUID =
        parseXmlTagContent(actionBlock, 'target-page-uuid') || null;
      const targetPageName =
        parseXmlTagContent(actionBlock, 'target-page-name') || null;
      const parentPageUUID =
        parseXmlTagContent(actionBlock, 'parent-page-uuid') || null;
      const spaceUUID = parseXmlTagContent(actionBlock, 'space-uuid') || null;
      const title = parseXmlTagContent(actionBlock, 'title') || null;
      const markdownValue = parseXmlTagContent(actionBlock, 'markdown');
      const markdown =
        markdownValue === null ? '' : unwrapCdataIfPresent(markdownValue);

      if (rawAction === 'create') {
        if (
          (!field.writeTarget && !parentPageUUID && !spaceUUID) ||
          !title ||
          !markdown.trim()
        ) {
          throw new Error(
            field.writeTarget
              ? `Wiki create output "${fieldUUIDPath}" requires title and markdown`
              : `Wiki create output "${fieldUUIDPath}" requires parent-page-uuid or space-uuid, title, and markdown`
          );
        }
      } else {
        if ((!targetPageUUID && !targetPageName) || !markdown.trim()) {
          throw new Error(
            `Wiki ${rawAction} output "${fieldUUIDPath}" requires a target page and markdown`
          );
        }
      }

      result.push({
        mode: 'wiki_page',
        fieldUUIDPath,
        action: rawAction,
        targetPageUUID,
        targetPageName,
        parentPageUUID,
        spaceUUID,
        title,
        markdown
      });
      continue;
    }

    if (usesObjectOutput(field)) {
      const rawFieldWriteMode = parseXmlTagContent(
        outputBlock,
        'field-write-mode'
      );
      const fieldWriteMode: ParsedFieldWriteMode =
        rawFieldWriteMode === 'set' || rawFieldWriteMode === 'append'
          ? rawFieldWriteMode
          : null;

      if (rawFieldWriteMode !== null && fieldWriteMode === null) {
        throw new Error(
          `Output field "${fieldUUIDPath}" has invalid <field-write-mode> "${rawFieldWriteMode}"`
        );
      }

      if (fieldWriteMode !== null && !supportsFieldWriteMode(field)) {
        throw new Error(
          `Output field "${fieldUUIDPath}" does not support <field-write-mode>`
        );
      }

      result.push({
        mode: 'object_values',
        fieldUUIDPath,
        fieldWriteMode,
        objects: parseObjectCollection(
          outputBlock,
          field,
          `output "${fieldUUIDPath}"`
        )
      });
      continue;
    }

    const content = parseXmlTagContent(outputBlock, 'set-value');

    if (content === null) {
      throw new Error(
        `Missing <set-value> for output field "${fieldUUIDPath}"`
      );
    }

    result.push({
      mode: 'set_value',
      fieldUUIDPath,
      value: unwrapCdataIfPresent(content)
    });
  }

  if (outputBlocks.length === 0) {
    if (fields.length === 0) {
      return [];
    }

    throw new Error('Missing <output> items in <outputs> block');
  }

  return result;
}

export interface ParsedAgentRevisionSummary {
  summary: string;
  changes: string[];
}

export function parseAgentRevisionSummary(
  outputText: string
): ParsedAgentRevisionSummary | null {
  const outputsContent = parseXmlTagContent(outputText, 'outputs');

  if (outputsContent === null) {
    return null;
  }

  const summaryBlocks = collectXmlTagContents(
    outputsContent,
    'revision-summary'
  );

  if (summaryBlocks.length === 0) {
    return null;
  }

  if (summaryBlocks.length > 1) {
    throw new Error('Duplicated <revision-summary> block');
  }

  const summaryBlock = summaryBlocks[0] ?? '';
  const summaryValue = parseXmlTagContent(summaryBlock, 'summary');
  const summary =
    summaryValue === null ? '' : unwrapCdataIfPresent(summaryValue).trim();

  if (!summary) {
    throw new Error('Revision summary requires a non-empty <summary>');
  }

  if (summary.length > MAX_REVISION_SUMMARY_CHARS) {
    throw new Error(
      `Revision summary exceeds ${MAX_REVISION_SUMMARY_CHARS} characters`
    );
  }

  const changesContent = parseXmlTagContent(summaryBlock, 'changes');
  const changes = changesContent
    ? collectXmlTagContents(changesContent, 'change')
        .map((change) => unwrapCdataIfPresent(change).trim())
        .filter(Boolean)
    : [];

  if (changes.length > MAX_REVISION_CHANGE_COUNT) {
    throw new Error(
      `Revision summary exceeds ${MAX_REVISION_CHANGE_COUNT} changes`
    );
  }

  const oversizedChange = changes.find(
    (change) => change.length > MAX_REVISION_CHANGE_CHARS
  );

  if (oversizedChange) {
    throw new Error(
      `Revision summary change exceeds ${MAX_REVISION_CHANGE_CHARS} characters`
    );
  }

  if (
    new TextEncoder().encode([summary, ...changes].join('\n')).byteLength >
    MAX_REVISION_SUMMARY_BYTES
  ) {
    throw new Error(
      `Revision summary exceeds ${MAX_REVISION_SUMMARY_BYTES} bytes`
    );
  }

  return {
    summary,
    changes
  };
}

export interface ParsedAgentSetValueOutput {
  mode: 'set_value';
  fieldUUIDPath: string;
  value: string;
}

export interface ParsedAgentOutputObject {
  objectType: string;
  objectWriteMode: 'create' | 'update' | null;
  objectUUID: string | null;
  objectName: string | null;
  fields: Record<string, ParsedAgentObjectFieldValue>;
}

export interface ParsedAgentWikiPageOutput {
  mode: 'wiki_page';
  fieldUUIDPath: string;
  action: 'create' | 'replace' | 'append';
  targetPageUUID: string | null;
  targetPageName: string | null;
  parentPageUUID: string | null;
  spaceUUID: string | null;
  title: string | null;
  markdown: string;
}

export type ParsedAgentObjectFieldValue = string | ParsedAgentOutputObject[];

export interface ParsedAgentObjectValuesOutput {
  mode: 'object_values';
  fieldUUIDPath: string;
  fieldWriteMode: 'set' | 'append' | null;
  objects: ParsedAgentOutputObject[];
}

export type ParsedAgentOutput =
  | ParsedAgentSetValueOutput
  | ParsedAgentObjectValuesOutput
  | ParsedAgentWikiPageOutput;
