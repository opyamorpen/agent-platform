import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  AgentWorkspace,
  AgentWorkspaceAuthSummary,
  AgentWorkspaceRepository,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentWorkspacesResponse = ApiSuccess<AgentWorkspace[]> | ApiError;
type AgentWorkspaceResponse = ApiSuccess<AgentWorkspace> | ApiError;
type RepositoryDialogMode = 'create' | 'edit';
type WorkspaceAuthType = AgentWorkspace['auth']['type'];
type WorkspaceAuthPayload =
  | {
      type: 'none';
    }
  | {
      type: 'ssh';
    }
  | {
      type: 'https';
      username: string;
      secret?: string;
    };

type RepositoryFormErrors = {
  url?: string;
  submit?: string;
};

type AuthFormErrors = {
  username?: string;
  secret?: string;
  submit?: string;
};

const DEFAULT_REPOSITORY_FORM = {
  url: ''
};

const DEFAULT_AUTH_FORM = {
  type: 'none' as WorkspaceAuthType,
  username: '',
  secret: ''
};

const SSH_REPOSITORY_URL_PATTERN =
  /^(?:[^\s@/:]+@[^/\s:]+:[^\s]+|ssh:\/\/[^\s]+)$/i;
const HTTPS_REPOSITORY_URL_PATTERN = /^https:\/\/[^\s]+$/i;
const REPOSITORY_URL_PATTERN = new RegExp(
  `^(?:${SSH_REPOSITORY_URL_PATTERN.source.slice(1, -1)}|${HTTPS_REPOSITORY_URL_PATTERN.source.slice(1, -1)})$`,
  'i'
);

