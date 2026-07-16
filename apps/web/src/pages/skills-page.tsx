import { useEffect, useRef, useState } from 'react';
import type {
  AIModelConfigStatus,
  ApiError,
  ApiSuccess,
  SkillGenerationSession,
  SkillGenerationSessionSummary,
  SkillSummary
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Field as FormField,
  FieldContent,
  FieldError,
  FieldLabel
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import {
  DownloadIcon,
  HistoryIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type SkillsResponse = ApiSuccess<SkillSummary[]> | ApiError;
type SkillResponse = ApiSuccess<SkillSummary> | ApiError;
type DeleteSkillResponse = ApiSuccess<true> | ApiError;
type SkillDownloadUrlResponse = ApiSuccess<{
  fileName: string;
  downloadUrl: string;
}> | ApiError;
type AIModelStatusResponse = ApiSuccess<AIModelConfigStatus> | ApiError;
type GenerationSessionsResponse = ApiSuccess<SkillGenerationSessionSummary[]> | ApiError;
type GenerationSessionResponse = ApiSuccess<SkillGenerationSession> | ApiError;

type FormErrors = {
  files?: string;
  submit?: string;
};

export function SkillsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [createErrors, setCreateErrors] = useState<FormErrors>({});
  const [uploadErrors, setUploadErrors] = useState<FormErrors>({});
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingSkill, setUploadingSkill] = useState<SkillSummary | null>(null);
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<SkillSummary | null>(null);
  const [deletingSkillUUID, setDeletingSkillUUID] = useState<string | null>(null);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [generationSessions, setGenerationSessions] = useState<SkillGenerationSessionSummary[]>([]);
  const [isCreatingAISkill, setIsCreatingAISkill] = useState(false);

  useEffect(() => {
    void loadSkills();
    void loadAIAuthoringState();
  }, []);

  async function loadAIAuthoringState() {
    try {
      const [statusResponse, sessionsResponse] = await Promise.all([
        fetch('/api/ai-model-config/status'),
        fetch('/api/skill-generation-sessions')
      ]);
      const statusPayload = (await statusResponse.json()) as AIModelStatusResponse;
      const sessionsPayload = (await sessionsResponse.json()) as GenerationSessionsResponse;
      setIsAIConfigured(statusResponse.ok && statusPayload.success && statusPayload.data.configured);
      setGenerationSessions(
        sessionsResponse.ok && sessionsPayload.success
          ? sessionsPayload.data.filter((session) => session.status !== 'published')
          : []
      );
    } catch {
      setIsAIConfigured(false);
      setGenerationSessions([]);
    }
  }

  async function handleCreateAISkill() {
    try {
      setIsCreatingAISkill(true);
      const response = await fetch('/api/skill-generation-sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as GenerationSessionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? t('pages.skills.ai.createFailed') : getApiErrorMessage(payload, t, 'pages.skills.ai.createFailed'));
      }
      navigate(`/settings/skills/create/${payload.data.uuid}`);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.skills.ai.createFailed'));
    } finally {
      setIsCreatingAISkill(false);
    }
  }

  async function loadSkills() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/skills');
      const payload = (await response.json()) as SkillsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skills.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.skills.loadFailed')
        );
      }

      setSkills(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.skills.loadFailed'));
      setSkills([]);
    } finally {
      setIsLoading(false);
    }
  }

  function sortSkillsByUpdatedAt(items: SkillSummary[]): SkillSummary[] {
    return [...items].sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();

      return rightTime - leftTime;
    });
  }

  function upsertSkill(nextSkill: SkillSummary) {
    setSkills((currentSkills) =>
      sortSkillsByUpdatedAt([
        nextSkill,
        ...currentSkills.filter((skill) => skill.uuid !== nextSkill.uuid)
      ])
    );
  }

  function resetCreateForm() {
    setCreateFiles([]);
    setCreateErrors({});

    if (createInputRef.current) {
      createInputRef.current.value = '';
    }
  }

  function resetUploadForm() {
    setUploadFiles([]);
    setUploadErrors({});
    setUploadingSkill(null);

    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }

  function validateFiles(files: File[]): FormErrors {
    const nextErrors: FormErrors = {};

    if (files.length === 0) {
      nextErrors.files = t('pages.skills.validation.filesRequired');
    }

    return nextErrors;
  }

  function setDirectoryInputAttributes(input: HTMLInputElement | null) {
    if (!input) {
      return;
    }

    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }

  async function handleCreateSkill() {
    const nextErrors = validateFiles(createFiles);

    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      return;
    }

    const formData = new FormData();

    for (const file of createFiles) {
      const relativePath = getRelativePath(file);
      formData.append('files', file);
      formData.append('paths', relativePath);
    }

    try {
      setIsSubmitting(true);
      setCreateErrors({});

      const response = await fetch('/api/skills', {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as SkillResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skills.uploadFailed')
            : getApiErrorMessage(payload, t, 'pages.skills.uploadFailed')
        );
      }

      upsertSkill(payload.data);
      setIsCreateDialogOpen(false);
      resetCreateForm();
      toast.success(t('pages.skills.uploadSuccess'));
    } catch (error) {
      const message = getErrorMessage(error, t, 'pages.skills.uploadFailed');
      setCreateErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadVersion() {
    if (!uploadingSkill) {
      return;
    }

    const nextErrors = validateFiles(uploadFiles);

    if (Object.keys(nextErrors).length > 0) {
      setUploadErrors(nextErrors);
      return;
    }

    const formData = new FormData();

    for (const file of uploadFiles) {
      const relativePath = getRelativePath(file);
      formData.append('files', file);
      formData.append('paths', relativePath);
    }

    try {
      setIsSubmitting(true);
      setUploadErrors({});

      const response = await fetch(`/api/skills/${uploadingSkill.uuid}/versions`, {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as SkillResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skills.uploadVersionFailed')
            : getApiErrorMessage(payload, t, 'pages.skills.uploadVersionFailed')
        );
      }

      upsertSkill(payload.data);
      setIsUploadDialogOpen(false);
      resetUploadForm();
      toast.success(t('pages.skills.uploadVersionSuccess'));
    } catch (error) {
      const message = getErrorMessage(error, t, 'pages.skills.uploadVersionFailed');
      setUploadErrors({
        submit: message
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDownloadSkill(skill: SkillSummary) {
    try {
      const response = await fetch(`/api/skills/${skill.uuid}/download-url`);
      const payload = (await response.json()) as SkillDownloadUrlResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skills.downloadFailed')
            : getApiErrorMessage(payload, t, 'pages.skills.downloadFailed')
        );
      }

      const link = document.createElement('a');
      link.href = payload.data.downloadUrl;
      link.download = payload.data.fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.skills.downloadFailed'));
    }
  }

  async function handleDeleteSkill() {
    if (!pendingDeleteSkill) {
      return;
    }

    try {
      setDeletingSkillUUID(pendingDeleteSkill.uuid);

      const response = await fetch(`/api/skills/${pendingDeleteSkill.uuid}`, {
        method: 'DELETE'
      });
      const payload = (await response.json()) as DeleteSkillResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.skills.deleteFailed')
            : getApiErrorMessage(payload, t, 'pages.skills.deleteFailed')
        );
      }

      setSkills((currentSkills) =>
        currentSkills.filter((skill) => skill.uuid !== pendingDeleteSkill.uuid)
      );
      toast.success(
        t('pages.skills.deleteSuccess', { name: pendingDeleteSkill.name })
      );
      setPendingDeleteSkill(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.skills.deleteFailed'));
    } finally {
      setDeletingSkillUUID(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex flex-wrap items-center justify-start gap-2">
          <Button
            size="sm"
            onClick={() => {
              resetCreateForm();
              setIsCreateDialogOpen(true);
            }}
          >
            <PlusIcon />
            {t('pages.skills.actions.upload')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleCreateAISkill()}
            disabled={!isAIConfigured || isCreatingAISkill}
            title={!isAIConfigured ? t('pages.skills.ai.notConfigured') : undefined}
          >
            <SparklesIcon />
            {isCreatingAISkill ? t('pages.skills.ai.creating') : t('pages.skills.ai.create')}
          </Button>
        </div>
        {generationSessions.length > 0 ? (
          <section className="border-y bg-muted/20 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <HistoryIcon className="size-4" />
              {t('pages.skills.ai.drafts')}
            </div>
            <div className="flex flex-wrap gap-2">
              {generationSessions.map((session) => (
                <Button key={session.uuid} size="sm" variant="ghost" onClick={() => navigate(`/settings/skills/create/${session.uuid}`)}>
                  <span className="max-w-52 truncate">{session.title}</span>
                  <span className="text-xs text-muted-foreground">{t(`pages.skillCreator.status.${session.status}`)}</span>
                </Button>
              ))}
            </div>
          </section>
        ) : null}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="px-4">{t('pages.skills.table.name')}</TableHead>
                <TableHead>{t('pages.skills.table.description')}</TableHead>
                <TableHead>{t('pages.skills.table.currentVersion')}</TableHead>
                <TableHead>{t('pages.skills.table.updatedAt')}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.skills.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 px-4 text-center text-destructive"
                  >
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : skills.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.skills.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                skills.map((skill) => (
                  <TableRow key={skill.uuid}>
                    <TableCell className="px-4 font-medium">{skill.name}</TableCell>
                    <TableCell className="max-w-xl whitespace-pre-wrap text-sm text-muted-foreground">
                      {skill.description || t('common.fallback.emptyValue')}
                    </TableCell>
                    <TableCell>v{skill.currentVersion}</TableCell>
                    <TableCell>{formatDateTime(skill.updatedAt, locale)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadSkill(skill)}
                        >
                          <DownloadIcon />
                          {t('pages.skills.actions.download')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUploadingSkill(skill);
                            setUploadErrors({});
                            setUploadFiles([]);
                            setIsUploadDialogOpen(true);
                          }}
                        >
                          <UploadIcon />
                          {t('pages.skills.actions.uploadVersion')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPendingDeleteSkill(skill);
                          }}
                        >
                          <Trash2Icon />
                          {t('pages.skills.actions.delete')}
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

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);

          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.skills.dialog.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('pages.skills.dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField>
              <FieldLabel htmlFor="skill-create-files">
                {t('pages.skills.dialog.directoryLabel')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="skill-create-files"
                  ref={(element) => {
                    createInputRef.current = element;
                    setDirectoryInputAttributes(element);
                  }}
                  type="file"
                  multiple
                  onChange={(event) => {
                    setCreateFiles(Array.from(event.target.files ?? []));
                  }}
                />
              </FieldContent>
              <p className="text-sm text-muted-foreground">
                {t('pages.skills.dialog.selectedFiles', {
                  count: createFiles.length
                })}
              </p>
              {createErrors.files ? <FieldError>{createErrors.files}</FieldError> : null}
            </FormField>
            {createErrors.submit ? <FieldError>{createErrors.submit}</FieldError> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetCreateForm();
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleCreateSkill()} disabled={isSubmitting}>
              {t('pages.skills.actions.startUpload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isUploadDialogOpen}
        onOpenChange={(open) => {
          setIsUploadDialogOpen(open);

          if (!open) {
            resetUploadForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.skills.dialog.uploadTitle')}</DialogTitle>
            <DialogDescription>
              {uploadingSkill
                ? t('pages.skills.dialog.uploadDescriptionWithName', {
                    name: uploadingSkill.name
                  })
                : t('pages.skills.dialog.uploadDescriptionFallback')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField>
              <FieldLabel htmlFor="skill-upload-files">
                {t('pages.skills.dialog.directoryLabel')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="skill-upload-files"
                  ref={(element) => {
                    uploadInputRef.current = element;
                    setDirectoryInputAttributes(element);
                  }}
                  type="file"
                  multiple
                  onChange={(event) => {
                    setUploadFiles(Array.from(event.target.files ?? []));
                  }}
                />
              </FieldContent>
              <p className="text-sm text-muted-foreground">
                {t('pages.skills.dialog.selectedFiles', {
                  count: uploadFiles.length
                })}
              </p>
              {uploadErrors.files ? <FieldError>{uploadErrors.files}</FieldError> : null}
            </FormField>
            {uploadErrors.submit ? <FieldError>{uploadErrors.submit}</FieldError> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                resetUploadForm();
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleUploadVersion()} disabled={isSubmitting}>
              {t('pages.skills.actions.confirmUpload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteSkill !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteSkill(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.skills.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSkill
                ? t('pages.skills.deleteDialog.descriptionWithName', {
                    name: pendingDeleteSkill.name
                  })
                : t('pages.skills.deleteDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSkillUUID !== null}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSkill();
              }}
              disabled={deletingSkillUUID !== null}
            >
              {deletingSkillUUID !== null
                ? t('common.states.deleting')
                : t('pages.skills.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getRelativePath(file: File): string {
  const relativePath = (
    file as File & {
      webkitRelativePath?: string;
    }
  ).webkitRelativePath;

  return relativePath && relativePath.trim() ? relativePath : file.name;
}
