import { ShieldAlertIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const REQUIRED_PERMISSION = 'org_plugin_administrator';

type PermissionDeniedReason =
  | 'missing_org_admin'
  | 'not_app_member'
  | 'admin_only';

function retryAfterPermissionGranted() {
  const nextUrl = `${window.location.pathname}${window.location.search}`;
  window.location.replace(nextUrl);
}

export function PermissionDeniedPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const reason = (searchParams.get('reason')?.trim() ??
    'missing_org_admin') as PermissionDeniedReason;
  const content = useMemo(() => {
    switch (reason) {
      case 'admin_only':
        return {
          title: t('permissionDenied.title.adminOnly'),
          description: t('permissionDenied.description.adminOnly'),
          hint: t('permissionDenied.hint.adminOnly'),
          requiredPermissionLabel: null
        };
      case 'not_app_member':
        return {
          title: t('permissionDenied.title.notAppMember'),
          description: t('permissionDenied.description.notAppMember'),
          hint: t('permissionDenied.hint.notAppMember'),
          requiredPermissionLabel: null
        };
      default:
        return {
          title: t('permissionDenied.title.missingOrgAdmin'),
          description: t('permissionDenied.description.missingOrgAdmin'),
          hint: t('permissionDenied.hint.missingOrgAdmin'),
          requiredPermissionLabel: REQUIRED_PERMISSION
        };
    }
  }, [reason, t]);

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_34%),linear-gradient(135deg,_rgba(255,248,235,0.98),_rgba(255,255,255,1)_55%,_rgba(226,240,255,0.92))] px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      <Card className="relative z-10 w-full max-w-xl border border-slate-900/10 bg-white/90 py-0 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
        <CardHeader className="gap-4 border-b border-slate-900/8 px-8 py-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
            <ShieldAlertIcon className="size-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
              {content.title}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-600">
              {content.description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-8 py-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900">
            {content.hint}
          </div>
          {content.requiredPermissionLabel ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">
                {t('permissionDenied.requiredPermission')}
              </div>
              <div className="mt-2 font-mono text-[13px]">
                {content.requiredPermissionLabel}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={retryAfterPermissionGranted}>
              {t('common.actions.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
