import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AgentSummary, ApiError, ApiSuccess } from '@ones-ai-workflow/shared';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { CopyIcon, PlusIcon, Settings2Icon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentsResponse = ApiSuccess<AgentSummary[]> | ApiError;
type AgentMutationResponse = ApiSuccess<AgentSummary> | ApiError;

export function AgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteAgent, setPendingDeleteAgent] =
    useState<AgentSummary | null>(null);
  const [deletingAgentUUID, setDeletingAgentUUID] = useState<string | null>(null);
  const [duplicatingAgentUUID, setDuplicatingAgentUUID] = useState<string | null>(null);

  async function loadAgents() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/agents');
      const payload = (await response.json()) as AgentsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agents.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.agents.loadFailed')
        );
      }

      setAgents(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.agents.loadFailed'));
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  async function handleCreateAgent() {
    try {
      setIsCreating(true);

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: '',
          workspaceUUID: null,
          skillUUIDs: [],
          executorUUID: null,
          executorName: null
        })
      });
      const payload = (await response.json()) as AgentMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agents.createFailed')
            : getApiErrorMessage(payload, t, 'pages.agents.createFailed')
        );
      }

      navigate(`/settings/agents/${payload.data.uuid}`);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agents.createFailed'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteAgent() {
    if (!pendingDeleteAgent) {
      return;
    }

    try {
      setDeletingAgentUUID(pendingDeleteAgent.uuid);

      const response = await fetch(`/api/agents/${pendingDeleteAgent.uuid}`, {
        method: 'DELETE'
      });
      const payload = (await response.json()) as ApiSuccess<true> | ApiError;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agents.deleteFailed')
            : getApiErrorMessage(payload, t, 'pages.agents.deleteFailed')
        );
      }

      setAgents((currentAgents) =>
        currentAgents.filter((agent) => agent.uuid !== pendingDeleteAgent.uuid)
      );
      toast.success(t('pages.agents.deleteSuccess', { name: pendingDeleteAgent.name }));
      setPendingDeleteAgent(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agents.deleteFailed'));
    } finally {
      setDeletingAgentUUID(null);
    }
  }

  async function handleDuplicateAgent(agent: AgentSummary) {
    try {
      setDuplicatingAgentUUID(agent.uuid);

      const response = await fetch(`/api/agents/${agent.uuid}/duplicate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: t('pages.agents.duplicateName', { name: agent.name })
        })
      });
      const payload = (await response.json()) as AgentMutationResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.agents.duplicateFailed')
            : getApiErrorMessage(payload, t, 'pages.agents.duplicateFailed')
        );
      }

      toast.success(t('pages.agents.duplicateSuccess', { name: payload.data.name }));
      navigate(`/settings/agents/${payload.data.uuid}`);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.agents.duplicateFailed'));
    } finally {
      setDuplicatingAgentUUID(null);
    }
  }

  const visibleAgents = agents.filter((agent) => agent.name.trim() !== '');
  const isMutatingAgent = Boolean(deletingAgentUUID) || Boolean(duplicatingAgentUUID);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex items-center justify-start">
          <Button size="sm" onClick={() => void handleCreateAgent()} disabled={isCreating}>
            <PlusIcon />
            {t('pages.agents.actions.create')}
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="px-4">{t('pages.agents.table.index')}</TableHead>
                <TableHead>{t('pages.agents.table.name')}</TableHead>
                <TableHead>{t('pages.agents.table.workspace')}</TableHead>
                <TableHead>{t('pages.agents.table.executor')}</TableHead>
                <TableHead>{t('pages.agents.table.skills')}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.agents.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 px-4 text-center text-destructive"
                  >
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : visibleAgents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.agents.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                visibleAgents.map((agent, index) => (
                  <TableRow key={agent.uuid}>
                    <TableCell className="px-4 font-medium">{index + 1}</TableCell>
                    <TableCell>{agent.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {agent.workspace?.name ?? t('common.fallback.emptyValue')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {agent.executor?.name ?? t('common.fallback.emptyValue')}
                    </TableCell>
                    <TableCell className="max-w-xl whitespace-pre-wrap text-sm text-muted-foreground">
                      {agent.skills.length > 0
                        ? agent.skills.map((skill) => skill.name).join(', ')
                        : t('common.fallback.emptyValue')}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/settings/agents/${agent.uuid}`)}
                          disabled={isMutatingAgent}
                        >
                          <Settings2Icon />
                          {t('pages.agents.actions.configure')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDuplicateAgent(agent)}
                          disabled={isMutatingAgent}
                        >
                          <CopyIcon />
                          {t('pages.agents.actions.duplicate')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingDeleteAgent(agent)}
                          disabled={isMutatingAgent}
                        >
                          <Trash2Icon />
                          {t('pages.agents.actions.delete')}
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

      <AlertDialog
        open={Boolean(pendingDeleteAgent)}
        onOpenChange={(open) => {
          if (!open && !deletingAgentUUID) {
            setPendingDeleteAgent(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.agents.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAgent
                ? t('pages.agents.deleteDialog.descriptionWithName', {
                    name: pendingDeleteAgent.name
                  })
                : t('pages.agents.deleteDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingAgentUUID)}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteAgent()}
              disabled={Boolean(deletingAgentUUID)}
            >
              {deletingAgentUUID
                ? t('common.states.deleting')
                : t('common.actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