export function AgentWorkspaceRepositoriesPage() {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const { setActions, setTitle } = useHeaderActions();
  const [workspace, setWorkspace] = useState<AgentWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRepositoryDialogOpen, setIsRepositoryDialogOpen] = useState(false);
  const [repositoryDialogMode, setRepositoryDialogMode] =
    useState<RepositoryDialogMode>('create');
  const [editingRepository, setEditingRepository] =
    useState<AgentWorkspaceRepository | null>(null);
  const [repositoryForm, setRepositoryForm] = useState(DEFAULT_REPOSITORY_FORM);
  const [repositoryErrors, setRepositoryErrors] = useState<RepositoryFormErrors>({});
  const [pendingDeleteRepository, setPendingDeleteRepository] =
    useState<AgentWorkspaceRepository | null>(null);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authForm, setAuthForm] = useState(DEFAULT_AUTH_FORM);
  const [authErrors, setAuthErrors] = useState<AuthFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [deletingRepositoryUUID, setDeletingRepositoryUUID] = useState<string | null>(null);
  const [generatingSshKey, setGeneratingSshKey] = useState(false);
  const [copiedWorkspaceUUID, setCopiedWorkspaceUUID] = useState<string | null>(null);
  const [isGenerateSshKeyConfirmOpen, setIsGenerateSshKeyConfirmOpen] = useState(false);

  useEffect(() => {
    setActions(null);

    return () => {
      setActions(null);
      setTitle(null);
    };
  }, [setActions, setTitle]);

  useEffect(() => {
    void loadWorkspace();
  }, [uuid]);

  async function loadWorkspace() {
    if (!uuid) {
      setWorkspace(null);
      setErrorMessage(t('pages.agentWorkspaceRepositories.missingUuid'));
      setIsLoading(false);
      setTitle(t('pages.agentWorkspaceRepositories.pageTitle'));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/agent-workspaces');
      const payload = (await response.json()) as AgentWorkspacesResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaceRepositories.workspaceListLoadFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.agentWorkspaceRepositories.workspaceListLoadFailed'
              )
        );
      }

      const nextWorkspace =
        payload.data.find((candidateWorkspace) => candidateWorkspace.uuid === uuid) ?? null;

      if (!nextWorkspace) {
        throw new Error(t('pages.agentWorkspaceRepositories.notFound'));
      }

      setWorkspace(nextWorkspace);
      setTitle(
        `${nextWorkspace.name} · ${t('pages.agentWorkspaceRepositories.pageTitle')}`
      );
    } catch (error) {
      setWorkspace(null);
      setTitle(t('pages.agentWorkspaceRepositories.pageTitle'));
      setErrorMessage(getErrorMessage(error, t, 'pages.agentWorkspaceRepositories.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  function resetRepositoryForm() {
    setRepositoryForm(DEFAULT_REPOSITORY_FORM);
    setRepositoryErrors({});
    setEditingRepository(null);
  }

  function resetAuthForm(nextWorkspace: AgentWorkspace | null = workspace) {
    setAuthForm(toAuthForm(nextWorkspace?.auth ?? { type: 'none' }));
    setAuthErrors({});
  }

  function openCreateRepositoryDialog() {
    if (!workspace) {
      return;
    }

    setRepositoryDialogMode('create');
    setEditingRepository(null);
    setRepositoryForm(DEFAULT_REPOSITORY_FORM);
    setRepositoryErrors({});
    setIsRepositoryDialogOpen(true);
  }

  function openEditRepositoryDialog(repository: AgentWorkspaceRepository) {
    setRepositoryDialogMode('edit');
    setEditingRepository(repository);
    setRepositoryForm({
      url: repository.url
    });
    setRepositoryErrors({});
    setIsRepositoryDialogOpen(true);
  }

  function openAuthDialog() {
    resetAuthForm();
    setIsAuthDialogOpen(true);
  }

  function validateRepositoryForm(): RepositoryFormErrors {
    const nextErrors: RepositoryFormErrors = {};
    const isEditing = repositoryDialogMode === 'edit';
    const value = repositoryForm.url.trim();
    const urls = parseRepositoryUrls(repositoryForm.url);

    if (!value) {
      nextErrors.url = t(
        isEditing
          ? 'pages.agentWorkspaceRepositories.validation.repositoryUrlRequired'
          : 'pages.agentWorkspaceRepositories.validation.repositoryUrlListRequired'
      );
      return nextErrors;
    }

    if (urls.some((url) => !REPOSITORY_URL_PATTERN.test(url))) {
      nextErrors.url = t('pages.agentWorkspaceRepositories.validation.repositoryUrlInvalid');
      return nextErrors;
    }

    if (workspace) {
      const invalidUrl = urls.find(
        (url) => !isRepositoryUrlCompatibleWithAuth(url, workspace.auth.type)
      );

      if (invalidUrl) {
        nextErrors.url = getRepositoryAuthErrorMessage(workspace.auth.type, t);
      }
    }

    return nextErrors;
  }

  function validateAuthForm(): AuthFormErrors {
    const nextErrors: AuthFormErrors = {};

    if (authForm.type === 'https' && !authForm.username.trim()) {
      nextErrors.username = t(
        'pages.agentWorkspaceRepositories.validation.httpsUsernameRequired'
      );
    }

    return nextErrors;
  }

  function parseRepositoryUrls(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function toRepositoryBrowseUrl(value: string): string | null {
    const trimmedValue = value.trim();
    const scpLikeMatch = trimmedValue.match(
      /^(?<user>[^\s@/:]+)@(?<host>[^/\s:]+):(?<path>[^\s]+)$/
    );

    if (scpLikeMatch?.groups) {
      const normalizedPath = scpLikeMatch.groups.path.replace(/\.git$/i, '');
      return `https://${scpLikeMatch.groups.host}/${normalizedPath}`;
    }

    try {
      const url = new URL(trimmedValue);

      if (!url.hostname || !url.pathname) {
        return null;
      }

      if (url.protocol === 'ssh:') {
        return `https://${url.hostname}/${url.pathname.replace(/^\/+/, '').replace(/\.git$/i, '')}`;
      }

      if (url.protocol === 'https:') {
        return `${url.origin}${url.pathname.replace(/\.git$/i, '')}`;
      }
    } catch {
      return null;
    }

    return null;
  }

  async function handleRepositorySubmit() {
    if (!workspace) {
      return;
    }

    const nextErrors = validateRepositoryForm();

    if (Object.keys(nextErrors).length > 0) {
      setRepositoryErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setRepositoryErrors({});

      const isEditing = repositoryDialogMode === 'edit' && editingRepository;
      const repositoryUrls = parseRepositoryUrls(repositoryForm.url);
      const response = await fetch(
        isEditing
          ? `/api/agent-workspaces/repositories/${editingRepository.uuid}`
          : `/api/agent-workspaces/${workspace.uuid}/repositories`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(
            isEditing
              ? {
                  url: repositoryForm.url.trim()
                }
              : {
                  urls: repositoryUrls
                }
          )
        }
      );
      const payload = (await response.json()) as AgentWorkspaceResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaceRepositories.saveRepositoryFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.agentWorkspaceRepositories.saveRepositoryFailed'
              )
        );
      }

      setWorkspace(payload.data);
      setIsRepositoryDialogOpen(false);
      resetRepositoryForm();
      toast.success(
        isEditing
          ? t('pages.agentWorkspaceRepositories.updateRepositorySuccess')
          : repositoryUrls.length > 1
            ? t('pages.agentWorkspaceRepositories.createRepositoriesSuccess', {
                count: repositoryUrls.length
              })
            : t('pages.agentWorkspaceRepositories.createRepositorySuccess')
      );
    } catch (error) {
      const message = getErrorMessage(
        error,
        t,
        'pages.agentWorkspaceRepositories.saveRepositoryFailed'
      );
      setRepositoryErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteRepository() {
    if (!pendingDeleteRepository) {
      return;
    }

    try {
      setDeletingRepositoryUUID(pendingDeleteRepository.uuid);

      const response = await fetch(
        `/api/agent-workspaces/repositories/${pendingDeleteRepository.uuid}`,
        {
          method: 'DELETE'
        }
      );
      const payload = (await response.json()) as AgentWorkspaceResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaceRepositories.deleteRepositoryFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.agentWorkspaceRepositories.deleteRepositoryFailed'
              )
        );
      }

      setWorkspace(payload.data);
      toast.success(t('pages.agentWorkspaceRepositories.deleteRepositorySuccess'));
      setPendingDeleteRepository(null);
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.agentWorkspaceRepositories.deleteRepositoryFailed')
      );
    } finally {
      setDeletingRepositoryUUID(null);
    }
  }

  async function handleAuthSubmit() {
    if (!workspace) {
      return;
    }

    const nextErrors = validateAuthForm();

    if (Object.keys(nextErrors).length > 0) {
      setAuthErrors(nextErrors);
      return;
    }

    try {
      setIsAuthSubmitting(true);
      setAuthErrors({});

      const payload = buildAuthPayload(authForm);
      const response = await fetch(`/api/agent-workspaces/${workspace.uuid}/auth`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const responsePayload = (await response.json()) as AgentWorkspaceResponse;

      if (!response.ok || !responsePayload.success) {
        throw new Error(
          responsePayload.success
            ? t('pages.agentWorkspaceRepositories.saveAuthFailed')
            : getApiErrorMessage(
                responsePayload,
                t,
                'pages.agentWorkspaceRepositories.saveAuthFailed'
              )
        );
      }

      setWorkspace(responsePayload.data);
      setIsAuthDialogOpen(false);
      resetAuthForm(responsePayload.data);
      toast.success(t('pages.agentWorkspaceRepositories.saveAuthSuccess'));
    } catch (error) {
      const message = getErrorMessage(
        error,
        t,
        'pages.agentWorkspaceRepositories.saveAuthFailed'
      );
      setAuthErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleCopyPublicKey() {
    if (!workspace || workspace.auth.type !== 'ssh' || !workspace.auth.publicKey) {
      toast.error(t('pages.agentWorkspaceRepositories.copyPublicKeyUnavailable'));
      return;
    }

    try {
      await navigator.clipboard.writeText(workspace.auth.publicKey);
      setCopiedWorkspaceUUID(workspace.uuid);
      toast.success(t('pages.agentWorkspaceRepositories.copyPublicKeySuccess'));

      window.setTimeout(() => {
        setCopiedWorkspaceUUID((currentWorkspaceUUID) =>
          currentWorkspaceUUID === workspace.uuid ? null : currentWorkspaceUUID
        );
      }, 2000);
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.agentWorkspaceRepositories.copyPublicKeyFailed')
      );
    }
  }

  async function handleGenerateSshKey() {
    if (!workspace) {
      return;
    }

    try {
      setGeneratingSshKey(true);
      const response = await fetch(
        `/api/agent-workspaces/${workspace.uuid}/auth/ssh/generate`,
        {
          method: 'POST'
        }
      );
      const payload = (await response.json()) as AgentWorkspaceResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentWorkspaceRepositories.generateSshKeyFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.agentWorkspaceRepositories.generateSshKeyFailed'
              )
        );
      }

      setWorkspace(payload.data);
      resetAuthForm(payload.data);
      setIsGenerateSshKeyConfirmOpen(false);
      toast.success(
        payload.data.auth.type === 'ssh' && payload.data.auth.publicKey
          ? t('pages.agentWorkspaceRepositories.regenerateSshKeySuccess')
          : t('pages.agentWorkspaceRepositories.generateSshKeySuccess')
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.agentWorkspaceRepositories.generateSshKeyFailed')
      );
    } finally {
      setGeneratingSshKey(false);
    }
  }

  const repositoryPlaceholder =
    workspace?.auth.type === 'ssh'
      ? 'git@github.com:example/repo.git'
      : 'https://github.com/example/repo.git';
  const sshPublicKey =
    workspace?.auth.type === 'ssh' ? workspace.auth.publicKey ?? '' : '';

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex flex-wrap items-center justify-start gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={openCreateRepositoryDialog} disabled={!workspace}>
              <PlusIcon />
              {t('pages.agentWorkspaceRepositories.actions.createRepository')}
            </Button>
            <Button
              variant="outline"
              onClick={openAuthDialog}
              disabled={!workspace}
            >
              <ShieldIcon />
              {t('pages.agentWorkspaceRepositories.actions.authSettings')}
            </Button>
          </div>
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
            {t('pages.agentWorkspaceRepositories.notFound')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">
                    {t('pages.agentWorkspaceRepositories.table.url')}
                  </TableHead>
                  <TableHead>{t('pages.agentWorkspaceRepositories.table.browseUrl')}</TableHead>
                  <TableHead className="w-[160px] pr-4 text-right">
                    {t('pages.agentWorkspaceRepositories.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.repositories.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 px-4 text-center text-muted-foreground"
                    >
                      {t('pages.agentWorkspaceRepositories.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  workspace.repositories.map((repository) => {
                    const browseUrl = toRepositoryBrowseUrl(repository.url);

                    return (
                      <TableRow key={repository.uuid}>
                        <TableCell className="px-4 font-medium">
                          <span className="break-all">{repository.url}</span>
                        </TableCell>
                        <TableCell>
                          {browseUrl ? (
                            <a
                              href={browseUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-primary hover:underline"
                            >
                              {browseUrl}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">
                              {t('pages.agentWorkspaceRepositories.table.browseUrlUnavailable')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditRepositoryDialog(repository)}
                            >
                              <PencilIcon />
                              {t('pages.agentWorkspaceRepositories.actions.edit')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deletingRepositoryUUID === repository.uuid}
                              onClick={() => setPendingDeleteRepository(repository)}
                            >
                              <Trash2Icon />
                              {t('pages.agentWorkspaceRepositories.actions.delete')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={isRepositoryDialogOpen}
        onOpenChange={(open) => {
          setIsRepositoryDialogOpen(open);

          if (!open) {
            resetRepositoryForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {repositoryDialogMode === 'create'
                ? t('pages.agentWorkspaceRepositories.repositoryDialog.createTitle')
                : t('pages.agentWorkspaceRepositories.repositoryDialog.editTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <FormField>
              <FieldLabel>
                {repositoryDialogMode === 'create'
                  ? t('pages.agentWorkspaceRepositories.repositoryDialog.urlListLabel')
                  : t('pages.agentWorkspaceRepositories.repositoryDialog.urlLabel')}
              </FieldLabel>
              <FieldContent>
                {repositoryDialogMode === 'create' ? (
                  <Textarea
                    rows={6}
                    value={repositoryForm.url}
                    onChange={(event) =>
                      setRepositoryForm({
                        url: event.target.value
                      })
                    }
                    placeholder={`${repositoryPlaceholder}\n${repositoryPlaceholder.replace('repo.git', 'repo-b.git')}`}
                    className="max-h-[45vh] min-h-40 overflow-y-auto resize-y"
                  />
                ) : (
                  <Input
                    value={repositoryForm.url}
                    onChange={(event) =>
                      setRepositoryForm({
                        url: event.target.value
                      })
                    }
                    placeholder={repositoryPlaceholder}
                  />
                )}
                <FieldDescription>
                  {getRepositoryInputDescription(workspace?.auth.type ?? 'none', t)}
                </FieldDescription>
              </FieldContent>
              <FieldError>{repositoryErrors.url}</FieldError>
            </FormField>
            <FieldError>{repositoryErrors.submit}</FieldError>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRepositoryDialogOpen(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleRepositorySubmit()} disabled={isSubmitting}>
              {t('pages.agentWorkspaceRepositories.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAuthDialogOpen}
        onOpenChange={(open) => {
          setIsAuthDialogOpen(open);

          if (!open) {
            resetAuthForm();
            setIsGenerateSshKeyConfirmOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('pages.agentWorkspaceRepositories.authDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField>
              <FieldLabel>{t('pages.agentWorkspaceRepositories.authDialog.typeLabel')}</FieldLabel>
              <FieldContent>
                <Select
                  value={authForm.type}
                  onValueChange={(value) =>
                    setAuthForm((current) => ({
                      ...current,
                      type: value as WorkspaceAuthType
                    }))
                  }
                >
                  <SelectTrigger
                    aria-label={t('pages.agentWorkspaceRepositories.authDialog.typePlaceholder')}
                  >
                    <SelectValue
                      placeholder={t('pages.agentWorkspaceRepositories.authDialog.typePlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('pages.agentWorkspaceRepositories.authDialog.typeNone')}
                    </SelectItem>
                    <SelectItem value="ssh">
                      {t('pages.agentWorkspaceRepositories.authDialog.typeSsh')}
                    </SelectItem>
                    <SelectItem value="https">
                      {t('pages.agentWorkspaceRepositories.authDialog.typeHttps')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {getAuthTypeDescription(authForm.type, t)}
                </FieldDescription>
              </FieldContent>
            </FormField>

            {authForm.type === 'ssh' ? (
              <FormField>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <FieldLabel>
                    {t('pages.agentWorkspaceRepositories.authDialog.sshPublicKeyLabel')}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPublicKey}
                      disabled={!sshPublicKey}
                    >
                      {copiedWorkspaceUUID === workspace?.uuid ? (
                        <CheckIcon />
                      ) : (
                        <CopyIcon />
                      )}
                      {copiedWorkspaceUUID === workspace?.uuid
                        ? t('pages.agentWorkspaceRepositories.actions.copied')
                        : t('pages.agentWorkspaceRepositories.actions.copyPublicKey')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsGenerateSshKeyConfirmOpen(true)}
                    >
                      <RefreshCwIcon />
                      {sshPublicKey
                        ? t('pages.agentWorkspaceRepositories.actions.regenerateKey')
                        : t('pages.agentWorkspaceRepositories.actions.generateKey')}
                    </Button>
                  </div>
                </div>
                <FieldContent>
                  <Textarea
                    rows={4}
                    readOnly
                    value={sshPublicKey}
                    placeholder={t(
                      'pages.agentWorkspaceRepositories.authDialog.sshPublicKeyPlaceholder'
                    )}
                    className="font-mono text-xs"
                  />
                  <FieldDescription>
                    {t('pages.agentWorkspaceRepositories.authDialog.sshPublicKeyDescription')}
                  </FieldDescription>
                </FieldContent>
              </FormField>
            ) : null}

            {authForm.type === 'https' ? (
              <>
                <FormField>
                  <FieldLabel>
                    {t('pages.agentWorkspaceRepositories.authDialog.usernameLabel')}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      value={authForm.username}
                      onChange={(event) =>
                        setAuthForm((current) => ({
                          ...current,
                          username: event.target.value
                        }))
                      }
                      placeholder={t(
                        'pages.agentWorkspaceRepositories.authDialog.usernamePlaceholder'
                      )}
                    />
                    <FieldDescription>
                      {t('pages.agentWorkspaceRepositories.authDialog.usernameDescription')}
                    </FieldDescription>
                  </FieldContent>
                  <FieldError>{authErrors.username}</FieldError>
                </FormField>
                <FormField>
                  <FieldLabel>{t('pages.agentWorkspaceRepositories.authDialog.secretLabel')}</FieldLabel>
                  <FieldContent>
                    <Input
                      type="password"
                      value={authForm.secret}
                      onChange={(event) =>
                        setAuthForm((current) => ({
                          ...current,
                          secret: event.target.value
                        }))
                      }
                      placeholder={t(
                        'pages.agentWorkspaceRepositories.authDialog.secretPlaceholder'
                      )}
                    />
                    <FieldDescription>
                      {workspace?.auth.type === 'https' && workspace.auth.hasSecret
                        ? t('pages.agentWorkspaceRepositories.authDialog.secretDescriptionKeep')
                        : t(
                            'pages.agentWorkspaceRepositories.authDialog.secretDescriptionRequired'
                          )}
                    </FieldDescription>
                  </FieldContent>
                  <FieldError>{authErrors.secret}</FieldError>
                </FormField>
              </>
            ) : null}

            <FieldError>{authErrors.submit}</FieldError>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAuthDialogOpen(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleAuthSubmit()} disabled={isAuthSubmitting}>
              {t('pages.agentWorkspaceRepositories.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isGenerateSshKeyConfirmOpen}
        onOpenChange={setIsGenerateSshKeyConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {sshPublicKey
                ? t('pages.agentWorkspaceRepositories.generateSshKeyDialog.titleRegenerate')
                : t('pages.agentWorkspaceRepositories.generateSshKeyDialog.titleGenerate')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sshPublicKey
                ? t(
                    'pages.agentWorkspaceRepositories.generateSshKeyDialog.descriptionRegenerate'
                  )
                : t(
                    'pages.agentWorkspaceRepositories.generateSshKeyDialog.descriptionGenerate'
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={generatingSshKey}
              onClick={() => void handleGenerateSshKey()}
            >
              {sshPublicKey
                ? t('pages.agentWorkspaceRepositories.generateSshKeyDialog.confirmRegenerate')
                : t('pages.agentWorkspaceRepositories.generateSshKeyDialog.confirmGenerate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteRepository !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteRepository(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.agentWorkspaceRepositories.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.agentWorkspaceRepositories.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteRepository()}>
              {deletingRepositoryUUID
                ? t('common.states.deleting')
                : t('pages.agentWorkspaceRepositories.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function toAuthForm(auth: AgentWorkspaceAuthSummary) {
  if (auth.type === 'ssh') {
    return {
      type: 'ssh' as const,
      username: '',
      secret: ''
    };
  }

  if (auth.type === 'https') {
    return {
      type: 'https' as const,
      username: auth.username ?? '',
      secret: ''
    };
  }

  return DEFAULT_AUTH_FORM;
}

function buildAuthPayload(form: typeof DEFAULT_AUTH_FORM): WorkspaceAuthPayload {
  if (form.type === 'ssh') {
    return {
      type: 'ssh'
    };
  }

  if (form.type === 'https') {
    const secret = form.secret.trim();
    return {
      type: 'https',
      username: form.username.trim(),
      ...(secret ? { secret } : {})
    };
  }

  return {
    type: 'none'
  };
}

function getAuthTypeDescription(
  type: WorkspaceAuthType,
  t: (key: string) => string
): string {
  if (type === 'ssh') {
    return t('pages.agentWorkspaceRepositories.authDescription.ssh');
  }

  if (type === 'https') {
    return t('pages.agentWorkspaceRepositories.authDescription.https');
  }

  return t('pages.agentWorkspaceRepositories.authDescription.none');
}

function getRepositoryInputDescription(
  authType: WorkspaceAuthType,
  t: (key: string) => string
): string {
  if (authType === 'ssh') {
    return t('pages.agentWorkspaceRepositories.repositoryInputDescription.ssh');
  }

  if (authType === 'https') {
    return t('pages.agentWorkspaceRepositories.repositoryInputDescription.https');
  }

  return t('pages.agentWorkspaceRepositories.repositoryInputDescription.none');
}

function getRepositoryAuthErrorMessage(
  authType: WorkspaceAuthType,
  t: (key: string) => string
): string {
  if (authType === 'ssh') {
    return t('pages.agentWorkspaceRepositories.validation.sshUrlOnly');
  }

  if (authType === 'https') {
    return t('pages.agentWorkspaceRepositories.validation.httpsUrlOnly');
  }

  return t('pages.agentWorkspaceRepositories.validation.publicHttpsUrlOnly');
}

function isRepositoryUrlCompatibleWithAuth(
  url: string,
  authType: WorkspaceAuthType
): boolean {
  if (authType === 'ssh') {
    return SSH_REPOSITORY_URL_PATTERN.test(url.trim());
  }

  return HTTPS_REPOSITORY_URL_PATTERN.test(url.trim());
}
