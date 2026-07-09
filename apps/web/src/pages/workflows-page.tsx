import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiError, ApiSuccess, WorkflowSummary } from '@ones-ai-workflow/shared';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { PencilIcon, PlusIcon, Trash2Icon, WorkflowIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type WorkflowsResponse = ApiSuccess<WorkflowSummary[]> | ApiError;
type WorkflowNamePayload = {
  name: string;
};
type WorkflowTogglePayload = {
  isActive: boolean;
};
type WorkflowDialogMode = 'create' | 'edit';
type FormErrors = {
  name?: string;
  submit?: string;
};

const DEFAULT_FORM_STATE = {
  name: ''
};

export function WorkflowsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<WorkflowDialogMode>('create');
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowSummary | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteWorkflow, setPendingDeleteWorkflow] =
    useState<WorkflowSummary | null>(null);
  const [deletingWorkflowUUID, setDeletingWorkflowUUID] = useState<string | null>(null);
  const [togglingWorkflowUUID, setTogglingWorkflowUUID] = useState<string | null>(null);

  async function loadWorkflows() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/workflows');
      const payload = (await response.json()) as WorkflowsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.workflows.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.workflows.loadFailed')
        );
      }

      setWorkflows(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.workflows.loadFailed'));
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflows();
  }, []);

  function resetForm() {
    setFormData(DEFAULT_FORM_STATE);
    setFormErrors({});
  }

  function openCreateDialog() {
    setDialogMode('create');
    setEditingWorkflow(null);
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(workflow: WorkflowSummary) {
    setDialogMode('edit');
    setEditingWorkflow(workflow);
    setFormData({
      name: workflow.name
    });
    setFormErrors({});
    setIsDialogOpen(true);
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = t('pages.workflows.validation.nameRequired');
    }

    return nextErrors;
  }

  async function handleSubmit() {
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setFormErrors({});

      const isEditing = dialogMode === 'edit' && editingWorkflow;
      const response = await fetch(
        isEditing ? `/api/workflows/${editingWorkflow.uuid}` : '/api/workflows',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: formData.name.trim()
          } satisfies WorkflowNamePayload)
        }
      );
      const payload = (await response.json()) as ApiSuccess<WorkflowSummary> | ApiError;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.workflows.saveFailed')
            : getApiErrorMessage(payload, t, 'pages.workflows.saveFailed')
        );
      }

      setIsDialogOpen(false);
      resetForm();

      if (isEditing) {
        setWorkflows((currentWorkflows) =>
          currentWorkflows.map((workflow) =>
            workflow.uuid === payload.data.uuid ? payload.data : workflow
          )
        );
        setEditingWorkflow(null);
        toast.success(t('pages.workflows.updateNameSuccess'));
      } else {
        toast.success(t('pages.workflows.createSuccess'));
        navigate(`/settings/workflows/${payload.data.uuid}`);
      }
    } catch (error) {
      const message = getErrorMessage(error, t, 'pages.workflows.saveFailed');
      setFormErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteWorkflow() {
    if (!pendingDeleteWorkflow) {
      return;
    }

    try {
      setDeletingWorkflowUUID(pendingDeleteWorkflow.uuid);

      const response = await fetch(`/api/workflows/${pendingDeleteWorkflow.uuid}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(
          payload
            ? getApiErrorMessage(payload, t, 'pages.workflows.deleteFailed')
            : t('pages.workflows.deleteFailed')
        );
      }

      await loadWorkflows();
      toast.success(
        t('pages.workflows.deleteSuccess', { name: pendingDeleteWorkflow.name })
      );
      setPendingDeleteWorkflow(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.workflows.deleteFailed'));
    } finally {
      setDeletingWorkflowUUID(null);
    }
  }

  async function handleToggleWorkflow(workflow: WorkflowSummary) {
    const nextIsActive = !workflow.isActive;

    try {
      setTogglingWorkflowUUID(workflow.uuid);

      const response = await fetch(`/api/workflows/${workflow.uuid}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          isActive: nextIsActive
        } satisfies WorkflowTogglePayload)
      });
      const payload = (await response.json()) as ApiSuccess<WorkflowSummary> | ApiError;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.workflows.toggleFailed')
            : getApiErrorMessage(payload, t, 'pages.workflows.toggleFailed')
        );
      }

      setWorkflows((currentWorkflows) =>
        currentWorkflows.map((currentWorkflow) =>
          currentWorkflow.uuid === payload.data.uuid ? payload.data : currentWorkflow
        )
      );
      toast.success(
        nextIsActive
          ? t('pages.workflows.enabledSuccess')
          : t('pages.workflows.disabledSuccess')
      );
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.workflows.toggleFailed'));
    } finally {
      setTogglingWorkflowUUID(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex items-center justify-start">
          <Button size="sm" onClick={openCreateDialog}>
            <PlusIcon />
            {t('pages.workflows.actions.create')}
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="px-4">{t('pages.workflows.table.index')}</TableHead>
                <TableHead>{t('pages.workflows.table.name')}</TableHead>
                <TableHead className="w-[180px]">{t('pages.workflows.table.status')}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.workflows.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 px-4 text-center text-destructive"
                  >
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : workflows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.workflows.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                workflows.map((workflow, index) => (
                  <TableRow key={workflow.uuid}>
                    <TableCell className="px-4 font-medium">{index + 1}</TableCell>
                    <TableCell>{workflow.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={workflow.isActive}
                          size="sm"
                          onCheckedChange={() => void handleToggleWorkflow(workflow)}
                          disabled={
                            isSubmitting ||
                            Boolean(deletingWorkflowUUID) ||
                            Boolean(togglingWorkflowUUID)
                          }
                          aria-label={
                            workflow.isActive
                              ? t('pages.workflows.status.disableAria', {
                                  name: workflow.name
                                })
                              : t('pages.workflows.status.enableAria', {
                                  name: workflow.name
                                })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {workflow.isActive
                            ? t('pages.workflows.status.enabled')
                            : t('pages.workflows.status.disabled')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(workflow)}
                          disabled={isSubmitting || Boolean(deletingWorkflowUUID)}
                        >
                          <PencilIcon />
                          {t('pages.workflows.actions.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/settings/workflows/${workflow.uuid}`)}
                          disabled={Boolean(deletingWorkflowUUID)}
                        >
                          <WorkflowIcon />
                          {t('pages.workflows.actions.configureNodes')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingDeleteWorkflow(workflow)}
                          disabled={Boolean(deletingWorkflowUUID)}
                        >
                          <Trash2Icon />
                          {t('pages.workflows.actions.delete')}
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
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingWorkflow(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'edit'
                ? t('pages.workflows.dialog.editTitle')
                : t('pages.workflows.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? t('pages.workflows.dialog.editDescription')
                : t('pages.workflows.dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField data-invalid={Boolean(formErrors.name)}>
              <FieldLabel htmlFor="workflow-name">
                {t('pages.workflows.dialog.nameLabel')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="workflow-name"
                  value={formData.name}
                  onChange={(event) => {
                    setFormData({
                      name: event.target.value
                    });
                    setFormErrors((currentErrors) => ({
                      ...currentErrors,
                      name: undefined,
                      submit: undefined
                    }));
                  }}
                  placeholder={t('pages.workflows.dialog.namePlaceholder')}
                  disabled={isSubmitting}
                />
                <FieldError>{formErrors.name}</FieldError>
              </FieldContent>
            </FormField>
            <FieldError>{formErrors.submit}</FieldError>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting
                ? dialogMode === 'edit'
                  ? t('pages.workflows.dialog.saving')
                  : t('pages.workflows.dialog.creating')
                : dialogMode === 'edit'
                  ? t('pages.workflows.actions.save')
                  : t('pages.workflows.actions.createSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(pendingDeleteWorkflow)}
        onOpenChange={(open) => {
          if (!open && !deletingWorkflowUUID) {
            setPendingDeleteWorkflow(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.workflows.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteWorkflow
                ? t('pages.workflows.deleteDialog.descriptionWithName', {
                    name: pendingDeleteWorkflow.name
                  })
                : t('pages.workflows.deleteDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingWorkflowUUID)}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteWorkflow()}
              disabled={Boolean(deletingWorkflowUUID)}
            >
              {deletingWorkflowUUID
                ? t('common.states.deleting')
                : t('common.actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
