import { useEffect, useMemo, useState } from 'react';
import type { ApiError, ApiSuccess, ModelProfile } from '@ones-ai-workflow/shared';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import {
  Field as FormField,
  FieldContent,
  FieldError,
  FieldLabel
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type ModelProfilesResponse = ApiSuccess<ModelProfile[]> | ApiError;
type ModelProfileResponse = ApiSuccess<ModelProfile> | ApiError;
type DeleteResponse = ApiSuccess<boolean> | ApiError;

type ModelProfileFormState = {
  uuid: string | null;
  name: string;
  provider: string;
  model: string;
  baseURL: string;
  apiKeySecretName: string;
  reasoningEffort: string;
  temperature: string;
  isDefault: boolean;
};

const EMPTY_FORM: ModelProfileFormState = {
  uuid: null,
  name: '',
  provider: 'openai-compatible',
  model: '',
  baseURL: '',
  apiKeySecretName: '',
  reasoningEffort: '',
  temperature: '',
  isDefault: false
};

function toForm(profile: ModelProfile): ModelProfileFormState {
  return {
    uuid: profile.uuid,
    name: profile.name,
    provider: profile.provider,
    model: profile.model,
    baseURL: profile.baseURL ?? '',
    apiKeySecretName: profile.apiKeySecretName ?? '',
    reasoningEffort: profile.reasoningEffort ?? '',
    temperature:
      typeof profile.temperature === 'number' ? String(profile.temperature) : '',
    isDefault: profile.isDefault
  };
}

function toPayload(form: ModelProfileFormState) {
  const temperature = form.temperature.trim()
    ? Number(form.temperature.trim())
    : null;

  return {
    name: form.name.trim(),
    provider: form.provider.trim(),
    model: form.model.trim(),
    baseURL: form.baseURL.trim() || null,
    apiKeySecretName: form.apiKeySecretName.trim() || null,
    reasoningEffort: form.reasoningEffort.trim() || null,
    temperature: Number.isFinite(temperature) ? temperature : null,
    isDefault: form.isDefault
  };
}

export function ModelProfilesPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [form, setForm] = useState<ModelProfileFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = Boolean(form.uuid);
  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort(
        (left, right) =>
          Number(right.isDefault) - Number(left.isDefault) ||
          left.name.localeCompare(right.name)
      ),
    [profiles]
  );

  async function loadProfiles() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/model-profiles');
      const payload = (await response.json()) as ModelProfilesResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? '模型配置加载失败'
            : getApiErrorMessage(payload, t, 'common.fallback.error')
        );
      }

      setProfiles(payload.data);
    } catch (error) {
      setProfiles([]);
      setErrorMessage(getErrorMessage(error, t, 'common.fallback.error'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  function validateForm(): string | null {
    if (!form.name.trim()) {
      return '请输入配置名称';
    }

    if (!form.provider.trim()) {
      return '请输入供应商';
    }

    if (!form.model.trim()) {
      return '请输入模型名称';
    }

    if (form.temperature.trim()) {
      const temperature = Number(form.temperature.trim());

      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        return 'Temperature 必须在 0 到 2 之间';
      }
    }

    return null;
  }

  async function handleSubmit() {
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const response = await fetch(
        form.uuid ? `/api/model-profiles/${form.uuid}` : '/api/model-profiles',
        {
          method: form.uuid ? 'PUT' : 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(toPayload(form))
        }
      );
      const payload = (await response.json()) as ModelProfileResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? '模型配置保存失败'
            : getApiErrorMessage(payload, t, 'common.fallback.error')
        );
      }

      setForm(EMPTY_FORM);
      await loadProfiles();
      toast.success('模型配置已保存');
    } catch (error) {
      setFormError(getErrorMessage(error, t, 'common.fallback.error'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(profile: ModelProfile) {
    if (!window.confirm(`确认删除模型配置「${profile.name}」？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/model-profiles/${profile.uuid}`, {
        method: 'DELETE'
      });
      const payload = response.status === 204 ? null : ((await response.json()) as DeleteResponse);

      if (!response.ok || (payload && !payload.success)) {
        throw new Error(
          payload && !payload.success
            ? getApiErrorMessage(payload, t, 'common.fallback.error')
            : '模型配置删除失败'
        );
      }

      await loadProfiles();
      toast.success('模型配置已删除');
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'common.fallback.error'));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">模型配置</h1>
          <p className="text-sm text-muted-foreground">
            为 Agent 维护可复用的模型档案，密钥通过 Agent Client 环境变量注入。
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setForm(EMPTY_FORM)}>
          <PlusIcon />
          新建配置
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField orientation="vertical">
            <FieldLabel>名称</FieldLabel>
            <FieldContent>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="如 GPT-5 研发默认模型"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>供应商</FieldLabel>
            <FieldContent>
              <Input
                value={form.provider}
                onChange={(event) => setForm({ ...form, provider: event.target.value })}
                placeholder="openai-compatible"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>模型</FieldLabel>
            <FieldContent>
              <Input
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="gpt-5"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>Base URL</FieldLabel>
            <FieldContent>
              <Input
                value={form.baseURL}
                onChange={(event) => setForm({ ...form, baseURL: event.target.value })}
                placeholder="https://api.example.com/v1"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>密钥环境变量</FieldLabel>
            <FieldContent>
              <Input
                value={form.apiKeySecretName}
                onChange={(event) =>
                  setForm({ ...form, apiKeySecretName: event.target.value })
                }
                placeholder="OPENAI_API_KEY"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>Reasoning Effort</FieldLabel>
            <FieldContent>
              <Input
                value={form.reasoningEffort}
                onChange={(event) =>
                  setForm({ ...form, reasoningEffort: event.target.value })
                }
                placeholder="medium"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>Temperature</FieldLabel>
            <FieldContent>
              <Input
                value={form.temperature}
                onChange={(event) =>
                  setForm({ ...form, temperature: event.target.value })
                }
                placeholder="0.2"
                disabled={isSaving}
              />
            </FieldContent>
          </FormField>
          <FormField orientation="vertical">
            <FieldLabel>默认</FieldLabel>
            <FieldContent className="flex h-10 items-center gap-2">
              <Checkbox
                checked={form.isDefault}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isDefault: Boolean(checked) })
                }
                disabled={isSaving}
              />
              <span className="text-sm text-muted-foreground">设为默认模型</span>
            </FieldContent>
          </FormField>
        </div>
        {formError ? <FieldError className="mt-3">{formError}</FieldError> : null}
        <div className="mt-4 flex items-center gap-2">
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isEditing ? '保存修改' : '创建模型'}
          </Button>
          {isEditing ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm(EMPTY_FORM)}
              disabled={isSaving}
            >
              取消编辑
            </Button>
          ) : null}
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>模型</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>默认</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  加载中
                </TableCell>
              </TableRow>
            ) : sortedProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  暂无模型配置
                </TableCell>
              </TableRow>
            ) : (
              sortedProfiles.map((profile) => (
                <TableRow key={profile.uuid}>
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell>{profile.provider}</TableCell>
                  <TableCell>{profile.model}</TableCell>
                  <TableCell>{profile.apiKeySecretName ?? '-'}</TableCell>
                  <TableCell>{profile.isDefault ? '是' : '-'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setForm(toForm(profile))}
                      >
                        <PencilIcon />
                        <span className="sr-only">编辑</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(profile)}
                      >
                        <Trash2Icon />
                        <span className="sr-only">删除</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
