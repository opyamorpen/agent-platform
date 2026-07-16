import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiError,
  ApiSuccess,
  SkillGenerationFile,
  SkillGenerationSession,
  SkillSummary
} from '@ones-ai-workflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { streamPost } from '@/lib/sse';
import {
  ArrowLeftIcon,
  BotIcon,
  FileCode2Icon,
  FileTextIcon,
  FilesIcon,
  MessageSquareIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
  XIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

type SessionResponse = ApiSuccess<SkillGenerationSession> | ApiError;
type PublishResponse = ApiSuccess<SkillSummary> | ApiError;

export function SkillCreatorPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [session, setSession] = useState<SkillGenerationSession | null>(null);
  const [files, setFiles] = useState<SkillGenerationFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isStreamingRequest, setIsStreamingRequest] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [scriptReviewed, setScriptReviewed] = useState(false);
  const [mobilePane, setMobilePane] = useState<'chat' | 'files'>('chat');
  const activeRequestAbortRef = useRef<AbortController | null>(null);

  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;
  const hasScripts = useMemo(() => files.some(isScriptFile), [files]);

  const applySession = useCallback((next: SkillGenerationSession) => {
    setSession(next);
    setFiles(next.files);
    setSelectedPath((current) =>
      next.files.some((file) => file.path === current)
        ? current
        : (next.files[0]?.path ?? null)
    );
    setIsDirty(false);
    setScriptReviewed(false);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/skill-generation-sessions/${uuid}`);
      const payload = (await response.json()) as SessionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skillCreator.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.skillCreator.loadFailed')
        );
      }
      applySession(payload.data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.skillCreator.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  }, [applySession, t, uuid]);

  useEffect(() => {
    if (!uuid) {
      setErrorMessage(t('pages.skillCreator.missingUuid'));
      setIsLoading(false);
      return;
    }
    void loadSession();
  }, [loadSession, t, uuid]);

  async function sendMessage() {
    const content = message.trim();
    if (!content || !session || isBusy) return;

    setIsBusy(true);
    setIsStreamingRequest(true);
    setMessage('');
    setStreamingText('');
    setErrorMessage(null);
    const abortController = new AbortController();
    activeRequestAbortRef.current = abortController;
    try {
      await streamPost(
        `/api/skill-generation-sessions/${session.uuid}/messages/stream`,
        { message: content },
        ({ event, data }) => {
          if (event === 'stage') setStage((data as { stage: string }).stage);
          if (event === 'text_delta')
            setStreamingText(
              (current) => current + (data as { delta: string }).delta
            );
          if (event === 'done')
            applySession((data as { session: SkillGenerationSession }).session);
        },
        abortController.signal
      );
    } catch (error) {
      if (!abortController.signal.aborted) {
        setErrorMessage(
          getErrorMessage(error, t, 'pages.skillCreator.messageFailed')
        );
      }
      await loadSession();
    } finally {
      if (activeRequestAbortRef.current === abortController) {
        activeRequestAbortRef.current = null;
      }
      setIsBusy(false);
      setIsStreamingRequest(false);
      setStreamingText('');
      setStage(null);
    }
  }

  async function generateFiles() {
    if (!session || isBusy) return;
    setIsBusy(true);
    setIsStreamingRequest(true);
    setErrorMessage(null);
    setMobilePane('files');
    const abortController = new AbortController();
    activeRequestAbortRef.current = abortController;
    try {
      await streamPost(
        `/api/skill-generation-sessions/${session.uuid}/generate/stream`,
        { expectedRevision: session.revision },
        ({ event, data }) => {
          if (event === 'stage') setStage((data as { stage: string }).stage);
          if (event === 'draft_ready' || event === 'done') {
            applySession((data as { session: SkillGenerationSession }).session);
          }
        },
        abortController.signal
      );
      toast.success(t('pages.skillCreator.generateSuccess'));
    } catch (error) {
      if (!abortController.signal.aborted) {
        setErrorMessage(
          getErrorMessage(error, t, 'pages.skillCreator.generateFailed')
        );
      }
      await loadSession();
    } finally {
      if (activeRequestAbortRef.current === abortController) {
        activeRequestAbortRef.current = null;
      }
      setIsBusy(false);
      setIsStreamingRequest(false);
      setStage(null);
    }
  }

  async function saveFiles(): Promise<SkillGenerationSession | null> {
    if (!session || !isDirty) return session;
    const response = await fetch(
      `/api/skill-generation-sessions/${session.uuid}/draft`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: session.revision, files })
      }
    );
    const payload = (await response.json()) as SessionResponse;
    if (!response.ok || !payload.success) {
      throw new Error(
        payload.success
          ? t('pages.skillCreator.saveFailed')
          : getApiErrorMessage(payload, t, 'pages.skillCreator.saveFailed')
      );
    }
    applySession(payload.data);
    toast.success(t('pages.skillCreator.saveSuccess'));
    return payload.data;
  }

  async function publish() {
    if (!session || isBusy) return;
    try {
      setIsBusy(true);
      setErrorMessage(null);
      const current = (await saveFiles()) ?? session;
      const response = await fetch(
        `/api/skill-generation-sessions/${session.uuid}/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: current.revision,
            scriptReviewed
          })
        }
      );
      const payload = (await response.json()) as PublishResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skillCreator.publishFailed')
            : getApiErrorMessage(payload, t, 'pages.skillCreator.publishFailed')
        );
      }
      toast.success(
        t('pages.skillCreator.publishSuccess', { name: payload.data.name })
      );
      navigate('/settings/skills');
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.skillCreator.publishFailed')
      );
    } finally {
      setIsBusy(false);
    }
  }

  function updateSelectedFile(content: string) {
    if (!selectedPath) return;
    setFiles((current) =>
      current.map((file) =>
        file.path === selectedPath ? { ...file, content } : file
      )
    );
    setIsDirty(true);
    setScriptReviewed(false);
  }

  function cancelActiveRequest() {
    activeRequestAbortRef.current?.abort();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings/skills')}
            title={t('common.actions.back')}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {session?.title ?? t('pages.skillCreator.title')}
            </div>
            <div className="text-xs text-muted-foreground">
              {stage
                ? t(`pages.skillCreator.stages.${stage}`)
                : session
                  ? t(`pages.skillCreator.status.${session.status}`)
                  : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStreamingRequest ? (
            <Button variant="outline" onClick={cancelActiveRequest}>
              <XIcon />
              {t('common.actions.cancel')}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() =>
              void saveFiles().catch((error) =>
                setErrorMessage(
                  getErrorMessage(error, t, 'pages.skillCreator.saveFailed')
                )
              )
            }
            disabled={!isDirty || isBusy}
          >
            <SaveIcon />
            {t('pages.skillCreator.actions.save')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void generateFiles()}
            disabled={!session || isBusy || session.messages.length === 0}
          >
            <SparklesIcon />
            {files.length > 0
              ? t('pages.skillCreator.actions.regenerate')
              : t('pages.skillCreator.actions.generate')}
          </Button>
          <Button
            onClick={() => void publish()}
            disabled={
              !session ||
              files.length === 0 ||
              isBusy ||
              (hasScripts && !scriptReviewed)
            }
          >
            <BotIcon />
            {t('pages.skillCreator.actions.publish')}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b p-2 md:hidden">
        <Button
          size="sm"
          variant={mobilePane === 'chat' ? 'secondary' : 'ghost'}
          onClick={() => setMobilePane('chat')}
          className="flex-1"
        >
          <MessageSquareIcon />
          {t('pages.skillCreator.chat')}
        </Button>
        <Button
          size="sm"
          variant={mobilePane === 'files' ? 'secondary' : 'ghost'}
          onClick={() => setMobilePane('files')}
          className="flex-1"
        >
          <FilesIcon />
          {t('pages.skillCreator.files')}
        </Button>
      </div>

      {errorMessage ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(320px,0.85fr)_minmax(480px,1.15fr)]">
        <section
          className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} min-h-0 flex-col border-r md:flex`}
        >
          <div className="flex-1 space-y-4 overflow-auto p-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t('common.states.loading')}
              </p>
            ) : null}
            {session?.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('pages.skillCreator.emptyChat')}
              </p>
            ) : null}
            {session?.messages.map((item) => (
              <div
                key={item.uuid}
                className={
                  item.role === 'user'
                    ? 'ml-8 border-l-2 border-primary pl-3'
                    : 'mr-8 border-l-2 border-muted-foreground/30 pl-3'
                }
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {item.role === 'user'
                    ? t('pages.skillCreator.you')
                    : t('pages.skillCreator.assistant')}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-6">
                  {item.content}
                </div>
                {item.status === 'interrupted' ? (
                  <Badge variant="outline" className="mt-2">
                    {t('pages.skillCreator.interrupted')}
                  </Badge>
                ) : null}
              </div>
            ))}
            {streamingText ? (
              <div className="mr-8 border-l-2 border-primary/40 pl-3 whitespace-pre-wrap text-sm leading-6">
                {streamingText}
              </div>
            ) : null}
          </div>
          <div className="border-t p-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('pages.skillCreator.messagePlaceholder')}
              disabled={isBusy || !session}
              className="min-h-24 resize-none"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => void sendMessage()}
                disabled={!message.trim() || isBusy || !session}
              >
                <SendIcon />
                {t('pages.skillCreator.actions.send')}
              </Button>
            </div>
          </div>
        </section>

        <section
          className={`${mobilePane === 'files' ? 'grid' : 'hidden'} min-h-0 grid-cols-[180px_minmax(0,1fr)] md:grid`}
        >
          <div className="overflow-auto border-r bg-muted/20 p-2">
            {files.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                {t('pages.skillCreator.emptyFiles')}
              </p>
            ) : (
              files.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`flex w-full items-center gap-2 px-2 py-2 text-left text-xs ${selectedPath === file.path ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                >
                  {isScriptFile(file) ? (
                    <FileCode2Icon className="size-4 shrink-0" />
                  ) : (
                    <FileTextIcon className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 break-all">{file.path}</span>
                </button>
              ))
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex h-10 items-center justify-between border-b px-3 text-xs">
              <span className="truncate font-medium">
                {selectedFile?.path ?? t('pages.skillCreator.noFileSelected')}
              </span>
              {isDirty ? (
                <Badge variant="outline">
                  {t('pages.skillCreator.unsaved')}
                </Badge>
              ) : null}
            </div>
            {selectedFile ? (
              <Textarea
                value={selectedFile.content}
                onChange={(event) => updateSelectedFile(event.target.value)}
                className="min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs leading-5 focus-visible:ring-0"
                spellCheck={false}
                disabled={isBusy}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t('pages.skillCreator.emptyFiles')}
              </div>
            )}
            {hasScripts ? (
              <label className="flex items-center gap-2 border-t px-3 py-3 text-sm">
                <Checkbox
                  checked={scriptReviewed}
                  onCheckedChange={(checked) =>
                    setScriptReviewed(Boolean(checked))
                  }
                />
                {t('pages.skillCreator.scriptReview')}
              </label>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function isScriptFile(file: SkillGenerationFile): boolean {
  return (
    /\.(?:sh|bash|zsh|ps1|py|js|mjs|cjs|ts|rb|pl|php|go|rs|java|kt|kts|lua)$/i.test(
      file.path
    ) || file.content.startsWith('#!')
  );
}
