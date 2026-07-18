import { useEffect, useMemo, useState } from 'react';
import type {
  AgentWorkspace,
  ApiError,
  ApiSuccess,
  WorkspaceVerificationProfile,
  WorkspaceVerificationStep
} from '@ones-ai-workflow/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { useHeaderActions } from '@/layouts/app-layout';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type ResourceResponse<T> = ApiSuccess<T> | ApiError;

type ProfileForm = {
  uuid: string | null;
  name: string;
  workspaceUUID: string;
  steps: WorkspaceVerificationStep[];
};

const EMPTY_FORM: ProfileForm = {
  uuid: null,
  name: '',
  workspaceUUID: '',
  steps: []
};

function createStep(repositoryUUID = ''): WorkspaceVerificationStep {
  return {
    uuid: crypto.randomUUID(),
    name: '',
    repositoryUUID,
    workingDirectory: '',
    executable: '',
    args: [],
    timeoutSeconds: 300
  };
}

export function WorkspaceVerificationProfilesPage() {
  const { t } = useTranslation();
  const { setTitle, setActions } = useHeaderActions();
  const [profiles, setProfiles] = useState<WorkspaceVerificationProfile[]>([]);
  const [workspaces, setWorkspaces] = useState<AgentWorkspace[]>([]);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingUUID, setDeletingUUID] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.uuid === form.workspaceUUID),
    [form.workspaceUUID, workspaces]
  );

  async function load() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [profilesResponse, workspacesResponse] = await Promise.all([
        fetch('/api/workspace-verification-profiles'),
        fetch('/api/agent-workspaces')
      ]);
      const [profilesPayload, workspacesPayload] = (await Promise.all([
        profilesResponse.json(),
        workspacesResponse.json()
      ])) as [
        ResourceResponse<WorkspaceVerificationProfile[]>,
        ResourceResponse<AgentWorkspace[]>
      ];
      if (!profilesResponse.ok || !profilesPayload.success) {
        throw new Error(
          profilesPayload.success
            ? t('pages.verificationProfiles.loadFailed')
            : getApiErrorMessage(
                profilesPayload,
                t,
                'pages.verificationProfiles.loadFailed'
              )
        );
      }
      if (!workspacesResponse.ok || !workspacesPayload.success) {
        throw new Error(t('pages.verificationProfiles.workspacesLoadFailed'));
      }
      setProfiles(profilesPayload.data);
      setWorkspaces(workspacesPayload.data);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.verificationProfiles.loadFailed')
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTitle(t('pages.verificationProfiles.title'));
    setActions(null);
    void load();
    return () => {
      setTitle(null);
      setActions(null);
    };
  }, [t]);

  function openCreate() {
    const workspace = workspaces[0];
    setForm({
      ...EMPTY_FORM,
      workspaceUUID: workspace?.uuid ?? '',
      steps: [createStep(workspace?.repositories[0]?.uuid ?? '')]
    });
    setOpen(true);
  }

  function openEdit(profile: WorkspaceVerificationProfile) {
    setForm({
      uuid: profile.uuid,
      name: profile.name,
      workspaceUUID: profile.workspaceUUID,
      steps: profile.steps.map((step) => ({ ...step, args: [...step.args] }))
    });
    setOpen(true);
  }

  function updateStep(
    uuid: string,
    patch: Partial<WorkspaceVerificationStep>
  ) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.uuid === uuid ? { ...step, ...patch } : step
      )
    }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.steps.length) return current;
      const steps = [...current.steps];
      const [step] = steps.splice(index, 1);
      if (step) steps.splice(target, 0, step);
      return { ...current, steps };
    });
  }

  async function save() {
    if (!form.name.trim() || !form.workspaceUUID || form.steps.length === 0) {
      toast.error(t('pages.verificationProfiles.validationRequired'));
      return;
    }
    if (
      form.steps.some(
        (step) =>
          !step.name.trim() ||
          !step.repositoryUUID ||
          !step.executable.trim()
      )
    ) {
      toast.error(t('pages.verificationProfiles.validationStepRequired'));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        form.uuid
          ? `/api/workspace-verification-profiles/${form.uuid}`
          : '/api/workspace-verification-profiles',
        {
          method: form.uuid ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            workspaceUUID: form.workspaceUUID,
            steps: form.steps
          })
        }
      );
      const payload = (await response.json()) as ResourceResponse<WorkspaceVerificationProfile>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.verificationProfiles.saveFailed')
            : getApiErrorMessage(payload, t, 'pages.verificationProfiles.saveFailed')
        );
      }
      setOpen(false);
      toast.success(t('pages.verificationProfiles.saveSuccess'));
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.verificationProfiles.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(profile: WorkspaceVerificationProfile) {
    if (!window.confirm(t('pages.verificationProfiles.deleteConfirm', { name: profile.name }))) {
      return;
    }
    setDeletingUUID(profile.uuid);
    try {
      const response = await fetch(`/api/workspace-verification-profiles/${profile.uuid}`, {
        method: 'DELETE'
      });
      const payload = (await response.json()) as ResourceResponse<{ uuid: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.verificationProfiles.deleteFailed')
            : getApiErrorMessage(payload, t, 'pages.verificationProfiles.deleteFailed')
        );
      }
      toast.success(t('pages.verificationProfiles.deleteSuccess'));
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.verificationProfiles.deleteFailed'));
    } finally {
      setDeletingUUID(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('pages.verificationProfiles.description')}
        </p>
        <Button onClick={openCreate} disabled={loading || workspaces.length === 0}>
          <PlusIcon />
          {t('pages.verificationProfiles.create')}
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="px-4">{t('pages.verificationProfiles.name')}</TableHead>
              <TableHead>{t('pages.verificationProfiles.workspace')}</TableHead>
              <TableHead>{t('pages.verificationProfiles.steps')}</TableHead>
              <TableHead className="pr-4 text-right">{t('pages.verificationProfiles.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center">{t('common.states.loading')}</TableCell></TableRow>
            ) : errorMessage ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-destructive">{errorMessage}</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{t('pages.verificationProfiles.empty')}</TableCell></TableRow>
            ) : profiles.map((profile) => (
              <TableRow key={profile.uuid}>
                <TableCell className="px-4 font-medium">{profile.name}</TableCell>
                <TableCell>{profile.workspaceName}</TableCell>
                <TableCell>{profile.steps.length}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(profile)}><PencilIcon />{t('common.actions.edit')}</Button>
                    <Button variant="outline" size="sm" disabled={deletingUUID === profile.uuid} onClick={() => void remove(profile)}><Trash2Icon />{t('common.actions.delete')}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.uuid ? t('pages.verificationProfiles.editTitle') : t('pages.verificationProfiles.createTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm"><span>{t('pages.verificationProfiles.name')}</span><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="space-y-2 text-sm"><span>{t('pages.verificationProfiles.workspace')}</span><SearchSelect options={workspaces.map((workspace) => ({ value: workspace.uuid, label: workspace.name }))} value={form.workspaceUUID || undefined} onValueChange={(value) => setForm((current) => ({ ...current, workspaceUUID: value ?? '', steps: current.steps.map((step) => ({ ...step, repositoryUUID: '' })) }))} /></label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{t('pages.verificationProfiles.steps')}</h3><Button type="button" variant="outline" size="sm" disabled={form.steps.length >= 10} onClick={() => setForm((current) => ({ ...current, steps: [...current.steps, createStep(selectedWorkspace?.repositories[0]?.uuid ?? '')] }))}><PlusIcon />{t('pages.verificationProfiles.addStep')}</Button></div>
            <div className="divide-y border-y">
              {form.steps.map((step, index) => (
                <div key={step.uuid} className="space-y-3 px-2 py-4">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-sm text-muted-foreground">{index + 1}</span>
                    <Input className="max-w-64" value={step.name} placeholder={t('pages.verificationProfiles.stepName')} onChange={(event) => updateStep(step.uuid, { name: event.target.value })} />
                    <div className="ml-auto flex gap-1">
                      <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUpIcon /></Button>
                      <Button type="button" variant="ghost" size="icon" disabled={index === form.steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDownIcon /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setForm((current) => ({ ...current, steps: current.steps.filter((item) => item.uuid !== step.uuid) }))}><Trash2Icon /></Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm"><span>{t('pages.verificationProfiles.repository')}</span><SearchSelect options={(selectedWorkspace?.repositories ?? []).map((repository) => ({ value: repository.uuid, label: repository.url }))} value={step.repositoryUUID || undefined} onValueChange={(value) => updateStep(step.uuid, { repositoryUUID: value ?? '' })} /></label>
                    <label className="space-y-1 text-sm"><span>{t('pages.verificationProfiles.workingDirectory')}</span><Input value={step.workingDirectory} placeholder="packages/server" onChange={(event) => updateStep(step.uuid, { workingDirectory: event.target.value })} /></label>
                    <label className="space-y-1 text-sm"><span>{t('pages.verificationProfiles.executable')}</span><Input value={step.executable} placeholder="pnpm" onChange={(event) => updateStep(step.uuid, { executable: event.target.value })} /></label>
                    <label className="space-y-1 text-sm"><span>{t('pages.verificationProfiles.timeout')}</span><Input type="number" min={1} max={1800} value={step.timeoutSeconds} onChange={(event) => updateStep(step.uuid, { timeoutSeconds: Number(event.target.value) || 1 })} /></label>
                    <label className="space-y-1 text-sm md:col-span-2"><span>{t('pages.verificationProfiles.args')}</span><Textarea className="min-h-20 font-mono" value={step.args.join('\n')} placeholder={'--filter\n@ones-ai-workflow/server\ntest'} onChange={(event) => updateStep(step.uuid, { args: event.target.value.split('\n').filter((value) => value.length > 0) })} /></label>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t('common.actions.cancel')}</Button><Button onClick={() => void save()} disabled={saving}>{saving ? t('common.states.saving') : t('common.actions.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
