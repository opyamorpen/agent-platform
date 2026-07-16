import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AIModelConfigStatus,
  AgentConfig,
  AgentDraft,
  AgentFieldMeta,
  AgentInputField,
  AgentOutputField,
  AgentSummary,
  AgentWorkspace,
  ApiError,
  ApiSuccess,
  OnesUserSummary,
  SkillSummary
} from '@ones-ai-workflow/shared';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { MultiSearchSelect } from '@/components/ui/multi-search-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Field as FormField,
  FieldContent,
  FieldError,
  FieldLabel
} from '@/components/ui/field';
import { SearchSelect } from '@/components/ui/search-select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { MdEditor } from 'md-editor-rt';
import 'md-editor-rt/lib/style.css';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { useHeaderActions } from '@/layouts/app-layout';
import { useTheme } from '@/components/theme-provider';
import {
  CircleHelpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { streamPost } from '@/lib/sse';

type AgentDraftResponse = ApiSuccess<AgentDraft> | ApiError;
type AgentMutationResponse = ApiSuccess<AgentSummary> | ApiError;
type AgentResourcesResponse<T> = ApiSuccess<T> | ApiError;
type OnesUsersResponse = ApiSuccess<OnesUserSummary[]> | ApiError;
type SaveAgentDraftResponse =
  | ApiSuccess<{ uuid: string; draftConfig: AgentConfig }>
  | ApiError;
type PublishAgentResponse =
  | ApiSuccess<{
      uuid: string;
      currentVersion: number;
      config: AgentConfig;
    }>
  | ApiError;
type AgentPromptPreviewResponse = ApiSuccess<{ prompt: string }> | ApiError;
type AIModelStatusResponse = ApiSuccess<AIModelConfigStatus> | ApiError;
type OnesField = {
  uuid: string;
  name: string;
  fieldType: string;
  valueType: string;
  referenceObjectType: string | null;
  readonly: boolean;
};
type OnesFieldsResponse = ApiSuccess<OnesField[]> | ApiError;
type SelectedAgentInputField = AgentInputField;
type SelectedAgentOutputField = AgentOutputField;
type ExecutorOption = {
  value: string;
  label: string;
  keywords?: string[];
  executorName: string;
};
type StepKey = 'basic' | 'inputs' | 'outputs' | 'prompt';
type SearchFieldOption = {
  value: string;
  label: string;
  keywords?: string[];
};

const DEFAULT_CONFIG: AgentConfig = {
  description: '',
  prompt: '',
  inputs: [],
  outputs: []
};

const STEP_ORDER: StepKey[] = ['basic', 'inputs', 'outputs', 'prompt'];

function createAgentEditorSignature(input: {
  name: string;
  workspaceUUID: string;
  skillUUIDs: string[];
  executorUUID: string;
  executorName: string;
  config: AgentConfig;
}) {
  return JSON.stringify({
    name: input.name,
    workspaceUUID: input.workspaceUUID,
    skillUUIDs: input.skillUUIDs,
    executorUUID: input.executorUUID,
    executorName: input.executorName,
    config: input.config
  });
}

function createAgentDraftSignature(draft: AgentDraft) {
  return createAgentEditorSignature({
    name: draft.name,
    workspaceUUID: draft.workspaceUUID ?? '',
    skillUUIDs: draft.skillUUIDs ?? [],
    executorUUID: draft.executor?.uuid ?? '',
    executorName: draft.executor?.name ?? '',
    config: draft.config ?? DEFAULT_CONFIG
  });
}

function FieldHelpTooltip({
  label,
  content
}: {
  label: string;
  content: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelpIcon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-72">
        <p className="leading-relaxed">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function toAgentFieldMeta(field: OnesField): AgentFieldMeta {
  return {
    uuid: field.uuid,
    name: field.name,
    valueType: field.valueType,
    referenceObjectType: field.referenceObjectType
  };
}

function canInputFieldConfigureSubFields(
  field: { referenceObjectType: string | null } | undefined
): boolean {
  return field?.referenceObjectType === 'issue';
}

function getInputFieldKey(field: SelectedAgentInputField): string {
  return field.field.uuid;
}

function getInputSubFieldUUIDPath(
  field: SelectedAgentInputField,
  subField: SelectedAgentInputField
): string {
  return `${field.field.uuid}.${subField.field.uuid}`;
}

function getInputSubFieldNamePath(
  field: SelectedAgentInputField,
  subField: SelectedAgentInputField
): string {
  return `${field.field.name}.${subField.field.name}`;
}

function getInputSubFieldDescriptionPreview(
  field: SelectedAgentInputField,
  t: (key: string) => string
) {
  if (field.subFields.length === 0) {
    return t('pages.agentDetail.fields.preview.noSubFieldDescriptions');
  }

  return field.subFields
    .map((subField) => {
      const description =
        subField.description.trim() ||
        t('pages.agentDetail.fields.preview.noDescription');
      return `${subField.field.name}: ${description}`;
    })
    .join('\n');
}

function cloneInputField(field: SelectedAgentInputField): SelectedAgentInputField {
  return {
    ...field,
    field: { ...field.field },
    subFields: field.subFields.map(cloneInputField)
  };
}

function FieldPickerToolbar({
  options,
  value,
  onValueChange,
  onAdd,
  addButtonLabel,
  isDisabled,
  isLoading,
  hasError,
  portalContainer,
  searchSelectClassName
}: {
  options: SearchFieldOption[];
  value?: string;
  onValueChange: (value: string | undefined) => void;
  onAdd: () => void;
  addButtonLabel: string;
  isDisabled: boolean;
  isLoading: boolean;
  hasError: boolean;
  portalContainer: HTMLDivElement | null;
  searchSelectClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SearchSelect
        options={options}
        value={value}
        onValueChange={onValueChange}
        placeholder={t('pages.agentDetail.fields.pickerPlaceholder')}
        emptyText={t('pages.agentDetail.fields.pickerEmpty')}
        disabled={isDisabled || isLoading || hasError}
        portalContainer={portalContainer}
        className={searchSelectClassName ?? 'w-full sm:w-[320px]'}
      />
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        disabled={isDisabled || isLoading || hasError || !value}
      >
        <PlusIcon />
        {addButtonLabel}
      </Button>
    </div>
  );
}

function getOutputFieldKey(field: SelectedAgentOutputField): string {
  return field.field.uuid;
}

function canOutputFieldConfigureSubFields(
  field: { referenceObjectType: string | null; valueType: string } | undefined
): boolean {
  return (
    field?.referenceObjectType === 'issue' &&
    (field.valueType === 'single_reference_object' ||
      field.valueType === 'multi_reference_object')
  );
}

function getOutputSetValueFieldUUIDPath(
  rootField: Extract<SelectedAgentOutputField, { mode: 'set_value' }>,
  leafField?: Extract<SelectedAgentOutputField, { mode: 'set_value' }>
): string {
  return leafField
    ? `${rootField.field.uuid}.${leafField.field.uuid}`
    : rootField.field.uuid;
}

function getOutputSetValueFieldNamePath(
  rootField: Extract<SelectedAgentOutputField, { mode: 'set_value' }>,
  leafField?: Extract<SelectedAgentOutputField, { mode: 'set_value' }>
): string {
  return leafField
    ? `${rootField.field.name}.${leafField.field.name}`
    : rootField.field.name;
}

function getOutputSetValueDescriptionPreview(
  field: Extract<SelectedAgentOutputField, { mode: 'set_value' }>,
  t: (key: string) => string
) {
  if (field.subFields.length === 0) {
    return t('pages.agentDetail.fields.preview.noSubFieldDescriptions');
  }

  return field.subFields
    .map((subField) => {
      const description =
        subField.description.trim() ||
        t('pages.agentDetail.fields.preview.noDescription');
      return `${subField.field.name}: ${description}`;
    })
    .join('\n');
}

function getOutputFieldSummaryPreview(
  field: SelectedAgentOutputField,
  t: (key: string) => string
): string {
  return getOutputSetValueDescriptionPreview(field, t);
}

function getInternalFieldSummaryTitle(
  fieldName: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return t('pages.agentDetail.fields.internalFieldSummaryTitle', {
    fieldName
  });
}

function getEditInternalFieldSummaryTitle(
  fieldName: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  return t('pages.agentDetail.fields.editInternalFieldSummaryTitle', {
    fieldName
  });
}

function cloneOutputSetValueField(
  field: Extract<SelectedAgentOutputField, { mode: 'set_value' }>
): Extract<SelectedAgentOutputField, { mode: 'set_value' }> {
  return {
    ...field,
    field: { ...field.field },
    subFields: field.subFields.map(cloneOutputSetValueField)
  };
}

function cloneOutputField(
  field: SelectedAgentOutputField
): SelectedAgentOutputField {
  return cloneOutputSetValueField(field);
}

function InputFieldListEditor({
  availableFields,
  selectedFieldUUID,
  onSelectedFieldUUIDChange,
  onAddSelectedField,
  fields,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChangeField,
  isLoadingAvailableFields,
  availableFieldsErrorMessage,
  isDisabled = false
}: {
  availableFields: OnesField[];
  selectedFieldUUID?: string;
  onSelectedFieldUUIDChange: (value: string | undefined) => void;
  onAddSelectedField: () => void;
  fields: SelectedAgentInputField[];
  onRemove: (fieldUUIDPath: string) => void;
  onMoveUp: (fieldUUIDPath: string) => void;
  onMoveDown: (fieldUUIDPath: string) => void;
  onChangeField: (
    fieldUUIDPath: string,
    nextField: SelectedAgentInputField
  ) => void;
  isLoadingAvailableFields: boolean;
  availableFieldsErrorMessage: string | null;
  isDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const [pickerContentElement, setPickerContentElement] =
    useState<HTMLDivElement | null>(null);
  const [editingDialogContentElement, setEditingDialogContentElement] =
    useState<HTMLDivElement | null>(null);
  const [editingPickerContentElement, setEditingPickerContentElement] =
    useState<HTMLDivElement | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );
  const [editingFieldDraft, setEditingFieldDraft] =
    useState<SelectedAgentInputField | null>(null);
  const [selectedSubFieldUUID, setSelectedSubFieldUUID] = useState<string>();

  const availableFieldOptions = useMemo(
    () =>
      availableFields.map((field) => ({
        value: field.uuid,
        label: field.name,
        keywords: [
          field.fieldType,
          field.valueType,
          field.referenceObjectType ?? ''
        ].filter(Boolean)
      })),
    [availableFields]
  );
  const editingField = editingFieldDraft ?? undefined;
  const editingFieldUUIDPath = editingField
    ? getInputFieldKey(editingField)
    : null;
  const allowSubFieldSelection = canInputFieldConfigureSubFields(
    editingField?.field
  );
  const availableEditingSubFieldOptions = useMemo(() => {
    if (!editingField) {
      return availableFieldOptions;
    }

    const selectedSubFieldUUIDs = new Set(
      editingField.subFields.map((subField) => subField.field.uuid)
    );

    return availableFieldOptions.filter(
      (option) =>
        option.value !== editingField.field.uuid &&
        !selectedSubFieldUUIDs.has(option.value)
    );
  }, [availableFieldOptions, editingField]);

  function updateEditingField(
    updater: (field: SelectedAgentInputField) => SelectedAgentInputField
  ) {
    if (!editingField || !editingFieldUUIDPath) {
      return;
    }

    setEditingFieldDraft((currentField) =>
      currentField ? updater(currentField) : currentField
    );
  }

  function resetEditingState() {
    setEditingFieldIndex(null);
    setEditingFieldDraft(null);
    setSelectedSubFieldUUID(undefined);
    setEditingPickerContentElement(null);
  }

  function handleOpenEditingDialog(index: number) {
    setEditingFieldIndex(index);
    setEditingFieldDraft(cloneInputField(fields[index] as SelectedAgentInputField));
    setSelectedSubFieldUUID(undefined);
  }

  function handleConfirmEditingField() {
    if (!editingField || !editingFieldUUIDPath) {
      return;
    }

    onChangeField(editingFieldUUIDPath, editingField);
    resetEditingState();
  }

  function handleAddEditingSubField() {
    if (!editingField || !selectedSubFieldUUID) {
      return;
    }

    const nextSubField = availableFields.find(
      (field) => field.uuid === selectedSubFieldUUID
    );

    if (!nextSubField) {
      return;
    }

    updateEditingField((currentField) => ({
      ...currentField,
      subFields: [
        ...currentField.subFields,
        {
          field: toAgentFieldMeta(nextSubField),
          description: '',
          subFields: []
        }
      ]
    }));
    setSelectedSubFieldUUID(undefined);
  }

  return (
    <section className="space-y-4">
      <div ref={setPickerContentElement}>
        <FieldPickerToolbar
          options={availableFieldOptions}
          value={selectedFieldUUID}
          onValueChange={onSelectedFieldUUIDChange}
          onAdd={onAddSelectedField}
          addButtonLabel={t('pages.agentDetail.fields.addField')}
          isDisabled={isDisabled}
          isLoading={isLoadingAvailableFields}
          hasError={Boolean(availableFieldsErrorMessage)}
          portalContainer={pickerContentElement}
        />
      </div>
      <div className="space-y-4">
        {availableFieldsErrorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {availableFieldsErrorMessage}
          </div>
        ) : null}
        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {t('pages.agentDetail.fields.empty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[280px]" />
                <col />
                <col className="w-[200px]" />
              </colgroup>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-4">
                    {t('pages.agentDetail.fields.table.name')}
                  </TableHead>
                  <TableHead>{t('pages.agentDetail.fields.table.description')}</TableHead>
                  <TableHead className="pr-4 text-right">
                    {t('pages.agentDetail.fields.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const fieldUUIDPath = getInputFieldKey(field);
                  const canEditSubFields = canInputFieldConfigureSubFields(
                    field.field
                  );

                  return (
                    <TableRow key={fieldUUIDPath}>
                      <TableCell className="px-4 align-top">
                        <div className="py-1 font-medium">{field.field.name}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        {canEditSubFields ? (
                          <div className="rounded-lg border border-input bg-muted/20 px-3 py-3 dark:bg-input/20">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium">
                                {getInternalFieldSummaryTitle(
                                  field.field.name,
                                  t
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="link"
                                size="xs"
                                onClick={() => handleOpenEditingDialog(index)}
                                disabled={isDisabled}
                                className="h-auto px-0 text-sm"
                              >
                                {t('pages.agentDetail.actions.edit')}
                              </Button>
                            </div>
                            <div className="text-sm whitespace-pre-line text-muted-foreground">
                              {getInputSubFieldDescriptionPreview(field, t)}
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            value={field.description}
                            onChange={(event) =>
                              onChangeField(fieldUUIDPath, {
                                ...field,
                                description: event.target.value
                              })
                            }
                            placeholder={t('pages.agentDetail.fields.inputDescriptionPlaceholder')}
                            className="min-h-24"
                            disabled={isDisabled}
                          />
                        )}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => onMoveUp(fieldUUIDPath)}
                            disabled={isDisabled || index === 0}
                            aria-label={t('pages.agentDetail.fields.moveUpAria', {
                              name: field.field.name
                            })}
                          >
                            <ChevronUpIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => onMoveDown(fieldUUIDPath)}
                            disabled={isDisabled || index === fields.length - 1}
                            aria-label={t('pages.agentDetail.fields.moveDownAria', {
                              name: field.field.name
                            })}
                          >
                            <ChevronDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => onRemove(fieldUUIDPath)}
                            disabled={isDisabled}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={editingFieldIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            resetEditingState();
          }
        }}
      >
        <DialogContent
          ref={setEditingDialogContentElement}
          className="grid max-h-[calc(100vh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl"
        >
          {editingField ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {getEditInternalFieldSummaryTitle(editingField.field.name, t)}
                </DialogTitle>
              </DialogHeader>
              <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                <div className="space-y-3">
                  {allowSubFieldSelection ? (
                    <>
                      <div ref={setEditingPickerContentElement}>
                        <FieldPickerToolbar
                          options={availableEditingSubFieldOptions}
                          value={selectedSubFieldUUID}
                          onValueChange={setSelectedSubFieldUUID}
                          onAdd={handleAddEditingSubField}
                          addButtonLabel={t('pages.agentDetail.fields.addField')}
                          isDisabled={isDisabled}
                          isLoading={isLoadingAvailableFields}
                          hasError={Boolean(availableFieldsErrorMessage)}
                          portalContainer={
                            editingPickerContentElement ?? editingDialogContentElement
                          }
                          searchSelectClassName="w-full sm:w-[300px]"
                        />
                      </div>
                      {editingField.subFields.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                          {t('pages.agentDetail.fields.emptySubFields')}
                        </div>
                      ) : (
                        <div className="min-h-0 overflow-y-auto rounded-lg border">
                          <Table className="table-fixed">
                            <colgroup>
                              <col className="w-[220px]" />
                              <col />
                              <col className="w-[120px]" />
                            </colgroup>
                            <TableHeader className="bg-muted">
                              <TableRow>
                                <TableHead className="px-4">
                                  {t('pages.agentDetail.fields.table.name')}
                                </TableHead>
                                <TableHead>
                                  {t('pages.agentDetail.fields.table.description')}
                                </TableHead>
                                <TableHead className="pr-4 text-right">
                                  {t('pages.agentDetail.fields.table.actions')}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {editingField.subFields.map((subField) => {
                                const subFieldUUIDPath = getInputSubFieldUUIDPath(
                                  editingField,
                                  subField
                                );

                                return (
                                  <TableRow key={subFieldUUIDPath}>
                                    <TableCell className="px-4 align-top">
                                      <div className="space-y-1 py-1">
                                        <div className="font-medium">
                                          {subField.field.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {getInputSubFieldNamePath(
                                            editingField,
                                            subField
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <Textarea
                                        value={subField.description}
                                        onChange={(event) =>
                                          updateEditingField((currentField) => ({
                                            ...currentField,
                                            subFields: currentField.subFields.map(
                                              (currentSubField) =>
                                                currentSubField.field.uuid ===
                                                subField.field.uuid
                                                  ? {
                                                      ...currentSubField,
                                                      description:
                                                        event.target.value
                                                    }
                                                  : currentSubField
                                            )
                                          }))
                                        }
                                        placeholder={t(
                                          'pages.agentDetail.fields.inputSubFieldDescriptionPlaceholder'
                                        )}
                                        className="min-h-24"
                                        disabled={isDisabled}
                                      />
                                    </TableCell>
                                    <TableCell className="pr-4">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="shrink-0"
                                          onClick={() =>
                                            updateEditingField((currentField) => ({
                                              ...currentField,
                                              subFields:
                                                currentField.subFields.filter(
                                                  (currentSubField) =>
                                                    currentSubField.field.uuid !==
                                                    subField.field.uuid
                                                )
                                            }))
                                          }
                                          disabled={isDisabled}
                                        >
                                          <Trash2Icon />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t('pages.agentDetail.fields.inputSubFieldUnsupported')}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetEditingState}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmEditingField}
                  disabled={isDisabled}
                >
                  {t('pages.agentDetail.actions.confirm')}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function OutputFieldListEditor({
  availableFields,
  selectedFieldUUID,
  onSelectedFieldUUIDChange,
  onAddSelectedField,
  fields,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChangeField,
  isLoadingAvailableFields,
  availableFieldsErrorMessage,
  isDisabled = false
}: {
  availableFields: OnesField[];
  selectedFieldUUID?: string;
  onSelectedFieldUUIDChange: (value: string | undefined) => void;
  onAddSelectedField: () => void;
  fields: SelectedAgentOutputField[];
  onRemove: (fieldUUID: string) => void;
  onMoveUp: (fieldUUID: string) => void;
  onMoveDown: (fieldUUID: string) => void;
  onChangeField: (fieldUUID: string, nextField: SelectedAgentOutputField) => void;
  isLoadingAvailableFields: boolean;
  availableFieldsErrorMessage: string | null;
  isDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const [pickerContentElement, setPickerContentElement] =
    useState<HTMLDivElement | null>(null);
  const [editingDialogContentElement, setEditingDialogContentElement] =
    useState<HTMLDivElement | null>(null);
  const [editingPickerContentElement, setEditingPickerContentElement] =
    useState<HTMLDivElement | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );
  const [editingFieldDraft, setEditingFieldDraft] =
    useState<SelectedAgentOutputField | null>(null);
  const [selectedSubFieldUUID, setSelectedSubFieldUUID] = useState<string>();

  const availableFieldOptions = useMemo(
    () =>
      availableFields.map((field) => ({
        value: field.uuid,
        label: field.name,
        keywords: [
          field.fieldType,
          field.valueType,
          field.referenceObjectType ?? ''
        ].filter(Boolean)
      })),
    [availableFields]
  );
  const editingField = editingFieldDraft ?? undefined;
  const editingFieldUUID = editingField ? getOutputFieldKey(editingField) : null;
  const allowSubFieldSelection = canOutputFieldConfigureSubFields(
    editingField?.field
  );
  const availableEditingSubFieldOptions = useMemo(() => {
    if (!editingField) {
      return availableFieldOptions;
    }

    const selectedSubFieldUUIDs = new Set(
      editingField.subFields.map((subField) => subField.field.uuid)
    );

    return availableFieldOptions.filter(
      (option) =>
        option.value !== editingField.field.uuid &&
        !selectedSubFieldUUIDs.has(option.value)
    );
  }, [availableFieldOptions, editingField]);

  function updateEditingField(
    updater: (field: SelectedAgentOutputField) => SelectedAgentOutputField
  ) {
    if (!editingField || !editingFieldUUID) {
      return;
    }

    setEditingFieldDraft((currentField) =>
      currentField ? updater(currentField) : currentField
    );
  }

  function resetEditingState() {
    setEditingFieldIndex(null);
    setEditingFieldDraft(null);
    setSelectedSubFieldUUID(undefined);
    setEditingPickerContentElement(null);
  }

  function handleOpenEditingDialog(index: number) {
    setEditingFieldIndex(index);
    setEditingFieldDraft(cloneOutputField(fields[index] as SelectedAgentOutputField));
    setSelectedSubFieldUUID(undefined);
  }

  function handleConfirmEditingField() {
    if (!editingField || !editingFieldUUID) {
      return;
    }

    onChangeField(editingFieldUUID, editingField);
    resetEditingState();
  }

  function handleAddEditingSubField() {
    if (!editingField || !selectedSubFieldUUID) {
      return;
    }

    const nextSubField = availableFields.find(
      (field) => field.uuid === selectedSubFieldUUID
    );

    if (!nextSubField) {
      return;
    }

    updateEditingField((currentField) => {
      return {
        ...currentField,
        subFields: [
          ...currentField.subFields,
          {
            mode: 'set_value',
            field: toAgentFieldMeta(nextSubField),
            description: '',
            subFields: []
          }
        ]
      };
    });
    setSelectedSubFieldUUID(undefined);
  }

  return (
    <section className="space-y-4">
      <div ref={setPickerContentElement}>
        <FieldPickerToolbar
          options={availableFieldOptions}
          value={selectedFieldUUID}
          onValueChange={onSelectedFieldUUIDChange}
          onAdd={onAddSelectedField}
          addButtonLabel={t('pages.agentDetail.fields.addField')}
          isDisabled={isDisabled}
          isLoading={isLoadingAvailableFields}
          hasError={Boolean(availableFieldsErrorMessage)}
          portalContainer={pickerContentElement}
        />
      </div>
      <div className="space-y-4">
        {availableFieldsErrorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {availableFieldsErrorMessage}
          </div>
        ) : null}
        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            {t('pages.agentDetail.fields.empty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[280px]" />
                <col />
                <col className="w-[200px]" />
              </colgroup>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-4">
                    {t('pages.agentDetail.fields.table.name')}
                  </TableHead>
                  <TableHead>{t('pages.agentDetail.fields.table.description')}</TableHead>
                  <TableHead className="pr-4 text-right">
                    {t('pages.agentDetail.fields.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const fieldUUID = getOutputFieldKey(field);
                  const canEditOutputDetails = canOutputFieldConfigureSubFields(
                    field.field
                  );

                  return (
                    <TableRow key={fieldUUID}>
                      <TableCell className="px-4 align-top">
                        <div className="py-1 font-medium">{field.field.name}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-3">
                          <Textarea
                            value={field.description}
                            onChange={(event) =>
                              onChangeField(fieldUUID, {
                                ...field,
                                description: event.target.value
                              })
                            }
                            placeholder={
                              canEditOutputDetails
                                ? t(
                                    'pages.agentDetail.fields.outputDescriptionPlaceholderObject'
                                  )
                                : t(
                                    'pages.agentDetail.fields.outputDescriptionPlaceholderSimple'
                                  )
                            }
                            className="min-h-24"
                            disabled={isDisabled}
                          />
                          {canEditOutputDetails ? (
                            <div className="rounded-lg border border-input bg-muted/20 px-3 py-3 dark:bg-input/20">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <div className="text-sm font-medium">
                                  {getInternalFieldSummaryTitle(
                                    field.field.name,
                                    t
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="xs"
                                  onClick={() => handleOpenEditingDialog(index)}
                                  disabled={isDisabled}
                                  className="h-auto px-0 text-sm"
                                >
                                  {t('pages.agentDetail.actions.edit')}
                                </Button>
                              </div>
                              <div className="text-sm whitespace-pre-line text-muted-foreground">
                                {getOutputFieldSummaryPreview(field, t)}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => onMoveUp(fieldUUID)}
                            disabled={isDisabled || index === 0}
                            aria-label={t('pages.agentDetail.fields.moveUpAria', {
                              name: field.field.name
                            })}
                          >
                            <ChevronUpIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => onMoveDown(fieldUUID)}
                            disabled={isDisabled || index === fields.length - 1}
                            aria-label={t('pages.agentDetail.fields.moveDownAria', {
                              name: field.field.name
                            })}
                          >
                            <ChevronDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => onRemove(fieldUUID)}
                            disabled={isDisabled}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={editingFieldIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            resetEditingState();
          }
        }}
      >
        <DialogContent
          ref={setEditingDialogContentElement}
          className="grid max-h-[calc(100vh-4rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-5xl"
        >
          {editingField ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {getEditInternalFieldSummaryTitle(editingField.field.name, t)}
                </DialogTitle>
                <DialogDescription>
                  {t('pages.agentDetail.fields.outputSubFieldDialogDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                {allowSubFieldSelection ? (
                  <>
                    <div ref={setEditingPickerContentElement}>
                      <FieldPickerToolbar
                        options={availableEditingSubFieldOptions}
                        value={selectedSubFieldUUID}
                        onValueChange={setSelectedSubFieldUUID}
                        onAdd={handleAddEditingSubField}
                        addButtonLabel={t('pages.agentDetail.fields.addField')}
                        isDisabled={isDisabled}
                        isLoading={isLoadingAvailableFields}
                        hasError={Boolean(availableFieldsErrorMessage)}
                        portalContainer={
                          editingPickerContentElement ?? editingDialogContentElement
                        }
                        searchSelectClassName="w-full sm:w-[300px]"
                      />
                    </div>
                    {editingField.subFields.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        {t('pages.agentDetail.fields.emptyOutputSubFields')}
                      </div>
                    ) : (
                      <div className="min-h-0 overflow-y-auto rounded-lg border">
                        <Table className="table-fixed">
                          <colgroup>
                            <col className="w-[220px]" />
                            <col />
                            <col className="w-[120px]" />
                          </colgroup>
                          <TableHeader className="bg-muted">
                            <TableRow>
                              <TableHead className="px-4">
                                {t('pages.agentDetail.fields.table.name')}
                              </TableHead>
                              <TableHead>
                                {t('pages.agentDetail.fields.table.description')}
                              </TableHead>
                              <TableHead className="pr-4 text-right">
                                {t('pages.agentDetail.fields.table.actions')}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editingField.subFields.map((subField) => {
                              const subFieldUUIDPath =
                                getOutputSetValueFieldUUIDPath(
                                  editingField,
                                  subField
                                );

                              return (
                                <TableRow key={subFieldUUIDPath}>
                                  <TableCell className="px-4 align-top">
                                    <div className="space-y-1 py-1">
                                      <div className="font-medium">
                                        {subField.field.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {getOutputSetValueFieldNamePath(
                                          editingField,
                                          subField
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Textarea
                                      value={subField.description}
                                      onChange={(event) =>
                                        updateEditingField((currentField) => ({
                                          ...currentField,
                                          subFields: currentField.subFields.map(
                                            (currentSubField) =>
                                              currentSubField.field.uuid ===
                                              subField.field.uuid
                                                ? {
                                                    ...currentSubField,
                                                    description:
                                                      event.target.value
                                                  }
                                                : currentSubField
                                          )
                                        }))
                                      }
                                      placeholder={t(
                                        'pages.agentDetail.fields.outputSubFieldDescriptionPlaceholder'
                                      )}
                                      className="min-h-24"
                                      disabled={isDisabled}
                                    />
                                  </TableCell>
                                  <TableCell className="pr-4">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0"
                                        onClick={() =>
                                          updateEditingField((currentField) => ({
                                            ...currentField,
                                            subFields: currentField.subFields.filter(
                                              (currentSubField) =>
                                                currentSubField.field.uuid !==
                                                subField.field.uuid
                                            )
                                          }))
                                        }
                                        disabled={isDisabled}
                                      >
                                        <Trash2Icon />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                    {t('pages.agentDetail.fields.outputSubFieldUnsupported')}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetEditingState}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmEditingField}
                  disabled={isDisabled}
                >
                  {t('pages.agentDetail.actions.confirm')}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function AgentDetailPage() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const { uuid } = useParams();
  const { setActions, setCenter, setTitle } = useHeaderActions();
  const [activeStep, setActiveStep] = useState<StepKey>('basic');
  const [onesFields, setOnesFields] = useState<OnesField[]>([]);
  const [isLoadingOnesFields, setIsLoadingOnesFields] = useState(true);
  const [onesFieldsErrorMessage, setOnesFieldsErrorMessage] = useState<
    string | null
  >(null);
  const [workspaces, setWorkspaces] = useState<AgentWorkspace[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [resourceErrorMessage, setResourceErrorMessage] = useState<
    string | null
  >(null);
  const [executorOptions, setExecutorOptions] = useState<ExecutorOption[]>([]);
  const [executorSearchKeyword, setExecutorSearchKeyword] = useState('');
  const [isSearchingExecutors, setIsSearchingExecutors] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [draftErrorMessage, setDraftErrorMessage] = useState<string | null>(
    null
  );
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceUUID, setWorkspaceUUID] = useState('');
  const [skillUUIDs, setSkillUUIDs] = useState<string[]>([]);
  const [executorUUID, setExecutorUUID] = useState('');
  const [executorName, setExecutorName] = useState('');
  const [basicConfigError, setBasicConfigError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<SelectedAgentInputField[]>([]);
  const [outputs, setOutputs] = useState<SelectedAgentOutputField[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_CONFIG.prompt);
  const [selectedInputFieldUUID, setSelectedInputFieldUUID] =
    useState<string>();
  const [selectedOutputFieldUUID, setSelectedOutputFieldUUID] =
    useState<string>();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(
    null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] =
    useState(false);
  const [recommendationPrompt, setRecommendationPrompt] = useState('');
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null
  );
  const [recommendationContext, setRecommendationContext] = useState<
    string | null
  >(null);
  const recommendationAbortRef = useRef<AbortController | null>(null);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [hasUnpublishedDraft, setHasUnpublishedDraft] = useState(false);
  const [editBaselineSignature, setEditBaselineSignature] = useState('');
  const [basicConfigContentElement, setBasicConfigContentElement] =
    useState<HTMLDivElement | null>(null);

  const isBusy = isLoadingDraft || isPublishing;
  const { resolvedTheme } = useTheme();

  function applyConfig(config: AgentConfig | null) {
    const nextConfig = config ?? DEFAULT_CONFIG;
    setDescription(nextConfig.description ?? '');
    setInputs(nextConfig.inputs ?? []);
    setOutputs(nextConfig.outputs ?? []);
    setPrompt(nextConfig.prompt);
  }

  function applyDraft(draft: AgentDraft) {
    setAgentName(draft.name);
    setWorkspaceUUID(draft.workspaceUUID ?? '');
    setSkillUUIDs(draft.skillUUIDs ?? []);
    setExecutorUUID(draft.executor?.uuid ?? '');
    setExecutorName(draft.executor?.name ?? '');
    applyConfig(draft.config);
  }

  const buildAgentConfig = useCallback(
    (): AgentConfig => ({
      description,
      prompt,
      inputs,
      outputs
    }),
    [description, inputs, outputs, prompt]
  );

  const currentEditorSignature = useMemo(
    () =>
      createAgentEditorSignature({
        name: agentName,
        workspaceUUID,
        skillUUIDs,
        executorUUID,
        executorName,
        config: buildAgentConfig()
      }),
    [
      agentName,
      buildAgentConfig,
      executorName,
      executorUUID,
      skillUUIDs,
      workspaceUUID
    ]
  );
  const hasLocalChanges = currentEditorSignature !== editBaselineSignature;
  const canPublish = isEditing && (hasUnpublishedDraft || hasLocalChanges);

  const buildPromptRecommendationPayload = useCallback(
    () => ({
      name: agentName.trim(),
      description,
      skillUUIDs,
      inputs,
      outputs
    }),
    [agentName, description, inputs, outputs, skillUUIDs]
  );

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/ai-model-config/status')
      .then(async (response) => ({
        response,
        payload: (await response.json()) as AIModelStatusResponse
      }))
      .then(({ response, payload }) => {
        if (!cancelled) {
          setIsAIConfigured(
            response.ok && payload.success && payload.data.configured
          );
        }
      })
      .catch(() => {
        if (!cancelled) setIsAIConfigured(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGeneratePromptRecommendation() {
    const payload = buildPromptRecommendationPayload();
    const abortController = new AbortController();
    recommendationAbortRef.current?.abort();
    recommendationAbortRef.current = abortController;
    setIsRecommendationOpen(true);
    setIsGeneratingRecommendation(true);
    setRecommendationPrompt('');
    setRecommendationError(null);
    setRecommendationContext(JSON.stringify(payload));

    try {
      await streamPost(
        '/api/agents/prompt-recommendations/stream',
        payload,
        ({ event, data }) => {
          if (event === 'text_delta') {
            setRecommendationPrompt(
              (current) => current + (data as { delta: string }).delta
            );
          }

          if (event === 'done') {
            setRecommendationPrompt((data as { prompt: string }).prompt);
          }
        },
        abortController.signal
      );
    } catch (error) {
      if (!abortController.signal.aborted) {
        setRecommendationError(
          getErrorMessage(error, t, 'pages.agentDetail.recommendation.failed')
        );
      }
    } finally {
      if (recommendationAbortRef.current === abortController) {
        recommendationAbortRef.current = null;
      }
      setIsGeneratingRecommendation(false);
    }
  }

  function closePromptRecommendation() {
    recommendationAbortRef.current?.abort();
    recommendationAbortRef.current = null;
    setIsRecommendationOpen(false);
  }

  function applyPromptRecommendation() {
    if (
      recommendationContext !==
      JSON.stringify(buildPromptRecommendationPayload())
    ) {
      setRecommendationError(
        t('pages.agentDetail.recommendation.contextChanged')
      );
      return;
    }

    setPrompt(recommendationPrompt);
    setIsRecommendationOpen(false);
    toast.success(t('pages.agentDetail.recommendation.applied'));
  }

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingPreview(true);
        setPreviewErrorMessage(null);

        const response = await fetch('/api/agents/prompt-preview', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            config: buildAgentConfig(),
            workspaceUUID: workspaceUUID || null
          } satisfies {
            config: AgentConfig;
            workspaceUUID: string | null;
          }),
          signal: abortController.signal
        });
        const payload = (await response.json()) as AgentPromptPreviewResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.success
              ? t('pages.agentDetail.promptPreviewLoadFailed')
              : getApiErrorMessage(
                  payload,
                  t,
                  'pages.agentDetail.promptPreviewLoadFailed'
                )
          );
        }

        setPreviewPrompt(payload.data.prompt);
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setPreviewPrompt('');
        setPreviewErrorMessage(
          getErrorMessage(error, t, 'pages.agentDetail.promptPreviewLoadFailed')
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingPreview(false);
        }
      }
    }, 200);

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [buildAgentConfig, isPreviewOpen, workspaceUUID]);

  const mergedExecutorOptions = useMemo(() => {
    const optionMap = new Map<string, ExecutorOption>();

    if (executorUUID && executorName) {
      optionMap.set(executorUUID, {
        value: executorUUID,
        label: executorName,
        executorName
      });
    }

    for (const option of executorOptions) {
      optionMap.set(option.value, option);
    }

    return Array.from(optionMap.values());
  }, [executorName, executorOptions, executorUUID]);

  const stepItems = useMemo(
    () => [
      {
        key: 'basic' as const,
        title: t('pages.agentDetail.steps.basic')
      },
      {
        key: 'inputs' as const,
        title: t('pages.agentDetail.steps.inputs')
      },
      {
        key: 'outputs' as const,
        title: t('pages.agentDetail.steps.outputs')
      },
      {
        key: 'prompt' as const,
        title: t('pages.agentDetail.steps.prompt')
      }
    ],
    [t]
  );

  useEffect(() => {
    async function loadOnesFields() {
      setIsLoadingOnesFields(true);
      setOnesFieldsErrorMessage(null);

      try {
        const response = await fetch('/api/ones/fields');
        const payload = (await response.json()) as OnesFieldsResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.success
              ? t('pages.agentDetail.onesFieldsLoadFailed')
              : getApiErrorMessage(
                  payload,
                  t,
                  'pages.agentDetail.onesFieldsLoadFailed'
                )
          );
        }

        setOnesFields(payload.data);
      } catch (error) {
        setOnesFields([]);
        setOnesFieldsErrorMessage(
          getErrorMessage(error, t, 'pages.agentDetail.onesFieldsLoadFailed')
        );
      } finally {
        setIsLoadingOnesFields(false);
      }
    }

    void loadOnesFields();
  }, [t]);

  useEffect(() => {
    async function loadAgentResources() {
      setIsLoadingResources(true);
      setResourceErrorMessage(null);

      try {
        const [workspacesResponse, skillsResponse] = await Promise.all([
          fetch('/api/agent-workspaces'),
          fetch('/api/skills')
        ]);
        const workspacesPayload =
          (await workspacesResponse.json()) as AgentResourcesResponse<
            AgentWorkspace[]
          >;
        const skillsPayload =
          (await skillsResponse.json()) as AgentResourcesResponse<
            SkillSummary[]
          >;

        if (!workspacesResponse.ok || !workspacesPayload.success) {
          throw new Error(
            workspacesPayload.success
              ? t('pages.agentDetail.workspacesLoadFailed')
              : getApiErrorMessage(
                  workspacesPayload,
                  t,
                  'pages.agentDetail.workspacesLoadFailed'
                )
          );
        }

        if (!skillsResponse.ok || !skillsPayload.success) {
          throw new Error(
            skillsPayload.success
              ? t('pages.agentDetail.skillsLoadFailed')
              : getApiErrorMessage(
                  skillsPayload,
                  t,
                  'pages.agentDetail.skillsLoadFailed'
                )
          );
        }

        setWorkspaces(workspacesPayload.data);
        setSkills(skillsPayload.data);
      } catch (error) {
        setWorkspaces([]);
       setSkills([]);
        setResourceErrorMessage(
          getErrorMessage(error, t, 'pages.agentDetail.resourcesLoadFailed')
        );
      } finally {
        setIsLoadingResources(false);
      }
    }

    void loadAgentResources();
  }, [t]);

  useEffect(() => {
    async function loadDraft() {
      if (!uuid) {
        setDraftErrorMessage(t('pages.agentDetail.missingUuid'));
        setIsLoadingDraft(false);
        return;
      }

      setIsLoadingDraft(true);
      setDraftErrorMessage(null);

      try {
        const response = await fetch(`/api/agents/${uuid}/draft`);
        const payload = (await response.json()) as AgentDraftResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.success
              ? t('pages.agentDetail.draftLoadFailed')
              : getApiErrorMessage(payload, t, 'pages.agentDetail.draftLoadFailed')
          );
        }

        applyDraft(payload.data);
        setIsEditing(payload.data.source !== 'published');
        setHasUnpublishedDraft(payload.data.hasUnpublishedDraft);
        setEditBaselineSignature(createAgentDraftSignature(payload.data));
      } catch (error) {
        setAgentName('');
        setWorkspaceUUID('');
        setSkillUUIDs([]);
        setExecutorUUID('');
        setExecutorName('');
        applyConfig(null);
        setIsEditing(true);
        setHasUnpublishedDraft(false);
        setEditBaselineSignature(
          createAgentEditorSignature({
            name: '',
            workspaceUUID: '',
            skillUUIDs: [],
            executorUUID: '',
            executorName: '',
            config: DEFAULT_CONFIG
          })
        );
        setDraftErrorMessage(
          getErrorMessage(error, t, 'pages.agentDetail.draftLoadFailed')
        );
      } finally {
        setIsLoadingDraft(false);
      }
    }

    void loadDraft();
  }, [t, uuid]);

  useEffect(() => {
    setTitle(agentName.trim() || null);

    return () => {
      setTitle(null);
    };
  }, [agentName, setTitle]);

  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearchingExecutors(true);
        const searchParams = new URLSearchParams({
          limit: '20'
        });

        if (executorSearchKeyword.trim()) {
          searchParams.set('keyword', executorSearchKeyword.trim());
        }

        const response = await fetch(
          `/api/ones/users/search?${searchParams.toString()}`,
          {
            signal: abortController.signal
          }
        );
        const payload = (await response.json()) as OnesUsersResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.success
              ? t('pages.agentDetail.executorSearchFailed')
              : getApiErrorMessage(
                  payload,
                  t,
                  'pages.agentDetail.executorSearchFailed'
                )
          );
        }

        setExecutorOptions(
          payload.data.map((user) => ({
            value: user.uuid,
            label: user.name,
            keywords: [user.email ?? '', user.staffID ?? ''].filter(Boolean),
            executorName: user.name
          }))
        );
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        toast.error(
          getErrorMessage(error, t, 'pages.agentDetail.executorSearchFailed')
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearchingExecutors(false);
        }
      }
    }, 250);

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [executorSearchKeyword, t]);

  function validateBasicConfig(): string | null {
    if (!agentName.trim()) {
      return t('pages.agentDetail.validation.nameRequired');
    }

    return null;
  }

  function updateOutputFieldList(
    updater: (fields: SelectedAgentOutputField[]) => SelectedAgentOutputField[]
  ) {
    setOutputs((currentFields) => updater(currentFields));
  }

  function handleRemoveInputField(fieldUUIDPath: string) {
    setInputs((currentFields) =>
      currentFields.filter(
        (field) => getInputFieldKey(field) !== fieldUUIDPath
      )
    );
  }

  function handleChangeInputField(
    fieldUUIDPath: string,
    nextField: SelectedAgentInputField
  ) {
    setInputs((currentFields) =>
      currentFields.map((field) =>
        getInputFieldKey(field) === fieldUUIDPath ? nextField : field
      )
    );
  }

  function handleMoveInputField(
    fieldUUIDPath: string,
    direction: 'up' | 'down'
  ) {
    setInputs((currentFields) => {
      const currentIndex = currentFields.findIndex(
        (field) => getInputFieldKey(field) === fieldUUIDPath
      );

      if (currentIndex < 0) {
        return currentFields;
      }

      const nextIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= currentFields.length) {
        return currentFields;
      }

      const nextFields = [...currentFields];
      const [targetField] = nextFields.splice(currentIndex, 1);
      nextFields.splice(nextIndex, 0, targetField);
      return nextFields;
    });
  }

  function handleAddSelectedInputField() {
    if (!selectedInputFieldUUID) {
      return;
    }

    const selectedField = onesFields.find(
      (field) => field.uuid === selectedInputFieldUUID
    );

    if (!selectedField) {
      return;
    }

    const nextField: SelectedAgentInputField = {
      field: toAgentFieldMeta(selectedField),
      description: '',
      subFields: []
    };

    if (inputs.some((field) => field.field.uuid === nextField.field.uuid)) {
      toast.error(
        t('pages.agentDetail.duplicateInputField', {
          name: nextField.field.name
        })
      );
      return;
    }

    setInputs((currentFields) => [...currentFields, nextField]);
    setSelectedInputFieldUUID(undefined);
  }

  function handleRemoveOutputField(fieldUUID: string) {
    updateOutputFieldList((fields) =>
      fields.filter((field) => getOutputFieldKey(field) !== fieldUUID)
    );
  }

  function handleChangeOutputField(
    fieldUUID: string,
    nextField: SelectedAgentOutputField
  ) {
    updateOutputFieldList((fields) =>
      fields.map((field) =>
        getOutputFieldKey(field) === fieldUUID ? nextField : field
      )
    );
  }

  function handleMoveOutputField(
    fieldUUID: string,
    direction: 'up' | 'down'
  ) {
    updateOutputFieldList((fields) => {
      const currentIndex = fields.findIndex(
        (field) => getOutputFieldKey(field) === fieldUUID
      );

      if (currentIndex < 0) {
        return fields;
      }

      const nextIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= fields.length) {
        return fields;
      }

      const nextFields = [...fields];
      const [targetField] = nextFields.splice(currentIndex, 1);
      nextFields.splice(nextIndex, 0, targetField);
      return nextFields;
    });
  }

  function handleAddSelectedOutputField() {
    if (!selectedOutputFieldUUID) {
      return;
    }

    const selectedField = onesFields.find(
      (field) => field.uuid === selectedOutputFieldUUID
    );

    if (!selectedField) {
      return;
    }

    const nextField: SelectedAgentOutputField = {
      mode: 'set_value',
      field: toAgentFieldMeta(selectedField),
      description: '',
      subFields: []
    };

    if (outputs.some((field) => field.field.uuid === nextField.field.uuid)) {
      toast.error(
        t('pages.agentDetail.duplicateOutputField', {
          name: nextField.field.name
        })
      );
      return;
    }

    updateOutputFieldList((fields) => [...fields, nextField]);
    setSelectedOutputFieldUUID(undefined);
  }

  const persistAgentChanges = useCallback(
    async (agentUUID: string) => {
      const persistedSignature = currentEditorSignature;
      const validationError = validateBasicConfig();

      if (validationError) {
        setBasicConfigError(validationError);
        setActiveStep('basic');
        throw new Error(validationError);
      }

      const metadataResponse = await fetch(`/api/agents/${agentUUID}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: agentName.trim(),
          workspaceUUID: workspaceUUID || null,
          skillUUIDs,
          executorUUID: executorUUID || null,
          executorName: executorName || null
        })
      });
      const metadataPayload =
        (await metadataResponse.json()) as AgentMutationResponse;

      if (!metadataResponse.ok || !metadataPayload.success) {
        throw new Error(
          metadataPayload.success
            ? t('pages.agentDetail.basicConfigSaveFailed')
            : getApiErrorMessage(
                metadataPayload,
                t,
                'pages.agentDetail.basicConfigSaveFailed'
              )
        );
      }

      setAgentName(metadataPayload.data.name);
      setWorkspaceUUID(metadataPayload.data.workspace?.uuid ?? '');
      setSkillUUIDs(metadataPayload.data.skills.map((skill) => skill.uuid));
      setExecutorUUID(metadataPayload.data.executor?.uuid ?? '');
      setExecutorName(metadataPayload.data.executor?.name ?? '');
      setBasicConfigError(null);

      const config = buildAgentConfig();
      const saveDraftResponse = await fetch(`/api/agents/${agentUUID}/draft`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          config
        } satisfies { config: AgentConfig })
      });
      const saveDraftPayload =
        (await saveDraftResponse.json()) as SaveAgentDraftResponse;

      if (!saveDraftResponse.ok || !saveDraftPayload.success) {
        throw new Error(
          saveDraftPayload.success
            ? t('pages.agentDetail.draftSaveFailed')
            : getApiErrorMessage(
                saveDraftPayload,
                t,
                'pages.agentDetail.draftSaveFailed'
              )
        );
      }

      applyConfig(saveDraftPayload.data.draftConfig);
      setHasUnpublishedDraft(true);
      setEditBaselineSignature(persistedSignature);
    },
    [
      agentName,
      buildAgentConfig,
      currentEditorSignature,
      executorName,
      executorUUID,
      skillUUIDs,
      t,
      workspaceUUID
    ]
  );

  const handlePublish = useCallback(async () => {
    if (!uuid) {
      toast.error(t('pages.agentDetail.missingUuid'));
      return;
    }
    if (!canPublish) return;

    try {
      setIsPublishing(true);
      await persistAgentChanges(uuid);

      const publishResponse = await fetch(`/api/agents/${uuid}/publish`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const publishPayload =
        (await publishResponse.json()) as PublishAgentResponse;

      if (!publishResponse.ok || !publishPayload.success) {
        throw new Error(
          publishPayload.success
            ? t('pages.agentDetail.publishFailed')
            : getApiErrorMessage(
                publishPayload,
                t,
                'pages.agentDetail.publishFailed'
              )
        );
      }

      applyConfig(publishPayload.data.config);
      setHasUnpublishedDraft(false);
      setEditBaselineSignature(currentEditorSignature);
      setIsEditing(false);
      setIsPublishConfirmOpen(false);
      toast.success(t('pages.agentDetail.publishSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agentDetail.publishFailed'));
    } finally {
      setIsPublishing(false);
    }
  }, [canPublish, currentEditorSignature, persistAgentChanges, t, uuid]);

  const handleSilentSave = useCallback(async () => {
    if (!uuid || !isEditing || !hasLocalChanges) return;

    try {
      await persistAgentChanges(uuid);
    } catch {
      // silent save on step switch
    }
  }, [hasLocalChanges, isEditing, persistAgentChanges, uuid]);

  const handleStepSwitch = useCallback(
    (nextStep: StepKey) => {
      if (nextStep === activeStep) return;
      void handleSilentSave();
      setActiveStep(nextStep);
    },
    [activeStep, handleSilentSave]
  );

  const goToAdjacentStep = useCallback(
    (direction: 'previous' | 'next') => {
      const currentIndex = STEP_ORDER.indexOf(activeStep);
      const nextIndex =
        direction === 'previous' ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex < 0 || nextIndex >= STEP_ORDER.length) {
        return;
      }

      void handleSilentSave();
      setActiveStep(STEP_ORDER[nextIndex] ?? activeStep);
    },
    [activeStep, handleSilentSave]
  );

  const isLastStep =
    STEP_ORDER.indexOf(activeStep) === STEP_ORDER.length - 1;

  const handleStartEditing = useCallback(() => {
    setEditBaselineSignature(currentEditorSignature);
    setIsEditing(true);
  }, [currentEditorSignature]);

  const headerActions = useMemo(
    () => (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsPreviewOpen(true)}
          disabled={isLoadingDraft}
        >
          {t('pages.agentDetail.actions.previewPrompt')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => goToAdjacentStep('previous')}
          disabled={isBusy || STEP_ORDER.indexOf(activeStep) === 0}
        >
          <ChevronLeftIcon />
          {t('pages.agentDetail.actions.previousStep')}
        </Button>
        {!isLastStep ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => goToAdjacentStep('next')}
            disabled={isBusy}
          >
            {t('pages.agentDetail.actions.nextStep')}
            <ChevronRightIcon />
          </Button>
        ) : null}
        {!isEditing ? (
          <Button
            type="button"
            onClick={handleStartEditing}
            disabled={isBusy || !uuid}
          >
            <PencilIcon />
            {t('pages.agentDetail.actions.edit')}
          </Button>
        ) : isLastStep ? (
          <Button
            type="button"
            onClick={() => setIsPublishConfirmOpen(true)}
            disabled={isBusy || !uuid || !canPublish}
          >
            {t('pages.agentDetail.actions.publish')}
          </Button>
        ) : null}
      </>
    ),
    [
      activeStep,
      canPublish,
      goToAdjacentStep,
      handleStartEditing,
      isBusy,
      isEditing,
      isLastStep,
      isLoadingDraft,
      t,
      uuid
    ]
  );

  const headerCenter = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {stepItems.map((step, index) => (
          <button
            key={step.key}
            type="button"
            onClick={() => handleStepSwitch(step.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeStep === step.key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {index + 1}. {step.title}
          </button>
        ))}
      </div>
    ),
    [activeStep, handleStepSwitch, stepItems]
  );

  useEffect(() => {
    setActions(headerActions);

    return () => {
      setActions(null);
    };
  }, [headerActions, setActions]);

  useEffect(() => {
    setCenter(headerCenter);

    return () => {
      setCenter(null);
    };
  }, [headerCenter, setCenter]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        {draftErrorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {draftErrorMessage}
          </div>
        ) : null}

        {activeStep === 'basic' ? (
          <section className="rounded-xl border bg-card p-5">
            <div ref={setBasicConfigContentElement} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  orientation="vertical"
                  data-invalid={Boolean(basicConfigError)}
                  className="gap-3 md:flex-row md:items-start md:gap-6"
                >
                  <FieldLabel
                    htmlFor="agent-name"
                    className="md:w-24 md:shrink-0 md:justify-end md:pt-2 md:whitespace-nowrap"
                  >
                    {t('pages.agentDetail.basic.nameLabel')}
                  </FieldLabel>
                  <FieldContent className="md:w-[420px] md:flex-none">
                    <Input
                      id="agent-name"
                      value={agentName}
                      onChange={(event) => {
                        setAgentName(event.target.value);
                        setBasicConfigError(null);
                      }}
                      placeholder={t('pages.agentDetail.basic.namePlaceholder')}
                      disabled={isBusy || !isEditing}
                    />
                    <FieldError>{basicConfigError}</FieldError>
                  </FieldContent>
                </FormField>

                <FormField
                  orientation="vertical"
                  className="gap-3 md:flex-row md:items-start md:gap-6"
                >
                  <FieldLabel
                    htmlFor="agent-description"
                    className="md:w-24 md:shrink-0 md:justify-end md:pt-2 md:whitespace-nowrap"
                  >
                    {t('pages.agentDetail.basic.descriptionLabel')}
                  </FieldLabel>
                  <FieldContent className="md:w-[420px] md:flex-none">
                    <Textarea
                      id="agent-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder={t(
                        'pages.agentDetail.basic.descriptionPlaceholder'
                      )}
                      className="min-h-24 resize-y"
                      disabled={isBusy || !isEditing}
                    />
                  </FieldContent>
                </FormField>

                <FormField
                  orientation="vertical"
                  className="gap-3 md:flex-row md:items-start md:gap-6"
                >
                  <FieldLabel className="md:w-24 md:shrink-0 md:justify-end md:pt-2 md:whitespace-nowrap">
                    {t('pages.agentDetail.basic.executorLabel')}
                  </FieldLabel>
                  <FieldContent className="md:w-[420px] md:flex-none">
                    <div className="flex items-start gap-2">
                      <SearchSelect
                        options={mergedExecutorOptions}
                        value={executorUUID || undefined}
                        onValueChange={(value, option) => {
                          const selectedOption = option as
                            | ExecutorOption
                            | undefined;

                          setExecutorUUID(value ?? '');
                          setExecutorName(selectedOption?.executorName ?? '');
                        }}
                        onInputValueChange={setExecutorSearchKeyword}
                        placeholder={t('pages.agentDetail.basic.executorPlaceholder')}
                        emptyText={
                          isSearchingExecutors
                            ? t('pages.agentDetail.basic.executorSearchLoading')
                            : executorSearchKeyword.trim()
                              ? t('pages.agentDetail.basic.executorEmpty')
                              : t('pages.agentDetail.basic.executorSearchHint')
                        }
                        disabled={isBusy || !isEditing}
                        clearable
                        className="w-full md:shrink-0"
                        portalContainer={basicConfigContentElement}
                      />
                      <FieldHelpTooltip
                        label={t('pages.agentDetail.basic.executorHelpLabel')}
                        content={t('pages.agentDetail.basic.executorHelpContent')}
                      />
                    </div>
                  </FieldContent>
                </FormField>

                <FormField
                  orientation="vertical"
                  className="gap-3 md:flex-row md:items-start md:gap-6"
                >
                  <FieldLabel className="md:w-24 md:shrink-0 md:justify-end md:pt-2 md:whitespace-nowrap">
                    {t('pages.agentDetail.basic.workspaceLabel')}
                  </FieldLabel>
                  <FieldContent className="md:w-[420px] md:flex-none">
                    <div className="flex items-start gap-2">
                      <SearchSelect
                        options={workspaces.map((workspace) => ({
                          value: workspace.uuid,
                          label: workspace.name
                        }))}
                        value={workspaceUUID || undefined}
                        onValueChange={(value) => setWorkspaceUUID(value ?? '')}
                        placeholder={
                          isLoadingResources
                            ? t('pages.agentDetail.basic.workspacePlaceholderLoading')
                            : t('pages.agentDetail.basic.workspacePlaceholder')
                        }
                        emptyText={t('pages.agentDetail.basic.workspaceEmpty')}
                        disabled={isBusy || isLoadingResources || !isEditing}
                        clearable
                        className="w-full md:shrink-0"
                        portalContainer={basicConfigContentElement}
                      />
                      <FieldHelpTooltip
                        label={t('pages.agentDetail.basic.workspaceHelpLabel')}
                        content={t('pages.agentDetail.basic.workspaceHelpContent')}
                      />
                    </div>
                  </FieldContent>
                </FormField>

                <FormField
                  orientation="vertical"
                  className="gap-3 md:flex-row md:items-start md:gap-6"
                >
                  <FieldLabel className="md:w-24 md:shrink-0 md:justify-end md:pt-2 md:whitespace-nowrap">
                    {t('pages.agentDetail.basic.skillsLabel')}
                  </FieldLabel>
                  <FieldContent className="gap-3 md:w-[420px] md:flex-none">
                    <MultiSearchSelect
                      options={skills.map((skill) => ({
                        value: skill.uuid,
                        label: skill.name,
                        keywords: [skill.description].filter(Boolean)
                      }))}
                      values={skillUUIDs}
                      onValuesChange={(nextValues) => setSkillUUIDs(nextValues)}
                      placeholder={t('pages.agentDetail.basic.skillsPlaceholder')}
                      emptyText={t('pages.agentDetail.basic.skillsEmpty')}
                      disabled={isBusy || !isEditing}
                      portalContainer={basicConfigContentElement}
                    />
                  </FieldContent>
                </FormField>
              </div>

              {resourceErrorMessage ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {resourceErrorMessage}
                </div>
              ) : null}
            </div>
          </section>
          ) : null}

          {activeStep === 'inputs' ? (
            <InputFieldListEditor
              availableFields={onesFields}
              selectedFieldUUID={selectedInputFieldUUID}
              onSelectedFieldUUIDChange={setSelectedInputFieldUUID}
              onAddSelectedField={handleAddSelectedInputField}
              fields={inputs}
              onRemove={handleRemoveInputField}
              onMoveUp={(fieldUUIDPath) =>
                handleMoveInputField(fieldUUIDPath, 'up')
              }
              onMoveDown={(fieldUUIDPath) =>
                handleMoveInputField(fieldUUIDPath, 'down')
              }
              onChangeField={handleChangeInputField}
              isLoadingAvailableFields={isLoadingOnesFields}
              availableFieldsErrorMessage={onesFieldsErrorMessage}
              isDisabled={isBusy || !isEditing}
            />
          ) : null}

          {activeStep === 'outputs' ? (
            <OutputFieldListEditor
              availableFields={onesFields}
              selectedFieldUUID={selectedOutputFieldUUID}
              onSelectedFieldUUIDChange={setSelectedOutputFieldUUID}
              onAddSelectedField={handleAddSelectedOutputField}
              fields={outputs}
              onRemove={handleRemoveOutputField}
              onMoveUp={(fieldUUIDPath) =>
                handleMoveOutputField(fieldUUIDPath, 'up')
              }
              onMoveDown={(fieldUUIDPath) =>
                handleMoveOutputField(fieldUUIDPath, 'down')
              }
              onChangeField={handleChangeOutputField}
              isLoadingAvailableFields={isLoadingOnesFields}
              availableFieldsErrorMessage={onesFieldsErrorMessage}
              isDisabled={isBusy || !isEditing}
            />
          ) : null}

          {activeStep === 'prompt' ? (
            <section className="space-y-3">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleGeneratePromptRecommendation()}
                  disabled={
                    isBusy ||
                    !isEditing ||
                    isGeneratingRecommendation ||
                    !isAIConfigured ||
                    !agentName.trim()
                  }
                  title={
                    !isAIConfigured
                      ? t('pages.agentDetail.recommendation.notConfigured')
                      : undefined
                  }
                >
                  <SparklesIcon />
                  {isGeneratingRecommendation
                    ? t('pages.agentDetail.recommendation.generating')
                    : t('pages.agentDetail.recommendation.action')}
                </Button>
              </div>
              <MdEditor
                value={prompt}
                onChange={(v) => setPrompt(v)}
                placeholder={t('pages.agentDetail.prompt.placeholder')}
                style={{ height: '288px' }}
                preview={false}
                language={locale}
                disabled={isBusy || !isEditing}
                theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
              />
            </section>
          ) : null}

      </div>

      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent
          side="right"
          className="data-[side=right]:!w-full data-[side=right]:sm:!w-[50vw] data-[side=right]:sm:!max-w-none"
          overlayClassName="supports-backdrop-filter:backdrop-blur-none"
        >
          <SheetHeader>
            <SheetTitle>{t('pages.agentDetail.preview.title')}</SheetTitle>
            <SheetDescription>
              {t('pages.agentDetail.preview.description')}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-auto p-4 pt-0">
            <div className="rounded-lg border bg-muted/40 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {t('pages.agentDetail.preview.panelTitle')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {previewPrompt.length} chars
                </div>
              </div>
              <Separator className="mb-3" />
              {previewErrorMessage ? (
                <div className="text-sm text-destructive">
                  {previewErrorMessage}
                </div>
              ) : isLoadingPreview ? (
                <div className="text-sm text-muted-foreground">
                  {t('pages.agentDetail.preview.loading')}
                </div>
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
                  {previewPrompt}
                </pre>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={isRecommendationOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsRecommendationOpen(true);
          } else {
            closePromptRecommendation();
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t('pages.agentDetail.recommendation.title')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.agentDetail.recommendation.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] min-h-64 overflow-auto border bg-muted/20 p-4">
            {recommendationError ? (
              <div className="text-sm text-destructive">
                {recommendationError}
              </div>
            ) : recommendationPrompt ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                {recommendationPrompt}
              </pre>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t('pages.agentDetail.recommendation.generating')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePromptRecommendation}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={applyPromptRecommendation}
              disabled={
                isGeneratingRecommendation ||
                !recommendationPrompt ||
                recommendationContext !==
                  JSON.stringify(buildPromptRecommendationPayload())
              }
            >
              {t('pages.agentDetail.recommendation.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPublishConfirmOpen}
        onOpenChange={setIsPublishConfirmOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.agentDetail.publishDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('pages.agentDetail.publishDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPublishConfirmOpen(false)}
              disabled={isPublishing}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isPublishing || !canPublish}
            >
              {isPublishing
                ? t('pages.agentDetail.publishDialog.publishing')
                : t('pages.agentDetail.publishDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
