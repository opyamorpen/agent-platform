import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgentSummary,
  ApiError,
  ApiSuccess,
  AssetCandidate,
  AssetOptimizationRun,
  AssetOptimizationRunSummary
} from '@ones-ai-workflow/shared';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/date-time';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import {
  BookOpenIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileTextIcon,
  HistoryIcon,
  PackageIcon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type AgentsResponse = ApiSuccess<AgentSummary[]> | ApiError;
type RunsResponse = ApiSuccess<AssetOptimizationRunSummary[]> | ApiError;
type CreateRunResponse = ApiSuccess<AssetOptimizationRunSummary> | ApiError;
type RunResponse = ApiSuccess<AssetOptimizationRun> | ApiError;
type CandidateResponse = ApiSuccess<AssetCandidate> | ApiError;

function getRunStatusVariant(status: AssetOptimizationRunSummary['status']) {
  if (status === 'failed') return 'destructive' as const;
  if (status === 'ready') return 'default' as const;
  return 'secondary' as const;
}

function getCandidateStatusVariant(status: AssetCandidate['status']) {
  if (status === 'conflict') return 'destructive' as const;
  if (status === 'applied' || status === 'reviewed') return 'default' as const;
  return 'secondary' as const;
}

function CandidateTypeIcon({ type }: { type: AssetCandidate['type'] }) {
  if (type === 'prompt') return <FileTextIcon />;
  if (type === 'skill') return <PackageIcon />;
  return <BookOpenIcon />;
}

