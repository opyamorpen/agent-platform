import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  AgentSummary,
  ApiError,
  ApiSuccess,
  RefObject,
  Workflow,
} from '@ones-ai-workflow/shared';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field as FormField,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useHeaderActions } from '@/layouts/app-layout';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type WorkflowResponse = ApiSuccess<Workflow> | ApiError;
type RefObjectsResponse = ApiSuccess<RefObject[]> | ApiError;
type AgentsResponse = ApiSuccess<AgentSummary[]> | ApiError;
type CreateWorkflowNodePayload = {
  project: RefObject;
  issueType: RefObject;
  status: RefObject;
  agentUUID: string;
  postActions: Array<{
    type: 'transition_issue_status';
    targetStatus: RefObject;
  }>;
};
type WorkflowNodeDialogMode = 'create' | 'edit';
type WorkflowNodeMutationResponse = ApiSuccess<Workflow['nodes'][number]> | ApiError;
type FormErrors = {
  projectUUID?: string;
  issueTypeUUID?: string;
  statusUUID?: string;
  agentUUID?: string;
  targetStatusUUID?: string;
  submit?: string;
};

const DEFAULT_FORM_STATE = {
  projectUUID: '',
  issueTypeUUID: '',
  statusUUID: '',
  agentUUID: '',
  enableSuccessTransition: false,
  targetStatusUUID: ''
};

function toSearchSelectOptions(items: RefObject[]) {
  return items.map((item) => ({
    value: item.uuid,
    label: item.name,
    keywords: [item.uuid]
  }));
}

