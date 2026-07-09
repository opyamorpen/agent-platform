import { useEffect, useMemo, useState } from 'react';
import type { AgentClient, ApiError, ApiSuccess } from '@ones-ai-workflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/date-time';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
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
  FieldDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useHeaderActions } from '@/layouts/app-layout';
import { BanIcon, CheckIcon, CopyIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentClientsResponse = ApiSuccess<AgentClient[]> | ApiError;
type AgentClientMutationResponse = ApiSuccess<AgentClient> | ApiError;
type AgentClientCommandTarget = 'local' | 'docker' | 'env';

const DEFAULT_AGENT_CLIENT_FORM = {
  serverBaseUrl: '',
  clientUUID: 'agent-client-01',
  clientName: 'Agent Client 01',
  concurrency: '1',
  workingRoot: '/data'
};

function getDefaultServerBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3001';
  }

  return window.location.origin;
}

function escapeShellValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toShellEnvLine(name: string, value: string) {
  return `${name}="${escapeShellValue(value)}" \\`;
}

function toDotenvLine(name: string, value: string) {
  return `${name}="${escapeShellValue(value)}"`;
}

function escapeYamlDoubleQuotedValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toYamlDoubleQuotedValue(value: string) {
  return `"${escapeYamlDoubleQuotedValue(value)}"`;
}

function createAgentClientCommands(form: typeof DEFAULT_AGENT_CLIENT_FORM) {
  const serverBaseUrl = form.serverBaseUrl.trim() || getDefaultServerBaseUrl();
  const clientUUID = form.clientUUID.trim() || DEFAULT_AGENT_CLIENT_FORM.clientUUID;
  const clientName = form.clientName.trim() || DEFAULT_AGENT_CLIENT_FORM.clientName;
  const concurrency = form.concurrency.trim() || DEFAULT_AGENT_CLIENT_FORM.concurrency;
  const workingRoot = form.workingRoot.trim() || DEFAULT_AGENT_CLIENT_FORM.workingRoot;

  const envEntries = [
    ['AGENT_CLIENT_SERVER_BASE_URL', serverBaseUrl],
    ['AGENT_CLIENT_UUID', clientUUID],
    ['AGENT_CLIENT_NAME', clientName],
    ['AGENT_CLIENT_DEFAULT_AGENT', 'codex'],
    ['AGENT_CLIENT_CONCURRENCY', concurrency],
    ['AGENT_CLIENT_WORKING_ROOT', workingRoot],
    ['AGENT_CLIENT_CODEX_HOMES', '/codex'],
    ['CODEX_HOME', '/codex'],
    ['CLAUDE_CONFIG_DIR', '/claude']
  ] as const;

  return {
    local: `${envEntries.map(([name, value]) => toShellEnvLine(name, value)).join('\n')}\npnpm dev:agent-client`,
    docker: `services:
  agent-client:
    image: ones-ai-workflow/agent-client:local
    restart: unless-stopped
    init: true
    environment:
      AGENT_CLIENT_SERVER_BASE_URL: ${toYamlDoubleQuotedValue(serverBaseUrl)}
      AGENT_CLIENT_UUID: ${toYamlDoubleQuotedValue(clientUUID)}
      AGENT_CLIENT_NAME: ${toYamlDoubleQuotedValue(clientName)}
      AGENT_CLIENT_DEFAULT_AGENT: codex
      AGENT_CLIENT_CONCURRENCY: ${toYamlDoubleQuotedValue(concurrency)}
      AGENT_CLIENT_WORKING_ROOT: ${toYamlDoubleQuotedValue(workingRoot)}
      AGENT_CLIENT_CODEX_HOMES: /codex
      CODEX_HOME: /codex
      CLAUDE_CONFIG_DIR: /claude
    volumes:
      - ./runtime/${clientUUID}/data:${workingRoot}
      - ./runtime/${clientUUID}/codex:/codex
      - ./runtime/${clientUUID}/claude:/claude`,
    env: envEntries.map(([name, value]) => toDotenvLine(name, value)).join('\n')
  };
}