export function AssetOptimizationsPage() {
  const { t, i18n } = useTranslation();
  const locale =
    resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [runs, setRuns] = useState<AssetOptimizationRunSummary[]>([]);
  const [selectedAgentUUID, setSelectedAgentUUID] = useState('');
  const [selectedRunUUID, setSelectedRunUUID] = useState('');
  const [selectedRun, setSelectedRun] = useState<AssetOptimizationRun | null>(
    null
  );
  const [previewCandidate, setPreviewCandidate] =
    useState<AssetCandidate | null>(null);
  const [selectedSkillPath, setSelectedSkillPath] = useState('');
  const [pendingApply, setPendingApply] = useState<AssetCandidate | null>(null);
  const [scriptReviewConfirmed, setScriptReviewConfirmed] = useState(false);
  const [pendingDismiss, setPendingDismiss] = useState<AssetCandidate | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mutatingCandidateUUID, setMutatingCandidateUUID] = useState<
    string | null
  >(null);
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

  const loadRun = useCallback(
    async (uuid: string) => {
      if (!uuid) {
        setSelectedRun(null);
        return;
      }
      const response = await fetch(`/api/asset-optimizations/runs/${uuid}`);
      const payload = (await response.json()) as RunResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.assetOptimizations.loadFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.assetOptimizations.loadFailed'
              )
        );
      }
      setSelectedRun(payload.data);
    },
    [t]
  );

  const loadRuns = useCallback(
    async (preferredRunUUID?: string) => {
      const response = await fetch('/api/asset-optimizations/runs');
      const payload = (await response.json()) as RunsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.assetOptimizations.loadFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.assetOptimizations.loadFailed'
              )
        );
      }
      setRuns(payload.data);
      const nextUUID = preferredRunUUID || payload.data[0]?.uuid || '';
      setSelectedRunUUID(nextUUID);
      await loadRun(nextUUID);
    },
    [loadRun, t]
  );

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const agentsResponse = await fetch('/api/agents');
      const agentsPayload = (await agentsResponse.json()) as AgentsResponse;
      if (!agentsResponse.ok || !agentsPayload.success) {
        throw new Error(
          agentsPayload.success
            ? t('pages.assetOptimizations.agentsLoadFailed')
            : getApiErrorMessage(
                agentsPayload,
                t,
                'pages.assetOptimizations.agentsLoadFailed'
              )
        );
      }
      setAgents(agentsPayload.data);
      setSelectedAgentUUID(
        (current) => current || agentsPayload.data[0]?.uuid || ''
      );
      await loadRuns();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.assetOptimizations.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadRuns, t]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!runs.some((run) => run.status === 'generating')) return;
    const timer = window.setInterval(() => {
      void loadRuns(selectedRunUUID).catch((error) =>
        setErrorMessage(
          getErrorMessage(error, t, 'pages.assetOptimizations.loadFailed')
        )
      );
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [loadRuns, runs, selectedRunUUID, t]);

  async function generate() {
    if (!selectedAgentUUID) return;
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/asset-optimizations/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentUUID: selectedAgentUUID })
      });
      const payload = (await response.json()) as CreateRunResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.assetOptimizations.generateFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.assetOptimizations.generateFailed'
              )
        );
      }
      toast.success(t('pages.assetOptimizations.generateStarted'));
      await loadRuns(payload.data.uuid);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.assetOptimizations.generateFailed')
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function mutateCandidate(
    candidate: AssetCandidate,
    action: 'apply' | 'dismiss',
    scriptReviewed = false
  ) {
    setMutatingCandidateUUID(candidate.uuid);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/asset-optimizations/candidates/${candidate.uuid}/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedUpdatedAt: candidate.updatedAt,
            ...(action === 'apply'
              ? {
                  scriptReviewed
                }
              : {})
          })
        }
      );
      const payload = (await response.json()) as CandidateResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t(`pages.assetOptimizations.${action}Failed`)
            : getApiErrorMessage(
                payload,
                t,
                `pages.assetOptimizations.${action}Failed`
              )
        );
      }
      toast.success(t(`pages.assetOptimizations.${action}Success`));
      setPreviewCandidate(null);
      await loadRuns(selectedRunUUID);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, `pages.assetOptimizations.${action}Failed`)
      );
      await loadRuns(selectedRunUUID).catch(() => undefined);
    } finally {
      setMutatingCandidateUUID(null);
    }
  }

  function openPreview(candidate: AssetCandidate) {
    setPreviewCandidate(candidate);
    setSelectedSkillPath(
      candidate.content.type === 'skill'
        ? (candidate.content.files[0]?.path ?? '')
        : ''
    );
  }

  function renderPreviewContent(candidate: AssetCandidate) {
    if (candidate.content.type === 'prompt') {
      return (
        <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap border bg-muted/30 p-4 text-xs leading-5">
          {candidate.content.prompt}
        </pre>
      );
    }
    if (candidate.content.type === 'knowledge') {
      return (
        <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap border bg-muted/30 p-4 text-xs leading-5">
          {candidate.content.markdown}
        </pre>
      );
    }
    const activeFile =
      candidate.content.files.find((file) => file.path === selectedSkillPath) ??
      candidate.content.files[0];
    return (
      <div className="grid min-h-[420px] grid-cols-1 border sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="border-b bg-muted/30 p-2 sm:border-r sm:border-b-0">
          {candidate.content.files.map((file) => (
            <Button
              key={file.path}
              variant={activeFile?.path === file.path ? 'secondary' : 'ghost'}
              className="mb-1 h-auto w-full justify-start whitespace-normal px-2 py-1.5 text-left text-xs"
              onClick={() => setSelectedSkillPath(file.path)}
            >
              {file.path}
            </Button>
          ))}
        </div>
        <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5">
          {activeFile?.content ?? ''}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-4 py-5 lg:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {t('pages.assetOptimizations.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.assetOptimizations.description')}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <SearchSelect
              value={selectedAgentUUID}
              options={agentOptions}
              onValueChange={(value) => setSelectedAgentUUID(value ?? '')}
              placeholder={t('pages.assetOptimizations.agentPlaceholder')}
              emptyText={t('pages.assetOptimizations.agentEmpty')}
              className="w-full sm:w-64"
              disabled={isLoading || isGenerating}
            />
            <Button
              onClick={() => void generate()}
              disabled={!selectedAgentUUID || isLoading || isGenerating}
            >
              <SparklesIcon />
              {isGenerating
                ? t('pages.assetOptimizations.generating')
                : t('pages.assetOptimizations.generate')}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 border-l-2 border-destructive px-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">
                  {t('pages.assetOptimizations.table.agent')}
                </TableHead>
                <TableHead>
                  {t('pages.assetOptimizations.table.trigger')}
                </TableHead>
                <TableHead>
                  {t('pages.assetOptimizations.table.samples')}
                </TableHead>
                <TableHead>
                  {t('pages.assetOptimizations.table.problems')}
                </TableHead>
                <TableHead>
                  {t('pages.assetOptimizations.table.status')}
                </TableHead>
                <TableHead>
                  {t('pages.assetOptimizations.table.createdAt')}
                </TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.assetOptimizations.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('pages.assetOptimizations.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow
                    key={run.uuid}
                    data-state={
                      selectedRunUUID === run.uuid ? 'selected' : undefined
                    }
                  >
                    <TableCell className="px-4 font-medium">
                      {run.agent.name}{' '}
                      <span className="text-muted-foreground">
                        v{run.agentVersion}
                      </span>
                    </TableCell>
                    <TableCell>
                      {t(`pages.assetOptimizations.trigger.${run.trigger}`)}
                    </TableCell>
                    <TableCell>{run.metrics.totalSamples}</TableCell>
                    <TableCell>{run.metrics.problemCount}</TableCell>
                    <TableCell>
                      <Badge variant={getRunStatusVariant(run.status)}>
                        {run.status === 'generating' ? (
                          <RefreshCwIcon className="animate-spin" />
                        ) : (
                          <HistoryIcon />
                        )}
                        {t(`pages.assetOptimizations.runStatus.${run.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(run.createdAt, locale)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRunUUID(run.uuid);
                          void loadRun(run.uuid).catch((error) =>
                            setErrorMessage(
                              getErrorMessage(
                                error,
                                t,
                                'pages.assetOptimizations.loadFailed'
                              )
                            )
                          );
                        }}
                      >
                        <EyeIcon />
                        {t('common.actions.view')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {selectedRun ? (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {selectedRun.agent.name} v{selectedRun.agentVersion}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('pages.assetOptimizations.metrics', {
                    samples: selectedRun.metrics.totalSamples,
                    success: selectedRun.metrics.successCount,
                    problems: selectedRun.metrics.problemCount,
                    retries: selectedRun.metrics.retryCount,
                    replay: selectedRun.metrics.replaySampleCount
                  })}
                </p>
              </div>
              <Badge variant={getRunStatusVariant(selectedRun.status)}>
                {t(`pages.assetOptimizations.runStatus.${selectedRun.status}`)}
              </Badge>
            </div>

            {selectedRun.errorMessage ? (
              <div className="mb-4 border-l-2 border-destructive px-3 text-sm text-destructive">
                {selectedRun.errorMessage}
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-3">
              {selectedRun.candidates.map((candidate) => (
                <article key={candidate.uuid} className="rounded-md border p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <CandidateTypeIcon type={candidate.type} />
                    <Badge variant="outline">
                      {t(
                        `pages.assetOptimizations.candidateType.${candidate.type}`
                      )}
                    </Badge>
                    <Badge
                      variant={getCandidateStatusVariant(candidate.status)}
                    >
                      {candidate.status === 'applying' ? (
                        <RefreshCwIcon className="animate-spin" />
                      ) : null}
                      {t(
                        `pages.assetOptimizations.candidateStatus.${candidate.status}`
                      )}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-medium">{candidate.title}</h4>
                  <p className="mt-2 min-h-10 text-sm text-muted-foreground">
                    {candidate.summary}
                  </p>
                  {candidate.replayScore ? (
                    <div className="mt-3 border-y py-3 text-xs">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {t('pages.assetOptimizations.replay.title')}
                        </span>
                        <Badge variant="outline">
                          {t('pages.assetOptimizations.replay.estimated')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 text-center">
                        <div>
                          <div className="font-medium">
                            {Math.round(
                              candidate.replayScore.estimatedPassRate * 100
                            )}
                            %
                          </div>
                          <div className="text-muted-foreground">
                            {t('pages.assetOptimizations.replay.passRate')}
                          </div>
                        </div>
                        <div className="border-x">
                          <div className="font-medium">
                            {candidate.replayScore.expectedAttempts.toFixed(1)}
                          </div>
                          <div className="text-muted-foreground">
                            {t('pages.assetOptimizations.replay.attempts')}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">
                            {candidate.replayScore.tokenChangePercent > 0
                              ? '+'
                              : ''}
                            {Math.round(
                              candidate.replayScore.tokenChangePercent
                            )}
                            %
                          </div>
                          <div className="text-muted-foreground">
                            {t('pages.assetOptimizations.replay.tokens')}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-muted-foreground">
                        {t('pages.assetOptimizations.replay.findings')}
                      </div>
                      <ul className="mt-1 space-y-1 pl-4 text-muted-foreground [list-style:disc]">
                        {candidate.replayScore.findings.map((finding) => (
                          <li key={finding}>{finding}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {candidate.conflictReason ? (
                    <p className="mt-3 text-xs text-destructive">
                      {candidate.conflictReason}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(candidate)}
                    >
                      <EyeIcon />
                      {t('common.actions.preview')}
                    </Button>
                    {selectedRun.status === 'ready' &&
                    ['draft', 'conflict'].includes(candidate.status) ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setScriptReviewConfirmed(false);
                            setPendingApply(candidate);
                          }}
                          disabled={mutatingCandidateUUID === candidate.uuid}
                        >
                          <CheckCircle2Icon />
                          {candidate.type === 'knowledge'
                            ? t('pages.assetOptimizations.review')
                            : t('pages.assetOptimizations.apply')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDismiss(candidate)}
                          disabled={mutatingCandidateUUID === candidate.uuid}
                        >
                          <XIcon />
                          {t('pages.assetOptimizations.dismiss')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {selectedRun.status === 'failed' &&
                  ['draft', 'conflict'].includes(candidate.status) ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t('pages.assetOptimizations.failedCandidateUnavailable')}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <Dialog
        open={Boolean(previewCandidate)}
        onOpenChange={(open) => !open && setPreviewCandidate(null)}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewCandidate?.title}</DialogTitle>
            <DialogDescription>{previewCandidate?.summary}</DialogDescription>
          </DialogHeader>
          {previewCandidate ? renderPreviewContent(previewCandidate) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingApply)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingApply(null);
            setScriptReviewConfirmed(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('pages.assetOptimizations.applyDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingApply?.type === 'skill' && pendingApply.hasScripts
                ? t('pages.assetOptimizations.applyDialog.scriptDescription')
                : pendingApply?.content.type === 'skill' &&
                    pendingApply.content.skillUUID === null
                  ? t(
                      'pages.assetOptimizations.applyDialog.newSkillDescription'
                    )
                  : pendingApply?.type === 'skill'
                    ? t('pages.assetOptimizations.applyDialog.skillDescription')
                    : pendingApply?.type === 'knowledge'
                      ? t(
                          'pages.assetOptimizations.applyDialog.knowledgeDescription'
                        )
                      : t('pages.assetOptimizations.applyDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingApply?.type === 'skill' && pendingApply.hasScripts ? (
            <label className="flex cursor-pointer items-start gap-3 border p-3 text-sm">
              <Checkbox
                checked={scriptReviewConfirmed}
                onCheckedChange={(checked) =>
                  setScriptReviewConfirmed(checked === true)
                }
              />
              <span>
                {t('pages.assetOptimizations.applyDialog.scriptReviewed')}
              </span>
            </label>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const candidate = pendingApply;
                setPendingApply(null);
                if (candidate) {
                  void mutateCandidate(
                    candidate,
                    'apply',
                    scriptReviewConfirmed
                  );
                }
              }}
              disabled={
                pendingApply?.type === 'skill' &&
                pendingApply.hasScripts &&
                !scriptReviewConfirmed
              }
            >
              {t('common.actions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDismiss)}
        onOpenChange={(open) => !open && setPendingDismiss(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('pages.assetOptimizations.dismissDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.assetOptimizations.dismissDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const candidate = pendingDismiss;
                setPendingDismiss(null);
                if (candidate) void mutateCandidate(candidate, 'dismiss');
              }}
            >
              {t('pages.assetOptimizations.dismiss')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
