import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  ApiError,
  ApiSuccess,
  DispatchedIssue,
  AgentClientVerificationProfileResult,
  AgentClientWorkspacePatchUpload,
  IssueAgentExecutionHistory,
  IssueExecutionHistory,
  LoopTrace,
  ExecutionFeedback
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/date-time';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import { useHeaderActions, useTeamContext } from '@/layouts/app-layout';
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  RotateCcwIcon,
  GitBranchIcon,
  BanIcon,
  XCircleIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type DispatchedIssueResponse = ApiSuccess<DispatchedIssue> | ApiError;
type IssueExecutionHistoriesResponse =
  | ApiSuccess<IssueExecutionHistory[]>
  | ApiError;
type AgentExecutionResponse =
  | ApiSuccess<IssueExecutionHistory['agentExecutions'][number]>
  | ApiError;
type AgentExecutionLogsResponse =
  | ApiSuccess<IssueAgentExecutionHistory>
  | ApiError;
type AgentExecutionRawView = 'input' | 'output';
type LoopTraceResponse = ApiSuccess<LoopTrace> | ApiError;
type ExecutionFeedbackResponse = ApiSuccess<ExecutionFeedback[]> | ApiError;

function getAgentExecutionStatusMeta(
  status: IssueExecutionHistory['agentExecutions'][number]['status'],
  t: (key: string) => string
) {
  const statusMap: Record<
    IssueExecutionHistory['agentExecutions'][number]['status'],
    {
      label: string;
      variant: 'secondary' | 'default' | 'destructive' | 'outline';
    }
  > = {
    created: {
      label: t('pages.issueDetail.status.created'),
      variant: 'secondary'
    },
    queued: {
      label: t('pages.issueDetail.status.queued'),
      variant: 'secondary'
    },
    running: {
      label: t('pages.issueDetail.status.running'),
      variant: 'default'
    },
    success: {
      label: t('pages.issueDetail.status.success'),
      variant: 'outline'
    },
    failure: {
      label: t('pages.issueDetail.status.failure'),
      variant: 'destructive'
    },
    blocked: {
      label: t('pages.issueDetail.status.blocked'),
      variant: 'destructive'
    }
  };

  return statusMap[status];
}

function formatTokenCount(
  value: number | null | undefined,
  t: (key: string) => string
) {
  return typeof value === 'number'
    ? value.toLocaleString()
    : t('common.fallback.emptyValue');
}

type ExecutionRow = {
  history: IssueExecutionHistory;
  agentExecution: IssueExecutionHistory['agentExecutions'][number];
  attemptNumber: number;
  canReset: boolean;
};

