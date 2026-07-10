import { useEffect, useState } from 'react';
import type { AgentClient, ApiError, ApiSuccess } from '@ones-ai-workflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/date-time';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { BanIcon, CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentClientsResponse = ApiSuccess<AgentClient[]> | ApiError;
type AgentClientMutationResponse = ApiSuccess<AgentClient> | ApiError;

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
  const [agentClients, setAgentClients] = useState<AgentClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingActionUUID, setPendingActionUUID] = useState<string | null>(null);

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
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.agentClients.empty')}
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
    </div>
  );
}
