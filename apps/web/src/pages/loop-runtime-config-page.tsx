import { useCallback, useEffect, useState } from 'react';
import type {
  ApiError,
  ApiSuccess,
  LoopRuntimeConfig
} from '@ones-ai-workflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { PowerIcon, SaveIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type ConfigResponse = ApiSuccess<LoopRuntimeConfig> | ApiError;

export function LoopRuntimeConfigPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<LoopRuntimeConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/loop-runtime-config');
      const payload = (await response.json()) as ConfigResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.loopRuntimeConfig.loadFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.loopRuntimeConfig.loadFailed'
              )
        );
      }
      setConfig(payload.data);
      setEnabled(payload.data.enabled);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.loopRuntimeConfig.loadFailed')
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function save() {
    try {
      setIsSaving(true);
      const response = await fetch('/api/loop-runtime-config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const payload = (await response.json()) as ConfigResponse;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.loopRuntimeConfig.saveFailed')
            : getApiErrorMessage(
                payload,
                t,
                'pages.loopRuntimeConfig.saveFailed'
              )
        );
      }
      setConfig(payload.data);
      setEnabled(payload.data.enabled);
      setErrorMessage(null);
      toast.success(t('pages.loopRuntimeConfig.saveSuccess'));
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, t, 'pages.loopRuntimeConfig.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto px-4 py-5 lg:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-base font-semibold">
              {t('pages.loopRuntimeConfig.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.loopRuntimeConfig.description')}
            </p>
          </div>
          <Badge variant={config?.enabled ? 'default' : 'secondary'}>
            <PowerIcon />
            {config?.enabled
              ? t('pages.loopRuntimeConfig.enabled')
              : t('pages.loopRuntimeConfig.disabled')}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-6 border-b py-5">
          <div className="grid gap-1">
            <Label htmlFor="loop-runtime-enabled">
              {t('pages.loopRuntimeConfig.switchLabel')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('pages.loopRuntimeConfig.switchHelp')}
            </p>
          </div>
          <Switch
            id="loop-runtime-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isLoading || isSaving}
          />
        </div>

        {errorMessage ? (
          <div className="mt-5 border-l-2 border-destructive px-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex border-t pt-4">
          <Button
            onClick={() => void save()}
            disabled={isLoading || isSaving || enabled === config?.enabled}
          >
            <SaveIcon />
            {isSaving ? t('common.states.saving') : t('common.actions.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
