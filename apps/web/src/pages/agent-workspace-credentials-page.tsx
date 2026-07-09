import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  AgentWorkspace,
  AgentWorkspaceCredential,
  ApiError,
  ApiSuccess
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
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date-time';
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
  FieldDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { useHeaderActions } from '@/layouts/app-layout';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentWorkspacesResponse = ApiSuccess<AgentWorkspace[]> | ApiError;
type AgentWorkspaceCredentialsResponse =
  | ApiSuccess<AgentWorkspaceCredential[]>
  | ApiError;
type AgentWorkspaceCredentialResponse =
  | ApiSuccess<AgentWorkspaceCredential>
  | ApiError;

type CredentialFormErrors = {
  envName?: string;
  value?: string;
  description?: string;
  submit?: string;
};

const DEFAULT_CREDENTIAL_FORM = {
  envName: '',
  value: '',
  description: ''
};

const CREDENTIAL_ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

export function AgentWorkspaceCredentialsPage() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const { uuid } = useParams<{ uuid: string }>();
  const { setActions, setTitle } = useHeaderActions();
  const [workspace, setWorkspace] = useState<AgentWorkspace | null>(null);
  const [credentials, setCredentials] = useState<AgentWorkspaceCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false);
  const [credentialForm, setCredentialForm] = useState(DEFAULT_CREDENTIAL_FORM);
  const [credentialErrors, setCredentialErrors] = useState<CredentialFormErrors>({});
  const [pendingDeleteCredential, setPendingDeleteCredential] =
    useState<AgentWorkspaceCredential | null>(null);
  const [isCredentialSubmitting, setIsCredentialSubmitting] = useState(false);
  const [deletingCredentialEnvName, setDeletingCredentialEnvName] =
    useState<string | null>(null);

  useEffect(() => {
    setActions(null);

    return () => {
      setActions(null);
      setTitle(null);
    };
  }, [setActions, setTitle]);

  useEffect(() => {
    void loadWorkspaceAndCredentials();
  }, [uuid]);

  async function loadWorkspaceAndCredentials() {
    if (!uuid) {
      setWorkspace(null);
      setCredentials([]);
      setErrorMessage(t('pages.agentWorkspaceCredentials.missingUuid'));
      setIsLoading(false);
      setTitle(t('pages.agentWorkspaceCredentials.pageTitle'));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const workspaceResponse = await fetch('/api/agent-workspaces');
      const workspacePayload =
        (await workspaceResponse.json()) as AgentWorkspacesResponse;

      if (!workspaceResponse.ok || !workspacePayload.success) {
        throw new Error(
          workspacePayload.success
            ? t('pages.agentWorkspaceCredentials.loadFailed')
            : getApiErrorMessage(
                workspacePayload,
                t,
                'pages.agentWorkspaceCredentials.loadFailed'
              )
        );
      }

      const nextWorkspace =
        workspacePayload.data.find((candidateWorkspace) => candidateWorkspace.uuid === uuid) ??
        null;

      if (!nextWorkspace) {
        throw new Error(t('pages.agentWorkspaceCredentials.notFound'));
      }

      const credentialsResponse = await fetch(
        `/api/agent-workspaces/${nextWorkspace.uuid}/credentials`
      );
      const credentialsPayload =
        (await credentialsResponse.json()) as AgentWorkspaceCredentialsResponse;

      if (!credentialsResponse.ok || !credentialsPayload.success) {
        throw new Error(
          credentialsPayload.success
            ? t('pages.agentWorkspaceCredentials.loadFailed')
            : getApiErrorMessage(
                credentialsPayload,
                t,
                'pages.agentWorkspaceCredentials.loadFailed'
              )
        );
      }

      setWorkspace(nextWorkspace);
      setCredentials(credentialsPayload.data);
      setTitle(`${nextWorkspace.name} · ${t('pages.agentWorkspaceCredentials.pageTitle')}`);
    } catch (error) {
      setWorkspace(null);
      setCredentials([]);
      setTitle(t('pages.agentWorkspaceCredentials.pageTitle'));
      setErrorMessage(getErrorMessage(error, t, 'pages.agentWorkspaceCredentials.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  function resetCredentialForm() {
    setCredentialForm(DEFAULT_CREDENTIAL_FORM);
    setCredentialErrors({});
  }

  function openCreateCredentialDialog() {
    if (!workspace) {
      return;
    }

    resetCredentialForm();
    setIsCredentialDialogOpen(true);
  }

  function validateCredentialForm(): CredentialFormErrors {
    const nextErrors: CredentialFormErrors = {};
    const envName = credentialForm.envName.trim();
    const value = credentialForm.value.trim();
    const description = credentialForm.description.trim();

    if (!envName) {
      nextErrors.envName = t('pages.agentWorkspaceCredentials.validation.envNameRequired');
    } else if (!CREDENTIAL_ENV_NAME_PATTERN.test(envName)) {
      nextErrors.envName = t('pages.agentWorkspaceCredentials.validation.envNameInvalid');
    }

    if (!value) {
      nextErrors.value = t('pages.agentWorkspaceCredentials.validation.valueRequired');
    }

    if (description.length > 256) {
      nextErrors.description = t(
        'pages.agentWorkspaceCredentials.validation.descriptionTooLong'
      );
    }

    return nextErrors;
  }

  async function handleCredentialSubmit() {
    if (!workspace) {
      return;
    }

    const nextErrors = validateCredentialForm();

    if (Object.keys(nextErrors).length > 0) {
      setCredentialErrors(nextErrors);
      return;
    }

    try {
      setIsCredentialSubmitting(true);
      setCredentialErrors({});

      const response = await fetch(
        `/api/agent-workspaces/${workspace.uuid}/credentials`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            envName: credentialForm.envName.trim(),
            value: credentialForm.value.trim(),
            description: credentialForm.description.trim()
          })
        }
      );
      const payload =
        (await response.json()) as AgentWorkspaceCredentialResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaceCredentials.saveFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.agentWorkspaceCredentials.saveFailed'
              )
        );
      }

      setCredentials((currentCredentials) =>
        upsertCredential(currentCredentials, payload.data)
      );
      setIsCredentialDialogOpen(false);
      resetCredentialForm();
      toast.success(t('pages.agentWorkspaceCredentials.saveSuccess'));
    } catch (error) {
      const message = getErrorMessage(error, t, 'pages.agentWorkspaceCredentials.saveFailed');
      setCredentialErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsCredentialSubmitting(false);
    }
  }

  async function handleDeleteCredential() {
    if (!workspace || !pendingDeleteCredential) {
      return;
    }

    try {
      setDeletingCredentialEnvName(pendingDeleteCredential.envName);

      const response = await fetch(
        `/api/agent-workspaces/${workspace.uuid}/credentials/${encodeURIComponent(pendingDeleteCredential.envName)}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(
          payload
            ? getApiErrorMessage(payload, t, 'pages.agentWorkspaceCredentials.deleteFailed')
            : t('pages.agentWorkspaceCredentials.deleteFailed')
        );
      }

      setCredentials((currentCredentials) =>
        currentCredentials.filter(
          (credential) => credential.envName !== pendingDeleteCredential.envName
        )
      );
      setPendingDeleteCredential(null);
      toast.success(t('pages.agentWorkspaceCredentials.deleteSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agentWorkspaceCredentials.deleteFailed'));
    } finally {
      setDeletingCredentialEnvName(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex items-center justify-start">
          <Button onClick={openCreateCredentialDialog} disabled={!workspace}>
            <PlusIcon />
            {t('pages.agentWorkspaceCredentials.actions.create')}
          </Button>
        </div>
        {isLoading ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            {t('common.states.loading')}
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center text-sm text-destructive">
            {errorMessage}
          </div>
        ) : !workspace ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            {t('pages.agentWorkspaceCredentials.notFound')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">
                    {t('pages.agentWorkspaceCredentials.table.envName')}
                  </TableHead>
                  <TableHead>{t('pages.agentWorkspaceCredentials.table.description')}</TableHead>
                  <TableHead>{t('pages.agentWorkspaceCredentials.table.updatedAt')}</TableHead>
                  <TableHead className="w-[120px] pr-4 text-right">
                    {t('pages.agentWorkspaceCredentials.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 px-4 text-center text-muted-foreground"
                    >
                      {t('pages.agentWorkspaceCredentials.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  credentials.map((credential) => (
                    <TableRow key={credential.envName}>
                      <TableCell className="px-4 font-medium">
                        {credential.envName}
                      </TableCell>
                      <TableCell>
                        {credential.description ? (
                          <span className="break-all">{credential.description}</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {t('common.fallback.emptyValue')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(credential.updatedAt, locale)}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingCredentialEnvName === credential.envName}
                            onClick={() => setPendingDeleteCredential(credential)}
                          >
                            <Trash2Icon />
                            {t('pages.agentWorkspaceCredentials.actions.delete')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={isCredentialDialogOpen}
        onOpenChange={(open) => {
          setIsCredentialDialogOpen(open);

          if (!open) {
            resetCredentialForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.agentWorkspaceCredentials.dialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField>
              <FieldLabel>{t('pages.agentWorkspaceCredentials.dialog.envNameLabel')}</FieldLabel>
              <FieldContent>
                <Input
                  value={credentialForm.envName}
                  onChange={(event) =>
                    setCredentialForm((currentForm) => ({
                      ...currentForm,
                      envName: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder={t('pages.agentWorkspaceCredentials.dialog.envNamePlaceholder')}
                />
                <FieldDescription>
                  {t('pages.agentWorkspaceCredentials.dialog.envNameDescription')}
                </FieldDescription>
              </FieldContent>
              <FieldError>{credentialErrors.envName}</FieldError>
            </FormField>
            <FormField>
              <FieldLabel>{t('pages.agentWorkspaceCredentials.dialog.valueLabel')}</FieldLabel>
              <FieldContent>
                <Textarea
                  rows={4}
                  value={credentialForm.value}
                  onChange={(event) =>
                    setCredentialForm((currentForm) => ({
                      ...currentForm,
                      value: event.target.value
                    }))
                  }
                  placeholder={t('pages.agentWorkspaceCredentials.dialog.valuePlaceholder')}
                />
              </FieldContent>
              <FieldError>{credentialErrors.value}</FieldError>
            </FormField>
            <FormField>
              <FieldLabel>
                {t('pages.agentWorkspaceCredentials.dialog.descriptionLabel')}
              </FieldLabel>
              <FieldContent>
                <Input
                  value={credentialForm.description}
                  onChange={(event) =>
                    setCredentialForm((currentForm) => ({
                      ...currentForm,
                      description: event.target.value
                    }))
                  }
                  placeholder={t('pages.agentWorkspaceCredentials.dialog.descriptionPlaceholder')}
                />
              </FieldContent>
              <FieldError>{credentialErrors.description}</FieldError>
            </FormField>
            <FieldError>{credentialErrors.submit}</FieldError>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCredentialDialogOpen(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleCredentialSubmit} disabled={isCredentialSubmitting}>
              {t('pages.agentWorkspaceCredentials.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteCredential !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteCredential(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('pages.agentWorkspaceCredentials.deleteDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.agentWorkspaceCredentials.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCredential}>
              {deletingCredentialEnvName
                ? t('common.states.deleting')
                : t('pages.agentWorkspaceCredentials.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function upsertCredential(
  credentials: AgentWorkspaceCredential[],
  nextCredential: AgentWorkspaceCredential
): AgentWorkspaceCredential[] {
  const nextCredentials = credentials.filter(
    (credential) => credential.envName !== nextCredential.envName
  );
  nextCredentials.push(nextCredential);
  nextCredentials.sort((left, right) => left.envName.localeCompare(right.envName));
  return nextCredentials;
}
