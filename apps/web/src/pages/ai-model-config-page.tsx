import { useCallback, useEffect, useState } from 'react';
import type {
  AIModelConfig,
  ApiError,
  ApiSuccess
} from '@ones-ai-workflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { KeyRoundIcon, PlugZapIcon, SaveIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type ConfigResponse = ApiSuccess<AIModelConfig> | ApiError;
type TestResponse = ApiSuccess<{ ok: true }> | ApiError;

export function AIModelConfigPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AIModelConfig | null>(null);
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.2');
  const [apiKey, setAPIKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ai-model-config');
      const payload = (await response.json()) as ConfigResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.aiModelConfig.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.aiModelConfig.loadFailed')
        );
      }
      setConfig(payload.data);
      setBaseURL(payload.data.baseURL);
      setModel(payload.data.model);
      setTemperature(String(payload.data.temperature));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.aiModelConfig.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function save() {
    const parsedTemperature = Number(temperature);
    if (
      !baseURL.trim() ||
      !model.trim() ||
      !Number.isFinite(parsedTemperature) ||
      parsedTemperature < 0 ||
      parsedTemperature > 2
    ) {
      setErrorMessage(t('pages.aiModelConfig.validationFailed'));
      return;
    }
    try {
      setIsSaving(true);
      const response = await fetch('/api/ai-model-config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baseURL: baseURL.trim(),
          model: model.trim(),
          temperature: parsedTemperature,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
        })
      });
      const payload = (await response.json()) as ConfigResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.aiModelConfig.saveFailed')
            : getApiErrorMessage(payload, t, 'pages.aiModelConfig.saveFailed')
        );
      }
      setConfig(payload.data);
      setAPIKey('');
      setErrorMessage(null);
      toast.success(t('pages.aiModelConfig.saveSuccess'));
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.aiModelConfig.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    try {
      setIsTesting(true);
      const response = await fetch('/api/ai-model-config/test', {
        method: 'POST'
      });
      const payload = (await response.json()) as TestResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.aiModelConfig.testFailed')
            : getApiErrorMessage(payload, t, 'pages.aiModelConfig.testFailed')
        );
      }
      toast.success(t('pages.aiModelConfig.testSuccess'));
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.aiModelConfig.testFailed')
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-4 py-5 lg:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-base font-semibold">
              {t('pages.aiModelConfig.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.aiModelConfig.description')}
            </p>
          </div>
          <Badge variant={config?.hasAPIKey ? 'default' : 'secondary'}>
            <KeyRoundIcon />
            {config?.hasAPIKey
              ? t('pages.aiModelConfig.keyConfigured')
              : t('pages.aiModelConfig.keyMissing')}
          </Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="ai-base-url">
              {t('pages.aiModelConfig.baseURL')}
            </Label>
            <Input
              id="ai-base-url"
              value={baseURL}
              onChange={(event) => setBaseURL(event.target.value)}
              placeholder="https://api.openai.com/v1"
              disabled={isLoading || isSaving}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-model">{t('pages.aiModelConfig.model')}</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gpt-5"
              disabled={isLoading || isSaving}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-temperature">Temperature</Label>
            <Input
              id="ai-temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
              disabled={isLoading || isSaving}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setAPIKey(event.target.value)}
              placeholder={
                config?.hasAPIKey
                  ? t('pages.aiModelConfig.keyReplacePlaceholder')
                  : t('pages.aiModelConfig.keyPlaceholder')
              }
              disabled={isLoading || isSaving}
            />
            <p className="text-xs text-muted-foreground">
              {t('pages.aiModelConfig.keyHelp')}
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-5 border-l-2 border-destructive px-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={() => void save()} disabled={isLoading || isSaving}>
            <SaveIcon />
            {isSaving ? t('common.states.saving') : t('common.actions.save')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void testConnection()}
            disabled={isLoading || isSaving || isTesting || !config?.hasAPIKey}
          >
            <PlugZapIcon />
            {isTesting
              ? t('pages.aiModelConfig.testing')
              : t('pages.aiModelConfig.test')}
          </Button>
        </div>
      </div>
    </div>
  );
}
