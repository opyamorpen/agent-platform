import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AgentWorkspace, ApiError, ApiSuccess } from '@ones-ai-workflow/shared';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  FolderIcon,
  KeyIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentWorkspacesResponse = ApiSuccess<AgentWorkspace[]> | ApiError;
type AgentWorkspaceResponse = ApiSuccess<AgentWorkspace> | ApiError;
type WorkspaceDialogMode = 'create' | 'edit';
type WorkspaceFormErrors = {
  name?: string;
  submit?: string;
};

const DEFAULT_WORKSPACE_FORM = {
  name: ''
};

export function AgentWorkspacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<AgentWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const [workspaceDialogMode, setWorkspaceDialogMode] =
    useState<WorkspaceDialogMode>('create');
  const [editingWorkspace, setEditingWorkspace] = useState<AgentWorkspace | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState(DEFAULT_WORKSPACE_FORM);
  const [workspaceErrors, setWorkspaceErrors] = useState<WorkspaceFormErrors>({});
  const [pendingDeleteWorkspace, setPendingDeleteWorkspace] =
    useState<AgentWorkspace | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingWorkspaceUUID, setDeletingWorkspaceUUID] = useState<string | null>(null);

  useEffect(() => {
    void loadAgentWorkspaces();
  }, []);

  async function loadAgentWorkspaces() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/agent-workspaces');
      const payload = (await response.json()) as AgentWorkspacesResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaces.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.agentWorkspaces.loadFailed')
        );
      }

      setWorkspaces(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.agentWorkspaces.loadFailed'));
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }

  function upsertWorkspace(nextWorkspace: AgentWorkspace) {
    setWorkspaces((currentWorkspaces) => {
      const existingIndex = currentWorkspaces.findIndex(
        (workspace) => workspace.uuid === nextWorkspace.uuid
      );

      if (existingIndex < 0) {
        return [...currentWorkspaces, nextWorkspace];
      }

      return currentWorkspaces.map((workspace) =>
        workspace.uuid === nextWorkspace.uuid ? nextWorkspace : workspace
      );
    });
  }

  function removeWorkspace(workspaceUUID: string) {
    setWorkspaces((currentWorkspaces) =>
      currentWorkspaces.filter((workspace) => workspace.uuid !== workspaceUUID)
    );
  }

  function resetWorkspaceForm() {
    setWorkspaceForm(DEFAULT_WORKSPACE_FORM);
    setWorkspaceErrors({});
    setEditingWorkspace(null);
  }

  function openCreateWorkspaceDialog() {
    setWorkspaceDialogMode('create');
    resetWorkspaceForm();
    setIsWorkspaceDialogOpen(true);
  }

  function openEditWorkspaceDialog(workspace: AgentWorkspace) {
    setWorkspaceDialogMode('edit');
    setEditingWorkspace(workspace);
    setWorkspaceForm({
      name: workspace.name
    });
    setWorkspaceErrors({});
    setIsWorkspaceDialogOpen(true);
  }

  function validateWorkspaceForm(): WorkspaceFormErrors {
    const nextErrors: WorkspaceFormErrors = {};

    if (!workspaceForm.name.trim()) {
      nextErrors.name = t('pages.agentWorkspaces.validation.nameRequired');
    }

    return nextErrors;
  }

  async function handleWorkspaceSubmit() {
    const nextErrors = validateWorkspaceForm();

    if (Object.keys(nextErrors).length > 0) {
      setWorkspaceErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setWorkspaceErrors({});

      const isEditing = workspaceDialogMode === 'edit' && editingWorkspace;
      const response = await fetch(
        isEditing
          ? `/api/agent-workspaces/${editingWorkspace.uuid}`
          : '/api/agent-workspaces',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: workspaceForm.name.trim()
          })
        }
      );
      const payload = (await response.json()) as AgentWorkspaceResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaces.saveFailed')
            : getApiErrorMessage(payload, t, 'pages.agentWorkspaces.saveFailed')
        );
      }

      upsertWorkspace(payload.data);
      setIsWorkspaceDialogOpen(false);
      resetWorkspaceForm();
      toast.success(
        isEditing
          ? t('pages.agentWorkspaces.updateSuccess')
          : t('pages.agentWorkspaces.createSuccess')
      );
    } catch (error) {
      const message = getErrorMessage(error, t, 'pages.agentWorkspaces.saveFailed');
      setWorkspaceErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!pendingDeleteWorkspace) {
      return;
    }

    try {
      setDeletingWorkspaceUUID(pendingDeleteWorkspace.uuid);

      const response = await fetch(
        `/api/agent-workspaces/${pendingDeleteWorkspace.uuid}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(
          payload
            ? getApiErrorMessage(payload, t, 'pages.agentWorkspaces.deleteFailed')
            : t('pages.agentWorkspaces.deleteFailed')
        );
      }

      removeWorkspace(pendingDeleteWorkspace.uuid);
      toast.success(
        t('pages.agentWorkspaces.deleteSuccess', {
          name: pendingDeleteWorkspace.name
        })
      );
      setPendingDeleteWorkspace(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agentWorkspaces.deleteFailed'));
    } finally {
      setDeletingWorkspaceUUID(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex items-center justify-start">
          <Button onClick={openCreateWorkspaceDialog}>
            <PlusIcon />
            {t('pages.agentWorkspaces.actions.create')}
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="px-4">{t('pages.agentWorkspaces.table.workspace')}</TableHead>
                <TableHead>{t('pages.agentWorkspaces.table.repositories')}</TableHead>
                <TableHead>{t('pages.agentWorkspaces.table.credentials')}</TableHead>
                <TableHead className="w-[440px] pr-4 text-right">
                  {t('pages.agentWorkspaces.table.actions')}
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
              ) : workspaces.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.agentWorkspaces.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                workspaces.map((workspace) => (
                  <TableRow key={workspace.uuid}>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2 font-medium">
                        <FolderIcon className="size-4 text-muted-foreground" />
                        <span>{workspace.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t('pages.agentWorkspaces.table.repositoryCount', {
                        count: workspace.repositories.length
                      })}
                    </TableCell>
                    <TableCell>
                      {t('pages.agentWorkspaces.table.credentialCount', {
                        count: workspace.credentialCount
                      })}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditWorkspaceDialog(workspace)}
                        >
                          <PencilIcon />
                          {t('pages.agentWorkspaces.actions.edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(`/settings/agent-workspaces/${workspace.uuid}/repositories`)
                          }
                        >
                          <PackageIcon />
                          {t('pages.agentWorkspaces.actions.repositories')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate(`/settings/agent-workspaces/${workspace.uuid}/credentials`)
                          }
                        >
                          <KeyIcon />
                          {t('pages.agentWorkspaces.actions.credentials')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingWorkspaceUUID === workspace.uuid}
                          onClick={() => setPendingDeleteWorkspace(workspace)}
                        >
                          <Trash2Icon />
                          {t('pages.agentWorkspaces.actions.delete')}
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
        open={isWorkspaceDialogOpen}
        onOpenChange={(open) => {
          setIsWorkspaceDialogOpen(open);

          if (!open) {
            resetWorkspaceForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {workspaceDialogMode === 'create'
                ? t('pages.agentWorkspaces.dialog.createTitle')
                : t('pages.agentWorkspaces.dialog.editTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField>
              <FieldLabel>{t('pages.agentWorkspaces.dialog.nameLabel')}</FieldLabel>
              <FieldContent>
                <Input
                  value={workspaceForm.name}
                  onChange={(event) =>
                    setWorkspaceForm({
                      name: event.target.value
                    })
                  }
                  placeholder={t('pages.agentWorkspaces.dialog.namePlaceholder')}
                />
              </FieldContent>
              <FieldError>{workspaceErrors.name}</FieldError>
            </FormField>
            <FieldError>{workspaceErrors.submit}</FieldError>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsWorkspaceDialogOpen(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleWorkspaceSubmit} disabled={isSubmitting}>
              {t('pages.agentWorkspaces.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteWorkspace !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteWorkspace(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.agentWorkspaces.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.agentWorkspaces.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace}>
              {deletingWorkspaceUUID
                ? t('common.states.deleting')
                : t('common.actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