function getConnectionStatusMeta(
  status: AgentClient['connectionStatus'],
  t: (key: string) => string
) {
  switch (status) {
    case 'pending_approval':
      return {
        label: t('pages.agentClients.connectionStatus.pending_approval'),
        variant: 'secondary' as const
      };
    case 'approved':
      return {
        label: t('pages.agentClients.connectionStatus.approved'),
        variant: 'default' as const
      };
    case 'active':
      return {
        label: t('pages.agentClients.connectionStatus.active'),
        variant: 'default' as const
      };
    case 'revoked':
      return {
        label: t('pages.agentClients.connectionStatus.revoked'),
        variant: 'outline' as const
      };
  }
}

function getRuntimeStatusMeta(
  status: AgentClient['runtimeStatus'],
  t: (key: string) => string
) {
  return status === 'online'
    ? {
        label: t('pages.agentClients.runtimeStatus.online'),
        variant: 'default' as const
      }
    : {
        label: t('pages.agentClients.runtimeStatus.offline'),
        variant: 'secondary' as const
      };
}

export function AgentClientsPage() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const { setActions, setTitle } = useHeaderActions();
  const [agentClients, setAgentClients] = useState<AgentClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingActionUUID, setPendingActionUUID] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [agentClientForm, setAgentClientForm] = useState(() => ({
    ...DEFAULT_AGENT_CLIENT_FORM,
    serverBaseUrl: getDefaultServerBaseUrl()
  }));
  const [copiedCommandTarget, setCopiedCommandTarget] =
    useState<AgentClientCommandTarget | null>(null);
  const agentClientCommands = useMemo(
    () => createAgentClientCommands(agentClientForm),
    [agentClientForm]
  );

  useEffect(() => {
    setActions(
      <Button type="button" onClick={() => setIsAddDialogOpen(true)}>
        <PlusIcon />
        {t('pages.agentClients.actions.add')}
      </Button>
    );

    return () => {
      setActions(null);
      setTitle(null);
    };
  }, [setActions, setTitle, t]);

  async function loadAgentClients() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/agent-clients');
      const payload = (await response.json()) as AgentClientsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentClients.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.agentClients.loadFailed')
        );
      }

      setAgentClients(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.agentClients.loadFailed'));
      setAgentClients([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAgentClients();
  }, []);

  function updateAgentClientForm(
    field: keyof typeof DEFAULT_AGENT_CLIENT_FORM,
    value: string
  ) {
    setAgentClientForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function resetAgentClientForm() {
    setAgentClientForm({
      ...DEFAULT_AGENT_CLIENT_FORM,
      serverBaseUrl: getDefaultServerBaseUrl()
    });
  }

  async function handleCopyCommand(target: AgentClientCommandTarget) {
    try {
      await navigator.clipboard.writeText(agentClientCommands[target]);
      setCopiedCommandTarget(target);
      toast.success(t('pages.agentClients.addDialog.copySuccess'));

      window.setTimeout(() => {
        setCopiedCommandTarget((currentTarget) =>
          currentTarget === target ? null : currentTarget
        );
      }, 2000);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agentClients.addDialog.copyFailed'));
    }
  }

  function upsertAgentClient(nextAgentClient: AgentClient) {
    setAgentClients((currentAgentClients) => {
      const exists = currentAgentClients.some(
        (agentClient) => agentClient.uuid === nextAgentClient.uuid
      );

      if (!exists) {
        return [nextAgentClient, ...currentAgentClients];
      }

      return currentAgentClients.map((agentClient) =>
        agentClient.uuid === nextAgentClient.uuid ? nextAgentClient : agentClient
      );
    });
  }

  async function handleApproveAgentClient(agentClient: AgentClient) {
    try {
      setPendingActionUUID(agentClient.uuid);

      const response = await fetch(`/api/agent-clients/${agentClient.uuid}/approve`, {
        method: 'POST'
      });
      const payload = (await response.json()) as AgentClientMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentClients.approveFailed')
            : getApiErrorMessage(payload, t, 'pages.agentClients.approveFailed')
        );
      }

      upsertAgentClient(payload.data);
      toast.success(t('pages.agentClients.approveSuccess', { name: agentClient.name }));
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agentClients.approveFailed'));
    } finally {
      setPendingActionUUID(null);
    }
  }

  async function handleRevokeAgentClient(agentClient: AgentClient) {
    try {
      setPendingActionUUID(agentClient.uuid);

      const response = await fetch(`/api/agent-clients/${agentClient.uuid}/revoke`, {
        method: 'POST'
      });
      const payload = (await response.json()) as AgentClientMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agentClients.revokeFailed')
            : getApiErrorMessage(payload, t, 'pages.agentClients.revokeFailed')
        );
      }

      upsertAgentClient(payload.data);
      toast.success(t('pages.agentClients.revokeSuccess', { name: agentClient.name }));
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agentClients.revokeFailed'));
    } finally {
      setPendingActionUUID(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="px-4">{t('pages.agentClients.table.name')}</TableHead>
                <TableHead>{t('pages.agentClients.table.hostname')}</TableHead>
                <TableHead>{t('pages.agentClients.table.uuid')}</TableHead>
                <TableHead>{t('pages.agentClients.table.version')}</TableHead>
                <TableHead>{t('pages.agentClients.table.connectionStatus')}</TableHead>
                <TableHead>{t('pages.agentClients.table.runtimeStatus')}</TableHead>
                <TableHead>{t('pages.agentClients.table.lastExchangeAt')}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.agentClients.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 px-4 text-center text-destructive"
                  >
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : agentClients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-28 px-4 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span>{t('pages.agentClients.empty')}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddDialogOpen(true)}
                      >
                        <PlusIcon />
                        {t('pages.agentClients.actions.add')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                agentClients.map((agentClient) => {
                  const connectionStatusMeta = getConnectionStatusMeta(
                    agentClient.connectionStatus,
                    t
                  );
                  const runtimeStatusMeta = getRuntimeStatusMeta(
                    agentClient.runtimeStatus,
                    t
                  );
                  const isActing = pendingActionUUID === agentClient.uuid;

                  return (
                    <TableRow key={agentClient.uuid}>
                      <TableCell className="px-4 font-medium">
                        {agentClient.name}
                      </TableCell>
                      <TableCell>{agentClient.hostname}</TableCell>
                      <TableCell>{agentClient.uuid}</TableCell>
                      <TableCell>{agentClient.version}</TableCell>
                      <TableCell>
                        <Badge variant={connectionStatusMeta.variant}>
                          {connectionStatusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={runtimeStatusMeta.variant}>
                          {runtimeStatusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDateTime(agentClient.lastExchangeAt, locale)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          {agentClient.connectionStatus === 'pending_approval' ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleApproveAgentClient(agentClient)}
                              disabled={isActing}
                            >
                              <CheckIcon />
                              {t('pages.agentClients.actions.approve')}
                            </Button>
                          ) : agentClient.connectionStatus === 'active' ||
                            agentClient.connectionStatus === 'approved' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleRevokeAgentClient(agentClient)}
                              disabled={isActing}
                            >
                              <BanIcon />
                              {t('pages.agentClients.actions.revoke')}
                            </Button>
                          ) : (
                            t('common.fallback.emptyValue')
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('pages.agentClients.addDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('pages.agentClients.addDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField>
              <FieldContent>
                <FieldLabel htmlFor="agent-client-server-base-url">
                  {t('pages.agentClients.addDialog.serverBaseUrlLabel')}
                </FieldLabel>
                <FieldDescription>
                  {t('pages.agentClients.addDialog.serverBaseUrlDescription')}
                </FieldDescription>
              </FieldContent>
              <Input
                id="agent-client-server-base-url"
                value={agentClientForm.serverBaseUrl}
                onChange={(event) =>
                  updateAgentClientForm('serverBaseUrl', event.target.value)
                }
              />
            </FormField>

            <FormField>
              <FieldLabel htmlFor="agent-client-uuid">
                {t('pages.agentClients.addDialog.clientUUIDLabel')}
              </FieldLabel>
              <Input
                id="agent-client-uuid"
                value={agentClientForm.clientUUID}
                onChange={(event) =>
                  updateAgentClientForm('clientUUID', event.target.value)
                }
              />
            </FormField>

            <FormField>
              <FieldLabel htmlFor="agent-client-name">
                {t('pages.agentClients.addDialog.clientNameLabel')}
              </FieldLabel>
              <Input
                id="agent-client-name"
                value={agentClientForm.clientName}
                onChange={(event) =>
                  updateAgentClientForm('clientName', event.target.value)
                }
              />
            </FormField>

            <FormField>
              <FieldLabel htmlFor="agent-client-concurrency">
                {t('pages.agentClients.addDialog.concurrencyLabel')}
              </FieldLabel>
              <Input
                id="agent-client-concurrency"
                inputMode="numeric"
                value={agentClientForm.concurrency}
                onChange={(event) =>
                  updateAgentClientForm('concurrency', event.target.value)
                }
              />
            </FormField>

            <FormField className="md:col-span-2">
              <FieldLabel htmlFor="agent-client-working-root">
                {t('pages.agentClients.addDialog.workingRootLabel')}
              </FieldLabel>
              <Input
                id="agent-client-working-root"
                value={agentClientForm.workingRoot}
                onChange={(event) =>
                  updateAgentClientForm('workingRoot', event.target.value)
                }
              />
            </FormField>
          </div>

          <Tabs defaultValue="local">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="local">
                {t('pages.agentClients.addDialog.localTab')}
              </TabsTrigger>
              <TabsTrigger value="docker">
                {t('pages.agentClients.addDialog.dockerTab')}
              </TabsTrigger>
              <TabsTrigger value="env">
                {t('pages.agentClients.addDialog.envTab')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-3">
              <div className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                  <span className="text-sm font-medium">
                    {t('pages.agentClients.addDialog.localCommandLabel')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyCommand('local')}
                  >
                    {copiedCommandTarget === 'local' ? <CheckIcon /> : <CopyIcon />}
                    {copiedCommandTarget === 'local'
                      ? t('pages.agentClients.actions.copied')
                      : t('pages.agentClients.actions.copy')}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={agentClientCommands.local}
                  className="min-h-48 resize-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            </TabsContent>

            <TabsContent value="docker" className="mt-3">
              <div className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                  <span className="text-sm font-medium">
                    {t('pages.agentClients.addDialog.dockerComposeLabel')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyCommand('docker')}
                  >
                    {copiedCommandTarget === 'docker' ? <CheckIcon /> : <CopyIcon />}
                    {copiedCommandTarget === 'docker'
                      ? t('pages.agentClients.actions.copied')
                      : t('pages.agentClients.actions.copy')}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={agentClientCommands.docker}
                  className="min-h-72 resize-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            </TabsContent>

            <TabsContent value="env" className="mt-3">
              <div className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                  <span className="text-sm font-medium">
                    {t('pages.agentClients.addDialog.envFileLabel')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyCommand('env')}
                  >
                    {copiedCommandTarget === 'env' ? <CheckIcon /> : <CopyIcon />}
                    {copiedCommandTarget === 'env'
                      ? t('pages.agentClients.actions.copied')
                      : t('pages.agentClients.actions.copy')}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={agentClientCommands.env}
                  className="min-h-56 resize-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex gap-2">
              <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {t('pages.agentClients.addDialog.afterStartTitle')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('pages.agentClients.addDialog.afterStartDescription')}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAgentClientForm}>
              {t('pages.agentClients.actions.reset')}
            </Button>
            <Button type="button" onClick={() => setIsAddDialogOpen(false)}>
              {t('common.actions.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