export function WorkflowDetailPage() {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const { setTitle, setActions } = useHeaderActions();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<WorkflowNodeDialogMode>('create');
  const [editingNodeUUID, setEditingNodeUUID] = useState<string | null>(null);
  const [projects, setProjects] = useState<RefObject[]>([]);
  const [issueTypes, setIssueTypes] = useState<RefObject[]>([]);
  const [issueStatuses, setIssueStatuses] = useState<RefObject[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsErrorMessage, setOptionsErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [dialogContentElement, setDialogContentElement] = useState<HTMLDivElement | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] =
    useState<Workflow['nodes'][number] | null>(null);
  const [deletingNodeUUID, setDeletingNodeUUID] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setActions(null);
      setTitle(null);
    };
  }, [setActions, setTitle]);

  async function loadWorkflow() {
    if (!uuid) {
      setWorkflow(null);
      setErrorMessage(t('pages.workflowDetail.missingUuid'));
      setIsLoading(false);
      setTitle(t('pages.workflowDetail.pageTitle'));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/workflows/${uuid}`);
      const payload = (await response.json()) as WorkflowResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.workflowDetail.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.workflowDetail.loadFailed')
        );
      }

      setWorkflow(payload.data);
      setTitle(payload.data.name);
    } catch (error) {
      setWorkflow(null);
      setTitle(t('pages.workflowDetail.pageTitle'));
      setErrorMessage(getErrorMessage(error, t, 'pages.workflowDetail.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflow();
  }, [setTitle, uuid]);

  function resetForm() {
    setFormData(DEFAULT_FORM_STATE);
    setFormErrors({});
  }

  function updateWorkflowNodes(
    node: Workflow['nodes'][number],
    mode: WorkflowNodeDialogMode
  ) {
    setWorkflow((currentWorkflow) => {
      if (!currentWorkflow) {
        return currentWorkflow;
      }

      return {
        ...currentWorkflow,
        nodes:
          mode === 'edit'
            ? currentWorkflow.nodes.map((currentNode) =>
                currentNode.uuid === node.uuid ? node : currentNode
              )
            : [...currentWorkflow.nodes, node]
      };
    });
  }

  function openCreateDialog() {
    setDialogMode('create');
    setEditingNodeUUID(null);
    resetForm();
    setIsNodeDialogOpen(true);
  }

  function openEditDialog(node: Workflow['nodes'][number]) {
    setDialogMode('edit');
    setEditingNodeUUID(node.uuid);
    setFormData({
      projectUUID: node.project.uuid,
      issueTypeUUID: node.issueType.uuid,
      statusUUID: node.status.uuid,
      agentUUID: node.agent.uuid,
      enableSuccessTransition: node.postActions.length > 0,
      targetStatusUUID:
        node.postActions[0]?.type === 'transition_issue_status'
          ? node.postActions[0].targetStatus.uuid
          : ''
    });
    setFormErrors({});
    setIsNodeDialogOpen(true);
  }

  async function loadOptions() {
    setIsLoadingOptions(true);
    setOptionsErrorMessage(null);

    try {
      const [projectsResponse, issueTypesResponse, issueStatusesResponse, agentsResponse] =
        await Promise.all([
          fetch('/api/ones/projects'),
          fetch('/api/ones/issue-types'),
          fetch('/api/ones/issue-statuses'),
          fetch('/api/agents')
        ]);

      const [projectsPayload, issueTypesPayload, issueStatusesPayload, agentsPayload] =
        (await Promise.all([
          projectsResponse.json(),
          issueTypesResponse.json(),
          issueStatusesResponse.json(),
          agentsResponse.json()
        ])) as [
          RefObjectsResponse,
          RefObjectsResponse,
          RefObjectsResponse,
          AgentsResponse
        ];

      if (!projectsResponse.ok || !projectsPayload.success) {
        throw new Error(
          projectsPayload.success
            ? t('pages.workflowDetail.projectsLoadFailed')
            : getApiErrorMessage(
                projectsPayload,
                t,
                'pages.workflowDetail.projectsLoadFailed'
              )
        );
      }

      if (!issueTypesResponse.ok || !issueTypesPayload.success) {
        throw new Error(
          issueTypesPayload.success
            ? t('pages.workflowDetail.issueTypesLoadFailed')
            : getApiErrorMessage(
                issueTypesPayload,
                t,
                'pages.workflowDetail.issueTypesLoadFailed'
              )
        );
      }

      if (!issueStatusesResponse.ok || !issueStatusesPayload.success) {
        throw new Error(
          issueStatusesPayload.success
            ? t('pages.workflowDetail.statusesLoadFailed')
            : getApiErrorMessage(
                issueStatusesPayload,
                t,
                'pages.workflowDetail.statusesLoadFailed'
              )
        );
      }

      if (!agentsResponse.ok || !agentsPayload.success) {
        throw new Error(
          agentsPayload.success
            ? t('pages.workflowDetail.agentsLoadFailed')
            : getApiErrorMessage(
                agentsPayload,
                t,
                'pages.workflowDetail.agentsLoadFailed'
              )
        );
      }

      setProjects(projectsPayload.data);
      setIssueTypes(issueTypesPayload.data);
      setIssueStatuses(issueStatusesPayload.data);
      setAgents(agentsPayload.data);
    } catch (error) {
      setOptionsErrorMessage(getErrorMessage(error, t, 'pages.workflowDetail.optionsLoadFailed'));
    } finally {
      setIsLoadingOptions(false);
    }
  }

  useEffect(() => {
    if (!isNodeDialogOpen) {
      return;
    }

    if (
      projects.length > 0 &&
      issueTypes.length > 0 &&
      issueStatuses.length > 0 &&
      agents.length > 0
    ) {
      return;
    }

    void loadOptions();
  }, [agents.length, isNodeDialogOpen, issueStatuses.length, issueTypes.length, projects.length]);

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!formData.projectUUID) {
      nextErrors.projectUUID = t('pages.workflowDetail.validation.projectRequired');
    }

    if (!formData.issueTypeUUID) {
      nextErrors.issueTypeUUID = t('pages.workflowDetail.validation.issueTypeRequired');
    }

    if (!formData.statusUUID) {
      nextErrors.statusUUID = t('pages.workflowDetail.validation.statusRequired');
    }

    if (!formData.agentUUID) {
      nextErrors.agentUUID = t('pages.workflowDetail.validation.agentRequired');
    }

    if (formData.enableSuccessTransition && !formData.targetStatusUUID) {
      nextErrors.targetStatusUUID = t(
        'pages.workflowDetail.validation.targetStatusRequired'
      );
    }

    if (
      formData.enableSuccessTransition &&
      formData.targetStatusUUID === formData.statusUUID
    ) {
      nextErrors.targetStatusUUID = t(
        'pages.workflowDetail.validation.targetStatusMustDiffer'
      );
    }

    return nextErrors;
  }

  async function handleSubmitNode() {
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    if (!uuid) {
      setFormErrors({
        submit: t('pages.workflowDetail.missingUuid')
      });
      return;
    }

    const project = projects.find((item) => item.uuid === formData.projectUUID);
    const issueType = issueTypes.find((item) => item.uuid === formData.issueTypeUUID);
    const status = issueStatuses.find((item) => item.uuid === formData.statusUUID);
    const targetStatus = formData.enableSuccessTransition
      ? issueStatuses.find((item) => item.uuid === formData.targetStatusUUID)
      : null;

    if (
      !project ||
      !issueType ||
      !status ||
      (formData.enableSuccessTransition && !targetStatus)
    ) {
      setFormErrors({
        submit: t('pages.workflowDetail.validation.incompleteSelection')
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setFormErrors({});

      const payloadData = {
        project,
        issueType,
        status,
        agentUUID: formData.agentUUID,
        postActions: targetStatus
          ? [
              {
                type: 'transition_issue_status' as const,
                targetStatus
              }
            ]
          : []
      } satisfies CreateWorkflowNodePayload;
      const isEditing = dialogMode === 'edit' && editingNodeUUID;
      const response = await fetch(
        isEditing ? `/api/workflows/nodes/${editingNodeUUID}` : `/api/workflows/${uuid}/nodes`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(payloadData)
        }
      );
      const payload = (await response.json()) as WorkflowNodeMutationResponse;
      const fallbackKey =
        isEditing
          ? 'pages.workflowDetail.updateNodeFailed'
          : 'pages.workflowDetail.createNodeFailed';

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t(fallbackKey)
            : getApiErrorMessage(payload, t, fallbackKey)
        );
      }

      updateWorkflowNodes(payload.data, isEditing ? 'edit' : 'create');
      toast.success(
        t(
          isEditing
            ? 'pages.workflowDetail.updateNodeSuccess'
            : 'pages.workflowDetail.createNodeSuccess'
        )
      );
      setIsNodeDialogOpen(false);
      setEditingNodeUUID(null);
      resetForm();
    } catch (error) {
      const fallbackKey =
        dialogMode === 'edit'
          ? 'pages.workflowDetail.updateNodeFailed'
          : 'pages.workflowDetail.createNodeFailed';
      setFormErrors({
        submit: getErrorMessage(error, t, fallbackKey)
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteNode() {
    if (!pendingDeleteNode) {
      return;
    }

    try {
      setDeletingNodeUUID(pendingDeleteNode.uuid);

      const response = await fetch(`/api/workflows/nodes/${pendingDeleteNode.uuid}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(
          payload
            ? getApiErrorMessage(payload, t, 'pages.workflowDetail.deleteNodeFailed')
            : t('pages.workflowDetail.deleteNodeFailed')
        );
      }

      setWorkflow((currentWorkflow) => {
        if (!currentWorkflow) {
          return currentWorkflow;
        }

        return {
          ...currentWorkflow,
          nodes: currentWorkflow.nodes.filter(
            (node) => node.uuid !== pendingDeleteNode.uuid
          )
        };
      });
      toast.success(t('pages.workflowDetail.deleteNodeSuccess'));
      setPendingDeleteNode(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.workflowDetail.deleteNodeFailed'));
    } finally {
      setDeletingNodeUUID(null);
    }
  }

  const projectOptions = useMemo(() => toSearchSelectOptions(projects), [projects]);
  const issueTypeOptions = useMemo(() => toSearchSelectOptions(issueTypes), [issueTypes]);
  const issueStatusOptions = useMemo(
    () => toSearchSelectOptions(issueStatuses),
    [issueStatuses]
  );

  const agentOptions = useMemo(
    () => agents.map((agent) => ({
      value: agent.uuid,
      label: agent.name,
      keywords: [agent.uuid]
    })),
    [agents]
  );

  useEffect(() => {
    setActions(null);

    return () => {
      setActions(null);
    };
  }, [setActions]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex items-center justify-start">
          <Button
            type="button"
            size="sm"
            onClick={openCreateDialog}
            disabled={isLoading || Boolean(errorMessage) || !uuid}
          >
            <PlusIcon />
            {t('pages.workflowDetail.actions.createNode')}
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-16 px-4">
                  {t('pages.workflowDetail.table.index')}
                </TableHead>
                <TableHead>{t('pages.workflowDetail.table.project')}</TableHead>
                <TableHead>{t('pages.workflowDetail.table.issueType')}</TableHead>
                <TableHead>{t('pages.workflowDetail.table.status')}</TableHead>
                <TableHead>{t('pages.workflowDetail.table.agent')}</TableHead>
                <TableHead>{t('pages.workflowDetail.table.postAction')}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.workflowDetail.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 px-4 text-center text-destructive"
                  >
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : !workflow || workflow.nodes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.workflowDetail.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                workflow.nodes.map((node, index) => (
                  <TableRow key={node.uuid}>
                    <TableCell className="px-4 font-medium">{index + 1}</TableCell>
                    <TableCell>{node.project.name}</TableCell>
                    <TableCell>{node.issueType.name}</TableCell>
                    <TableCell>{node.status.name}</TableCell>
                    <TableCell className="pr-4">
                      {node.agent.name}
                    </TableCell>
                    <TableCell>
                      {node.postActions[0]?.type === 'transition_issue_status'
                        ? t('pages.workflowDetail.table.transitionTo', {
                            status: node.postActions[0].targetStatus.name
                          })
                        : t('pages.workflowDetail.table.noPostAction')}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(node)}
                          disabled={isSubmitting || Boolean(deletingNodeUUID)}
                        >
                          <PencilIcon />
                          {t('pages.workflowDetail.actions.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingDeleteNode(node)}
                          disabled={Boolean(deletingNodeUUID)}
                        >
                          <Trash2Icon />
                          {t('pages.workflowDetail.actions.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog
        open={isNodeDialogOpen}
        onOpenChange={(open) => {
          setIsNodeDialogOpen(open);

          if (!open) {
            setEditingNodeUUID(null);
            resetForm();
          }
        }}
      >
        <DialogContent
          ref={setDialogContentElement}
          className="sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit'
                ? t('pages.workflowDetail.dialog.editTitle')
                : t('pages.workflowDetail.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? t('pages.workflowDetail.dialog.editDescription')
                : t('pages.workflowDetail.dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {optionsErrorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {optionsErrorMessage}
              </div>
            ) : null}
            <FormField data-invalid={Boolean(formErrors.projectUUID)}>
              <FieldLabel>{t('pages.workflowDetail.dialog.projectLabel')}</FieldLabel>
              <FieldContent>
                <SearchSelect
                  options={projectOptions}
                  value={formData.projectUUID || undefined}
                  onValueChange={(value) => {
                    setFormData((current) => ({
                      ...current,
                      projectUUID: value ?? ''
                    }));
                    setFormErrors((current) => ({
                      ...current,
                      projectUUID: undefined,
                      submit: undefined
                    }));
                  }}
                  placeholder={
                    isLoadingOptions
                      ? t('pages.workflowDetail.dialog.projectPlaceholderLoading')
                      : t('pages.workflowDetail.dialog.projectPlaceholder')
                  }
                  emptyText={t('pages.workflowDetail.dialog.projectEmpty')}
                  disabled={isLoadingOptions || Boolean(optionsErrorMessage)}
                  portalContainer={dialogContentElement}
                />
                <FieldError>{formErrors.projectUUID}</FieldError>
              </FieldContent>
            </FormField>
            <FormField data-invalid={Boolean(formErrors.issueTypeUUID)}>
              <FieldLabel>{t('pages.workflowDetail.dialog.issueTypeLabel')}</FieldLabel>
              <FieldContent>
                <SearchSelect
                  options={issueTypeOptions}
                  value={formData.issueTypeUUID || undefined}
                  onValueChange={(value) => {
                    setFormData((current) => ({
                      ...current,
                      issueTypeUUID: value ?? ''
                    }));
                    setFormErrors((current) => ({
                      ...current,
                      issueTypeUUID: undefined,
                      submit: undefined
                    }));
                  }}
                  placeholder={
                    isLoadingOptions
                      ? t('pages.workflowDetail.dialog.issueTypePlaceholderLoading')
                      : t('pages.workflowDetail.dialog.issueTypePlaceholder')
                  }
                  emptyText={t('pages.workflowDetail.dialog.issueTypeEmpty')}
                  disabled={isLoadingOptions || Boolean(optionsErrorMessage)}
                  portalContainer={dialogContentElement}
                />
                <FieldError>{formErrors.issueTypeUUID}</FieldError>
              </FieldContent>
            </FormField>
            <FormField data-invalid={Boolean(formErrors.statusUUID)}>
              <FieldLabel>{t('pages.workflowDetail.dialog.statusLabel')}</FieldLabel>
              <FieldContent>
                <SearchSelect
                  options={issueStatusOptions}
                  value={formData.statusUUID || undefined}
                  onValueChange={(value) => {
                    setFormData((current) => ({
                      ...current,
                      statusUUID: value ?? ''
                    }));
                    setFormErrors((current) => ({
                      ...current,
                      statusUUID: undefined,
                      submit: undefined
                    }));
                  }}
                  placeholder={
                    isLoadingOptions
                      ? t('pages.workflowDetail.dialog.statusPlaceholderLoading')
                      : t('pages.workflowDetail.dialog.statusPlaceholder')
                  }
                  emptyText={t('pages.workflowDetail.dialog.statusEmpty')}
                  disabled={isLoadingOptions || Boolean(optionsErrorMessage)}
                  portalContainer={dialogContentElement}
                />
                <FieldError>{formErrors.statusUUID}</FieldError>
              </FieldContent>
            </FormField>
            <FormField data-invalid={Boolean(formErrors.agentUUID)}>
              <FieldLabel>{t('pages.workflowDetail.dialog.agentLabel')}</FieldLabel>
              <FieldContent>
                <SearchSelect
                  options={agentOptions}
                  value={formData.agentUUID || undefined}
                  onValueChange={(value) => {
                    setFormData((current) => ({
                      ...current,
                      agentUUID: value ?? ''
                    }));
                    setFormErrors((current) => ({
                      ...current,
                      agentUUID: undefined,
                      submit: undefined
                    }));
                  }}
                  placeholder={
                    isLoadingOptions
                      ? t('pages.workflowDetail.dialog.agentPlaceholderLoading')
                      : t('pages.workflowDetail.dialog.agentPlaceholder')
                  }
                  emptyText={t('pages.workflowDetail.dialog.agentEmpty')}
                  disabled={isLoadingOptions || Boolean(optionsErrorMessage)}
                  portalContainer={dialogContentElement}
                />
                <FieldError>{formErrors.agentUUID}</FieldError>
              </FieldContent>
            </FormField>
            <FormField data-invalid={Boolean(formErrors.targetStatusUUID)}>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="workflow-node-success-transition"
                  checked={formData.enableSuccessTransition}
                  onCheckedChange={(checked) => {
                    setFormData((current) => ({
                      ...current,
                      enableSuccessTransition: checked === true,
                      targetStatusUUID: checked === true ? current.targetStatusUUID : ''
                    }));
                    setFormErrors((current) => ({
                      ...current,
                      targetStatusUUID: undefined,
                      submit: undefined
                    }));
                  }}
                />
                <FieldLabel htmlFor="workflow-node-success-transition">
                  {t('pages.workflowDetail.dialog.successTransitionLabel')}
                </FieldLabel>
              </div>
              {formData.enableSuccessTransition ? (
                <FieldContent>
                  <SearchSelect
                    options={issueStatusOptions}
                    value={formData.targetStatusUUID || undefined}
                    onValueChange={(value) => {
                      setFormData((current) => ({
                        ...current,
                        targetStatusUUID: value ?? ''
                      }));
                      setFormErrors((current) => ({
                        ...current,
                        targetStatusUUID: undefined,
                        submit: undefined
                      }));
                    }}
                    placeholder={t(
                      'pages.workflowDetail.dialog.successTransitionPlaceholder'
                    )}
                    emptyText={t('pages.workflowDetail.dialog.statusEmpty')}
                    disabled={isLoadingOptions || Boolean(optionsErrorMessage)}
                    portalContainer={dialogContentElement}
                  />
                  <FieldError>{formErrors.targetStatusUUID}</FieldError>
                </FieldContent>
              ) : null}
            </FormField>
            <FieldError>{formErrors.submit}</FieldError>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNodeDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitNode()}
              disabled={isSubmitting || isLoadingOptions || Boolean(optionsErrorMessage)}
            >
              {isSubmitting
                ? dialogMode === 'edit'
                  ? t('pages.workflowDetail.dialog.saving')
                  : t('pages.workflowDetail.dialog.creating')
                : dialogMode === 'edit'
                  ? t('pages.workflowDetail.actions.save')
                  : t('pages.workflowDetail.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(pendingDeleteNode)}
        onOpenChange={(open) => {
          if (!open && !deletingNodeUUID) {
            setPendingDeleteNode(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.workflowDetail.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.workflowDetail.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingNodeUUID)}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteNode()}
              disabled={Boolean(deletingNodeUUID)}
            >
              {deletingNodeUUID
                ? t('common.states.deleting')
                : t('common.actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
