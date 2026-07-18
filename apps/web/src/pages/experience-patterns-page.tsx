import { useEffect, useMemo, useState } from 'react';
import type {
  AgentSummary,
  ApiError,
  ApiSuccess,
  ExperiencePattern,
  WorkflowSummary
} from '@ones-ai-workflow/shared';
import { Badge } from '@/components/ui/badge';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { useTranslation } from 'react-i18next';

type PatternsResponse = ApiSuccess<ExperiencePattern[]> | ApiError;
type AgentsResponse = ApiSuccess<AgentSummary[]> | ApiError;
type WorkflowsResponse = ApiSuccess<WorkflowSummary[]> | ApiError;

export function ExperiencePatternsPage() {
  const { t } = useTranslation();
  const [patterns, setPatterns] = useState<ExperiencePattern[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [agentUUID, setAgentUUID] = useState('');
  const [workflowUUID, setWorkflowUUID] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        value: agent.uuid,
        label: agent.name,
        keywords: [agent.uuid]
      })),
    [agents]
  );
  const workflowOptions = useMemo(
    () =>
      workflows.map((workflow) => ({
        value: workflow.uuid,
        label: workflow.name,
        keywords: [workflow.uuid]
      })),
    [workflows]
  );

  useEffect(() => {
    void fetch('/api/agents')
      .then(async (response) => {
        const payload = (await response.json()) as AgentsResponse;
        if (!response.ok || !payload.success) return;
        setAgents(payload.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetch('/api/workflows')
      .then(async (response) => {
        const payload = (await response.json()) as WorkflowsResponse;
        if (!response.ok || !payload.success) return;
        setWorkflows(payload.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    const query = new URLSearchParams();
    if (agentUUID) query.set('agentUUID', agentUUID);
    if (workflowUUID) query.set('workflowUUID', workflowUUID);
    const queryString = query.toString();
    void fetch(
      `/api/experience-patterns${queryString ? `?${queryString}` : ''}`
    )
      .then(async (response) => ({
        response,
        payload: (await response.json()) as PatternsResponse
      }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok || !payload.success) {
          throw new Error(
            payload.success
              ? t('pages.experiencePatterns.loadFailed')
              : getApiErrorMessage(
                  payload,
                  t,
                  'pages.experiencePatterns.loadFailed'
                )
          );
        }
        setPatterns(payload.data);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            getErrorMessage(error, t, 'pages.experiencePatterns.loadFailed')
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentUUID, workflowUUID, t]);

  return (
    <div className="flex flex-1 flex-col overflow-auto px-4 py-5 lg:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {t('pages.experiencePatterns.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.experiencePatterns.description')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <SearchSelect
              value={agentUUID}
              options={agentOptions}
              onValueChange={(value) => setAgentUUID(value ?? '')}
              placeholder={t('pages.experiencePatterns.agentPlaceholder')}
              emptyText={t('pages.experiencePatterns.agentEmpty')}
              className="w-full md:w-64"
            />
            <SearchSelect
              value={workflowUUID}
              options={workflowOptions}
              onValueChange={(value) => setWorkflowUUID(value ?? '')}
              placeholder={t('pages.experiencePatterns.workflowPlaceholder')}
              emptyText={t('pages.experiencePatterns.workflowEmpty')}
              className="w-full md:w-64"
            />
          </div>
        </div>
        {errorMessage ? (
          <p className="mb-4 border-l-2 border-destructive px-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <div className="overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">
                  {t('pages.experiencePatterns.table.pattern')}
                </TableHead>
                <TableHead>
                  {t('pages.experiencePatterns.table.type')}
                </TableHead>
                <TableHead>
                  {t('pages.experiencePatterns.table.agent')}
                </TableHead>
                <TableHead>
                  {t('pages.experiencePatterns.table.workflow')}
                </TableHead>
                <TableHead>
                  {t('pages.experiencePatterns.table.evidence')}
                </TableHead>
                <TableHead>
                  {t('pages.experiencePatterns.table.confidence')}
                </TableHead>
                <TableHead className="pr-4">
                  {t('pages.experiencePatterns.table.strategy')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : patterns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('pages.experiencePatterns.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                patterns.map((pattern) => (
                  <TableRow key={pattern.uuid}>
                    <TableCell className="max-w-sm px-4 font-medium">
                      {pattern.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(`pages.experiencePatterns.type.${pattern.type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{pattern.agentName ?? '-'}</TableCell>
                    <TableCell>{pattern.workflowName ?? '-'}</TableCell>
                    <TableCell>{pattern.evidenceCount}</TableCell>
                    <TableCell>
                      {Math.round(pattern.confidence * 100)}%
                    </TableCell>
                    <TableCell className="max-w-md pr-4 text-sm text-muted-foreground">
                      {pattern.repairStrategy}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