export function IssueDetailPage() {
  const { t, i18n } = useTranslation();
  const locale =
    resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const { uuid } = useParams<{ uuid: string }>();
  const { setActions, setTitle } = useHeaderActions();
  const { isAdmin } = useTeamContext();
  const [issue, setIssue] = useState<DispatchedIssue | null>(null);
  const [histories, setHistories] = useState<IssueExecutionHistory[]>([]);
  const [selectedAgentExecutionLogs, setSelectedAgentExecutionLogs] = useState<
    IssueExecutionHistory['agentExecutions'][number] | null
  >(null);
  const [
    selectedAgentExecutionRawContent,
    setSelectedAgentExecutionRawContent
  ] = useState<{
    execution: IssueExecutionHistory['agentExecutions'][number];
    view: AgentExecutionRawView;
  } | null>(null);
  const [selectedAgentExecutionDetail, setSelectedAgentExecutionDetail] =
    useState<IssueAgentExecutionHistory | null>(null);
  const [pendingRetryAgentExecution, setPendingRetryAgentExecution] = useState<
    IssueExecutionHistory['agentExecutions'][number] | null
  >(null);
  const [selectedTrace, setSelectedTrace] = useState<LoopTrace | null>(null);
  const [selectedTraceFeedback, setSelectedTraceFeedback] = useState<
    ExecutionFeedback[]
  >([]);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [selectedVerificationExecution, setSelectedVerificationExecution] =
    useState<IssueAgentExecutionHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAgentExecutionDetail, setIsLoadingAgentExecutionDetail] =
    useState(false);
  const [retryingAgentExecutionUUID, setRetryingAgentExecutionUUID] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [
    agentExecutionDetailErrorMessage,
    setAgentExecutionDetailErrorMessage
  ] = useState<string | null>(null);
  const agentExecutionLogsContainerRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    setActions(null);

    return () => {
      setActions(null);
      setTitle(null);
    };
  }, [setActions, setTitle]);

  async function loadIssueDetail() {
    if (!uuid) {
      setIssue(null);
      setHistories([]);
      setErrorMessage(t('pages.issueDetail.missingUuid'));
      setIsLoading(false);
      setTitle(t('pages.issueDetail.pageTitle'));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [issueResponse, historiesResponse] = await Promise.all([
        fetch(`/api/executions/issues/${uuid}`),
        fetch(`/api/executions/issues/${uuid}/histories`)
      ]);

      const [issuePayload, historiesPayload] = (await Promise.all([
        issueResponse.json(),
        historiesResponse.json()
      ])) as [DispatchedIssueResponse, IssueExecutionHistoriesResponse];

      if (!issueResponse.ok || !issuePayload.success) {
        throw new Error(
          issuePayload.success
            ? t('pages.issueDetail.loadFailed')
            : getApiErrorMessage(
                issuePayload,
                t,
                'pages.issueDetail.loadFailed'
              )
        );
      }

      if (!historiesResponse.ok || !historiesPayload.success) {
        throw new Error(
          historiesPayload.success
            ? t('pages.issueDetail.historiesLoadFailed')
            : getApiErrorMessage(
                historiesPayload,
                t,
                'pages.issueDetail.historiesLoadFailed'
              )
        );
      }

      setIssue(issuePayload.data);
      setHistories(historiesPayload.data);
      setTitle(issuePayload.data.displayId || issuePayload.data.name);
    } catch (error) {
      setIssue(null);
      setHistories([]);
      setTitle(t('pages.issueDetail.pageTitle'));
      setErrorMessage(
        getErrorMessage(error, t, 'pages.issueDetail.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadIssueDetail();
  }, [setTitle, uuid]);

  async function loadAgentExecutionDetail(agentExecutionUUID: string) {
    setIsLoadingAgentExecutionDetail(true);
    setAgentExecutionDetailErrorMessage(null);

    try {
      const response = await fetch(
        `/api/executions/agent-histories/${agentExecutionUUID}`
      );
      const payload = (await response.json()) as AgentExecutionLogsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.issueDetail.logsLoadFailed')
            : getApiErrorMessage(payload, t, 'pages.issueDetail.logsLoadFailed')
        );
      }

      setSelectedAgentExecutionDetail(payload.data);
    } catch (error) {
      setSelectedAgentExecutionDetail(null);
      setAgentExecutionDetailErrorMessage(
        getErrorMessage(error, t, 'pages.issueDetail.logsLoadFailed')
      );
    } finally {
      setIsLoadingAgentExecutionDetail(false);
    }
  }

  useEffect(() => {
    const activeExecution =
      selectedAgentExecutionLogs ??
      selectedAgentExecutionRawContent?.execution ??
      null;

    if (!activeExecution) {
      setSelectedAgentExecutionDetail(null);
      setAgentExecutionDetailErrorMessage(null);
      setIsLoadingAgentExecutionDetail(false);
      return;
    }

    void loadAgentExecutionDetail(activeExecution.uuid);
  }, [selectedAgentExecutionLogs, selectedAgentExecutionRawContent]);

  useEffect(() => {
    if (!selectedAgentExecutionLogs || !selectedAgentExecutionDetail) {
      return;
    }

    const element = agentExecutionLogsContainerRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [selectedAgentExecutionDetail, selectedAgentExecutionLogs]);

  async function handleRetryAgentExecution() {
    if (!pendingRetryAgentExecution) {
      return;
    }

    try {
      setRetryingAgentExecutionUUID(pendingRetryAgentExecution.uuid);

      const response = await fetch(
        `/api/executions/agent-histories/${pendingRetryAgentExecution.uuid}/retry`,
        {
          method: 'POST'
        }
      );
      const payload = (await response.json()) as AgentExecutionResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.issueDetail.retryFailed')
            : getApiErrorMessage(payload, t, 'pages.issueDetail.retryFailed')
        );
      }

      setPendingRetryAgentExecution(null);

      if (selectedAgentExecutionLogs?.uuid === payload.data.uuid) {
        setSelectedAgentExecutionLogs(null);
      }
      if (
        selectedAgentExecutionRawContent?.execution.uuid === payload.data.uuid
      ) {
        setSelectedAgentExecutionRawContent(null);
      }

      setHistories((currentHistories) =>
        currentHistories.map((history) => ({
          ...history,
          agentExecutions: history.agentExecutions.map((agentExecution) =>
            agentExecution.uuid === payload.data.uuid
              ? payload.data
              : agentExecution
          )
        }))
      );
      toast.success(
        t('pages.issueDetail.retrySuccess', { name: payload.data.agent.name })
      );
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.issueDetail.retryFailed'));
    } finally {
      setRetryingAgentExecutionUUID(null);
    }
  }

  async function openLoopTrace(historyUUID: string) {
    setIsLoadingTrace(true);
    try {
      const [traceResponse, feedbackResponse] = await Promise.all([
        fetch(`/api/executions/histories/${historyUUID}/trace`),
        fetch(`/api/executions/histories/${historyUUID}/feedback`)
      ]);
      const [tracePayload, feedbackPayload] = (await Promise.all([
        traceResponse.json(),
        feedbackResponse.json()
      ])) as [LoopTraceResponse, ExecutionFeedbackResponse];
      if (!traceResponse.ok || !tracePayload.success) {
        throw new Error(t('pages.issueDetail.trace.loadFailed'));
      }
      setSelectedTrace(tracePayload.data);
      setSelectedTraceFeedback(
        feedbackResponse.ok && feedbackPayload.success
          ? feedbackPayload.data
          : []
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.issueDetail.trace.loadFailed')
      );
    } finally {
      setIsLoadingTrace(false);
    }
  }

  async function cancelSelectedTrace() {
    if (!selectedTrace) return;
    try {
      const response = await fetch(
        `/api/executions/histories/${selectedTrace.issueExecutionUUID}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: t('pages.issueDetail.trace.cancelReason')
          })
        }
      );
      const payload = (await response.json()) as LoopTraceResponse;
      if (!response.ok || !payload.success) {
        throw new Error(t('pages.issueDetail.trace.cancelFailed'));
      }
      setSelectedTrace(payload.data);
      toast.success(t('pages.issueDetail.trace.cancelSuccess'));
      await loadIssueDetail();
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.issueDetail.trace.cancelFailed')
      );
    }
  }

  function handleDownloadAgentExecutionLogs() {
    if (!selectedAgentExecutionLogs || !selectedAgentExecutionDetail) {
      return;
    }

    const fileName = buildAgentExecutionLogFileName(
      selectedAgentExecutionLogs.agent.name,
      selectedAgentExecutionLogs.uuid
    );
    const blob = new Blob([selectedAgentExecutionDetail.logs ?? ''], {
      type: 'text/plain;charset=utf-8'
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  }

  function getVerificationResults(
    execution: IssueAgentExecutionHistory
  ): AgentClientVerificationProfileResult[] {
    const value = execution.executeResult.verificationResults;
    return Array.isArray(value)
      ? (value as unknown as AgentClientVerificationProfileResult[])
      : [];
  }

  function getWorkspacePatch(
    execution: IssueAgentExecutionHistory
  ): AgentClientWorkspacePatchUpload | null {
    const value = execution.executeResult.workspacePatch;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as unknown as AgentClientWorkspacePatchUpload)
      : null;
  }

  function downloadWorkspacePatch(execution: IssueAgentExecutionHistory) {
    const link = document.createElement('a');
    link.href = `/api/executions/agent-histories/${execution.uuid}/workspace-patch`;
    link.download = `workspace-patch-${execution.uuid}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openAgentExecutionLogs(
    agentExecution: IssueExecutionHistory['agentExecutions'][number]
  ) {
    setSelectedAgentExecutionRawContent(null);
    setSelectedAgentExecutionLogs(agentExecution);
  }

  function openAgentExecutionRawContent(
    execution: IssueExecutionHistory['agentExecutions'][number],
    view: AgentExecutionRawView
  ) {
    setSelectedAgentExecutionLogs(null);
    setSelectedAgentExecutionRawContent({
      execution,
      view
    });
  }

  function getSelectedRawContentTitle(): string {
    if (!selectedAgentExecutionRawContent) {
      return t('pages.issueDetail.rawDialog.titleFallback');
    }

    return selectedAgentExecutionRawContent.view === 'input'
      ? t('pages.issueDetail.rawDialog.titleInputWithAgent', {
          name: selectedAgentExecutionRawContent.execution.agent.name
        })
      : t('pages.issueDetail.rawDialog.titleOutputWithAgent', {
          name: selectedAgentExecutionRawContent.execution.agent.name
        });
  }

  function getSelectedRawSectionTitle(): string {
    if (!selectedAgentExecutionRawContent) {
      return t('pages.issueDetail.rawDialog.sectionTitleInput');
    }

    return selectedAgentExecutionRawContent.view === 'input'
      ? t('pages.issueDetail.rawDialog.sectionTitleInput')
      : t('pages.issueDetail.rawDialog.sectionTitleOutput');
  }

  function getSelectedRawContentValue(): string {
    if (!selectedAgentExecutionRawContent || !selectedAgentExecutionDetail) {
      return '';
    }

    return selectedAgentExecutionRawContent.view === 'input'
      ? (selectedAgentExecutionDetail.prompt ?? '')
      : (selectedAgentExecutionDetail.rawExecuteResult ?? '');
  }

  function getSelectedRawEmptyText(): string {
    if (!selectedAgentExecutionRawContent) {
      return t('pages.issueDetail.rawDialog.emptyInput');
    }

    return selectedAgentExecutionRawContent.view === 'input'
      ? t('pages.issueDetail.rawDialog.emptyInput')
      : t('pages.issueDetail.rawDialog.emptyOutput');
  }

  const executionRows = useMemo<ExecutionRow[]>(() => {
    const latestAgentExecutionUUID = histories
      .flatMap((history) => history.agentExecutions)
      .reduce<ExecutionRow['agentExecution'] | null>((latest, candidate) => {
        if (!latest) {
          return candidate;
        }

        return Date.parse(candidate.createdAt) > Date.parse(latest.createdAt)
          ? candidate
          : latest;
      }, null)?.uuid;

    return histories.flatMap((history) => {
      return history.agentExecutions.map((agentExecution, attemptIndex) => ({
        history,
        agentExecution,
        attemptNumber: agentExecution.attemptNumber || attemptIndex + 1,
        canReset:
          latestAgentExecutionUUID === agentExecution.uuid &&
          (agentExecution.status === 'blocked' ||
            agentExecution.status === 'failure')
      }));
    });
  }, [histories]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        {isLoading ? (
          <div className="rounded-lg border px-4 py-8 text-center text-muted-foreground">
            {t('common.states.loading')}
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-destructive">
            {errorMessage}
          </div>
        ) : !issue ? (
          <div className="rounded-lg border px-4 py-8 text-center text-muted-foreground">
            {t('pages.issueDetail.notFound')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-4">
                    {t('pages.issueDetail.table.agent')}
                  </TableHead>
                  <TableHead>
                    {t('pages.issueDetail.table.iteration')}
                  </TableHead>
                  <TableHead>{t('pages.issueDetail.table.attempt')}</TableHead>
                  <TableHead>
                    {t('pages.issueDetail.table.executeClient')}
                  </TableHead>
                  <TableHead>{t('pages.issueDetail.table.status')}</TableHead>
                  <TableHead>
                    {t('pages.issueDetail.table.inputTokens')}
                  </TableHead>
                  <TableHead>
                    {t('pages.issueDetail.table.outputTokens')}
                  </TableHead>
                  <TableHead>
                    {t('pages.issueDetail.table.startedAt')}
                  </TableHead>
                  <TableHead>
                    {t('pages.issueDetail.table.finishedAt')}
                  </TableHead>
                  <TableHead className="pr-4 text-right">
                    {t('pages.issueDetail.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executionRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-24 px-4 text-center text-muted-foreground"
                    >
                      {t('pages.issueDetail.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  executionRows.map(
                    ({ history, agentExecution, attemptNumber, canReset }) => {
                      const agentStatusMeta = getAgentExecutionStatusMeta(
                        agentExecution.status,
                        t
                      );
                      const verificationResults =
                        getVerificationResults(agentExecution);
                      const workspacePatch = getWorkspacePatch(agentExecution);

                      return (
                        <TableRow key={agentExecution.uuid}>
                          <TableCell className="px-4 font-medium">
                            {agentExecution.agent.name}
                          </TableCell>
                          <TableCell>
                            {history.triggerReason === 'revision'
                              ? t('pages.issueDetail.table.revisionIteration', {
                                  count: history.iteration
                                })
                              : t('pages.issueDetail.table.initialIteration')}
                          </TableCell>
                          <TableCell>
                            {t('pages.issueDetail.table.attemptNumber', {
                              count: attemptNumber
                            })}
                          </TableCell>
                          <TableCell>
                            {agentExecution.executeClient?.name ??
                              t('common.fallback.emptyValue')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={agentStatusMeta.variant}>
                              {agentStatusMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatTokenCount(
                              agentExecution.usage?.inputTokens,
                              t
                            )}
                          </TableCell>
                          <TableCell>
                            {formatTokenCount(
                              agentExecution.usage?.outputTokens,
                              t
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(agentExecution.startedAt, locale)}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(agentExecution.finishedAt, locale)}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                disabled={isLoadingTrace}
                                onClick={() => void openLoopTrace(history.uuid)}
                              >
                                <GitBranchIcon />
                                {t('pages.issueDetail.actions.viewTrace')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  openAgentExecutionLogs(agentExecution)
                                }
                              >
                                <FileTextIcon />
                                {t('pages.issueDetail.actions.viewLogs')}
                              </Button>
                              {verificationResults.length > 0 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  onClick={() =>
                                    setSelectedVerificationExecution(
                                      agentExecution
                                    )
                                  }
                                >
                                  {t(
                                    'pages.issueDetail.actions.viewVerification'
                                  )}
                                </Button>
                              ) : null}
                              {workspacePatch ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  type="button"
                                  onClick={() =>
                                    downloadWorkspacePatch(agentExecution)
                                  }
                                >
                                  <DownloadIcon />
                                  {t('pages.issueDetail.actions.downloadPatch')}
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  openAgentExecutionRawContent(
                                    agentExecution,
                                    'input'
                                  )
                                }
                              >
                                {t('pages.issueDetail.actions.viewInput')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  openAgentExecutionRawContent(
                                    agentExecution,
                                    'output'
                                  )
                                }
                              >
                                {t('pages.issueDetail.actions.viewOutput')}
                              </Button>
                              {canReset ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  type="button"
                                  onClick={() =>
                                    setPendingRetryAgentExecution(
                                      agentExecution
                                    )
                                  }
                                >
                                  <RotateCcwIcon />
                                  {t('pages.issueDetail.actions.retry')}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  )
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={selectedVerificationExecution !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedVerificationExecution(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('pages.issueDetail.verificationDialog.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {selectedVerificationExecution
              ? getVerificationResults(selectedVerificationExecution).map(
                  (profile) => (
                    <section key={profile.profileUUID} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {profile.status === 'passed' ? (
                          <CheckCircle2Icon className="size-4 text-green-600" />
                        ) : (
                          <XCircleIcon className="size-4 text-destructive" />
                        )}
                        {profile.profileName}
                      </div>
                      <div className="overflow-hidden rounded-lg border">
                        <Table>
                          <TableHeader className="bg-muted">
                            <TableRow>
                              <TableHead className="px-4">
                                {t('pages.issueDetail.verificationDialog.step')}
                              </TableHead>
                              <TableHead>
                                {t(
                                  'pages.issueDetail.verificationDialog.status'
                                )}
                              </TableHead>
                              <TableHead>
                                {t(
                                  'pages.issueDetail.verificationDialog.duration'
                                )}
                              </TableHead>
                              <TableHead>
                                {t(
                                  'pages.issueDetail.verificationDialog.output'
                                )}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {profile.steps.map((step) => (
                              <TableRow key={step.stepUUID}>
                                <TableCell className="px-4 font-medium">
                                  {step.stepName}
                                </TableCell>
                                <TableCell>{step.status}</TableCell>
                                <TableCell>{step.durationMs} ms</TableCell>
                                <TableCell className="max-w-lg whitespace-pre-wrap font-mono text-xs">
                                  {step.stderr ||
                                    step.stdout ||
                                    t('common.fallback.emptyValue')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </section>
                  )
                )
              : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedTrace !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTrace(null);
            setSelectedTraceFeedback([]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.issueDetail.trace.title')}</DialogTitle>
          </DialogHeader>
          {selectedTrace ? (
            <div className="space-y-5">
              <div className="grid gap-3 border-y py-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Trace</div>
                  <div className="break-all font-mono text-xs">
                    {selectedTrace.uuid}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t('pages.issueDetail.trace.iteration')}
                  </div>
                  <div>{selectedTrace.iteration}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t('pages.issueDetail.trace.attempts')}
                  </div>
                  <div>{selectedTrace.attempts.length}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t('pages.issueDetail.trace.feedback')}
                  </div>
                  <div>{selectedTrace.feedbackCount}</div>
                </div>
              </div>
              {selectedTrace.blockReason ? (
                <p className="border-l-2 border-destructive px-3 text-sm text-destructive">
                  {selectedTrace.blockReason}
                </p>
              ) : null}
              <div className="space-y-2">
                {selectedTrace.attempts.map((attempt) => (
                  <div key={attempt.uuid} className="border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {t('pages.issueDetail.table.attemptNumber', {
                          count: attempt.attemptNumber
                        })}
                      </span>
                      <Badge
                        variant={
                          attempt.status === 'success'
                            ? 'default'
                            : attempt.status === 'blocked' ||
                                attempt.status === 'failure'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {t(`pages.issueDetail.status.${attempt.status}`)}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>{attempt.executeClient?.name ?? '-'}</span>
                      <span>
                        {attempt.durationMs === null
                          ? '-'
                          : `${Math.round(attempt.durationMs / 1000)}s`}
                      </span>
                      <span>
                        Token:{' '}
                        {attempt.usage
                          ? (attempt.usage.inputTokens ?? 0) +
                            (attempt.usage.outputTokens ?? 0)
                          : '-'}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>
                        {t('pages.issueDetail.trace.modelDuration')}:{' '}
                        {attempt.modelDurationMs === null
                          ? '-'
                          : `${attempt.modelDurationMs}ms`}
                      </span>
                      <span>
                        {t('pages.issueDetail.trace.recoveredAt')}:{' '}
                        {attempt.recoveredAt
                          ? formatDateTime(attempt.recoveredAt, locale)
                          : '-'}
                      </span>
                      <span className="break-all">
                        {t('pages.issueDetail.trace.failureSignature')}:{' '}
                        {attempt.failureSignature ?? '-'}
                      </span>
                    </div>
                    {attempt.verification.length > 0 ? (
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-medium">
                          {t('pages.issueDetail.trace.verification')}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {attempt.verification.map((verification) => (
                            <Badge
                              key={verification.profileUUID}
                              variant={
                                verification.status === 'passed'
                                  ? 'default'
                                  : 'destructive'
                              }
                            >
                              {verification.profileName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {attempt.writeTargets.length > 0 ? (
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-medium">
                          {t('pages.issueDetail.trace.writeTargets')}
                        </div>
                        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          {attempt.writeTargets.map((target) => (
                            <li key={target}>{target}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {attempt.evaluation ? (
                      <details className="mt-3 border-t pt-2">
                        <summary className="cursor-pointer text-xs font-medium">
                          {t('pages.issueDetail.trace.evaluation')}
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-muted p-2 text-xs">
                          {JSON.stringify(attempt.evaluation, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
              {selectedTraceFeedback.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    {t('pages.issueDetail.trace.feedback')}
                  </h3>
                  <div className="space-y-2">
                    {selectedTraceFeedback.map((feedback) => (
                      <div key={feedback.uuid} className="border p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="outline">{feedback.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {feedback.commentUUID ?? feedback.source}
                          </span>
                        </div>
                        <p>{feedback.excerpt}</p>
                        {feedback.resolution ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {feedback.resolution}
                          </p>
                        ) : null}
                        {feedback.writeTargets.length > 0 ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {feedback.writeTargets.map((target) => (
                              <li key={target}>{target}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {isAdmin &&
              ['created', 'executing'].includes(selectedTrace.status) ? (
                <Button
                  variant="destructive"
                  onClick={() => void cancelSelectedTrace()}
                >
                  <BanIcon />
                  {t('pages.issueDetail.trace.cancel')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedAgentExecutionLogs !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAgentExecutionLogs(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAgentExecutionLogs
                ? t('pages.issueDetail.logsDialog.titleWithAgent', {
                    name: selectedAgentExecutionLogs.agent.name
                  })
                : t('pages.issueDetail.logsDialog.titleFallback')}
            </DialogTitle>
          </DialogHeader>

          {selectedAgentExecutionLogs ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-3">
                <div className="text-sm font-medium">
                  {t('pages.issueDetail.logsSectionTitle')}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isLoadingAgentExecutionDetail}
                    onClick={() =>
                      void loadAgentExecutionDetail(
                        selectedAgentExecutionLogs.uuid
                      )
                    }
                  >
                    {isLoadingAgentExecutionDetail
                      ? t('pages.issueDetail.states.logsRefreshing')
                      : t('pages.issueDetail.actions.refreshLogs')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={!selectedAgentExecutionDetail}
                    onClick={handleDownloadAgentExecutionLogs}
                  >
                    <DownloadIcon />
                    {t('pages.issueDetail.actions.downloadLogs')}
                  </Button>
                </div>
              </div>
              {isLoadingAgentExecutionDetail &&
              !selectedAgentExecutionDetail ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('pages.issueDetail.states.logsLoading')}
                </div>
              ) : agentExecutionDetailErrorMessage ? (
                <div className="px-4 py-8 text-center text-sm text-destructive">
                  {agentExecutionDetailErrorMessage}
                </div>
              ) : (
                <pre
                  ref={agentExecutionLogsContainerRef}
                  className="max-h-[60vh] overflow-auto bg-muted/20 p-4 text-xs leading-6 whitespace-pre-wrap break-all"
                >
                  {selectedAgentExecutionDetail?.logs ||
                    t('pages.issueDetail.logsSectionEmpty')}
                </pre>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedAgentExecutionRawContent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAgentExecutionRawContent(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{getSelectedRawContentTitle()}</DialogTitle>
          </DialogHeader>

          {selectedAgentExecutionRawContent ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-3">
                <div className="text-sm font-medium">
                  {getSelectedRawSectionTitle()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isLoadingAgentExecutionDetail}
                    onClick={() =>
                      void loadAgentExecutionDetail(
                        selectedAgentExecutionRawContent.execution.uuid
                      )
                    }
                  >
                    {isLoadingAgentExecutionDetail
                      ? t('pages.issueDetail.states.logsRefreshing')
                      : t('common.actions.refresh')}
                  </Button>
                </div>
              </div>
              {isLoadingAgentExecutionDetail &&
              !selectedAgentExecutionDetail ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('pages.issueDetail.states.logsLoading')}
                </div>
              ) : agentExecutionDetailErrorMessage ? (
                <div className="px-4 py-8 text-center text-sm text-destructive">
                  {agentExecutionDetailErrorMessage}
                </div>
              ) : (
                <pre className="max-h-[60vh] overflow-auto bg-muted/20 p-4 text-xs leading-6 whitespace-pre-wrap break-all">
                  {getSelectedRawContentValue() || getSelectedRawEmptyText()}
                </pre>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingRetryAgentExecution !== null}
        onOpenChange={(open) => {
          if (!open && !retryingAgentExecutionUUID) {
            setPendingRetryAgentExecution(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('pages.issueDetail.retryDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRetryAgentExecution
                ? t('pages.issueDetail.retryDialog.descriptionWithAgent', {
                    name: pendingRetryAgentExecution.agent.name
                  })
                : t('pages.issueDetail.retryDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(retryingAgentExecutionUUID)}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(retryingAgentExecutionUUID)}
              onClick={(event) => {
                event.preventDefault();
                void handleRetryAgentExecution();
              }}
            >
              {retryingAgentExecutionUUID
                ? t('pages.issueDetail.states.retrying')
                : t('pages.issueDetail.actions.retry')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function buildAgentExecutionLogFileName(
  agentName: string,
  executionUUID: string
): string {
  const normalizedAgentName =
    agentName
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'agent';

  return `${normalizedAgentName}-${executionUUID}.log`;
}
