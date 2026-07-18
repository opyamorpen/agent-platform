import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  ApiError,
  ApiSuccess,
  DispatchedIssue,
  IssueAgentExecutionHistory,
  IssueExecutionHistory
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
import { useHeaderActions } from '@/layouts/app-layout';
import { DownloadIcon, FileTextIcon, RotateCcwIcon } from 'lucide-react';
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
        attemptNumber: attemptIndex + 1,
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
                                onClick={() =>
                                  openAgentExecutionLogs(agentExecution)
                                }
                              >
                                <FileTextIcon />
                                {t('pages.issueDetail.actions.viewLogs')}
                              </Button>
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
