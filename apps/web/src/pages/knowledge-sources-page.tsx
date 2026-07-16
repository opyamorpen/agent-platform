import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ApiError,
  ApiSuccess,
  KnowledgeSource,
  WikiSpaceSummary
} from '@ones-ai-workflow/shared';
import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTeamContext } from '@/layouts/app-layout';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

type ListResponse = ApiSuccess<KnowledgeSource[]> | ApiError;
type MutationResponse = ApiSuccess<KnowledgeSource> | ApiError;
type WikiSpacesResponse = ApiSuccess<WikiSpaceSummary[]> | ApiError;

type FormState = {
  uuid: string | null;
  name: string;
  description: string;
  spaceUUID: string;
  status: 'active' | 'disabled';
};

const EMPTY_FORM: FormState = {
  uuid: null,
  name: '',
  description: '',
  spaceUUID: '',
  status: 'active'
};

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

export function KnowledgeSourcesPage() {
  const { t } = useTranslation();
  const { isAdmin } = useTeamContext();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [spaces, setSpaces] = useState<WikiSpaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSource | null>(
    null
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [sourcesResponse, spacesResponse] = await Promise.all([
        fetch('/api/knowledge-sources'),
        isAdmin ? fetch('/api/ones/wiki/spaces') : Promise.resolve(null)
      ]);
      const payload = (await sourcesResponse.json()) as ListResponse;
      if (!sourcesResponse.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.knowledgeSources.loadFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.knowledgeSources.loadFailed'
              )
        );
      }
      setSources(payload.data);

      if (spacesResponse) {
        const spacesPayload =
          (await spacesResponse.json()) as WikiSpacesResponse;
        if (!spacesResponse.ok || !spacesPayload.success) {
          throw new Error(
            spacesPayload.success
              ? t('pages.knowledgeSources.spacesLoadFailed')
              : getApiErrorMessage(
                  spacesPayload,
                  t,
                  'pages.knowledgeSources.spacesLoadFailed'
                )
          );
        }
        setSpaces(spacesPayload.data);
      }
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.knowledgeSources.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const spaceOptions = useMemo(
    () =>
      spaces.map((space) => ({
        value: space.uuid,
        label: space.name,
        keywords: [space.description].filter(Boolean)
      })),
    [spaces]
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function openEdit(source: KnowledgeSource) {
    setForm({
      uuid: source.uuid,
      name: source.name,
      description: source.description,
      spaceUUID: source.spaceUUID,
      status: source.status === 'disabled' ? 'disabled' : 'active'
    });
    setIsFormOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.spaceUUID) {
      toast.error(t('pages.knowledgeSources.form.required'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        form.uuid
          ? `/api/knowledge-sources/${form.uuid}`
          : '/api/knowledge-sources',
        {
          method: form.uuid ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            spaceUUID: form.spaceUUID,
            status: form.status
          })
        }
      );
      const payload = (await response.json()) as MutationResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.knowledgeSources.saveFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.knowledgeSources.saveFailed'
              )
        );
      }
      toast.success(t('pages.knowledgeSources.saveSuccess'));
      setIsFormOpen(false);
      await load();
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.knowledgeSources.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/knowledge-sources/${deleteTarget.uuid}`,
        {
          method: 'DELETE'
        }
      );
      const payload = (await response.json()) as ApiSuccess<unknown> | ApiError;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.knowledgeSources.deleteFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.knowledgeSources.deleteFailed'
              )
        );
      }
      toast.success(t('pages.knowledgeSources.deleteSuccess'));
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(
        getErrorMessage(error, t, 'pages.knowledgeSources.deleteFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={isLoading}
        >
          <RefreshCwIcon />
          {t('common.actions.refresh')}
        </Button>
        {isAdmin ? (
          <Button onClick={openCreate}>
            <PlusIcon />
            {t('pages.knowledgeSources.actions.create')}
          </Button>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto border">
        <Table className="min-w-[880px] table-fixed">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-[28%]">
                {t('pages.knowledgeSources.table.name')}
              </TableHead>
              <TableHead className="w-[16%]">
                {t('pages.knowledgeSources.table.space')}
              </TableHead>
              <TableHead className="w-[10%]">
                {t('pages.knowledgeSources.table.status')}
              </TableHead>
              <TableHead className="w-[18%]">
                {t('pages.knowledgeSources.table.lastSuccess')}
              </TableHead>
              <TableHead className="w-[20%]">
                {t('pages.knowledgeSources.table.lastError')}
              </TableHead>
              {isAdmin ? (
                <TableHead className="w-[8%] text-right">
                  {t('pages.knowledgeSources.table.actions')}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && sources.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="h-28 text-center text-muted-foreground"
                >
                  {t('pages.knowledgeSources.empty')}
                </TableCell>
              </TableRow>
            ) : (
              sources.map((source) => (
                <TableRow key={source.uuid}>
                  <TableCell>
                    <div className="font-medium">{source.name}</div>
                    <div className="mt-1 max-w-md text-xs text-muted-foreground">
                      {source.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{source.spaceName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        source.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {t(`pages.knowledgeSources.status.${source.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatTime(source.lastSuccessfulQueryAt)}
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate"
                    title={source.lastError ?? undefined}
                  >
                    {source.lastError || '-'}
                  </TableCell>
                  {isAdmin ? (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(source)}
                          title={t('pages.knowledgeSources.actions.edit')}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(source)}
                          title={t('pages.knowledgeSources.actions.delete')}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.uuid
                ? t('pages.knowledgeSources.form.editTitle')
                : t('pages.knowledgeSources.form.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.knowledgeSources.form.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="knowledge-name">
                {t('pages.knowledgeSources.form.name')}
              </Label>
              <Input
                id="knowledge-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pages.knowledgeSources.form.space')}</Label>
              <SearchSelect
                options={spaceOptions}
                value={form.spaceUUID || undefined}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, spaceUUID: value ?? '' }))
                }
                placeholder={t('pages.knowledgeSources.form.spacePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge-description">
                {t('pages.knowledgeSources.form.detail')}
              </Label>
              <Textarea
                id="knowledge-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pages.knowledgeSources.form.status')}</Label>
              <SearchSelect
                options={[
                  {
                    value: 'active',
                    label: t('pages.knowledgeSources.status.active')
                  },
                  {
                    value: 'disabled',
                    label: t('pages.knowledgeSources.status.disabled')
                  }
                ]}
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value === 'disabled' ? 'disabled' : 'active'
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={isSaving}>
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('pages.knowledgeSources.deleteDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.knowledgeSources.deleteDialog.description', {
                name: deleteTarget?.name ?? ''
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              disabled={isSaving}
            >
              {t('common.actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
