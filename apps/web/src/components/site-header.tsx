import { useLocation } from 'react-router-dom';
import { useHeaderActions } from '@/layouts/app-layout';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTranslation } from 'react-i18next';

export function SiteHeader() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { actions, center, title: overrideTitle } = useHeaderActions();
  const titleMap: Record<string, string> = {
    '/dashboard': t('header.titles.dashboard'),
    '/settings/issues': t('header.titles.workflowExecution'),
    '/settings/workflows': t('header.titles.workflowDesign'),
    '/settings/agents': t('header.titles.agentConfig'),
    '/settings/agent-clients': t('header.titles.agentClients'),
    '/settings/agent-workspaces': t('header.titles.agentWorkspaces'),
    '/settings/skills': t('header.titles.agentSkills'),
    '/settings/knowledge-sources': t('header.titles.agentKnowledge'),
    '/settings/ai-model-config': t('header.titles.aiModelConfig'),
    '/settings/loop-runtime-config': t('header.titles.loopRuntimeConfig')
  };
  const descriptionMap: Record<string, string> = {
    '/settings/issues': t('header.descriptions.workflowExecution'),
    '/settings/workflows': t('header.descriptions.workflowDesign'),
    '/settings/agents': t('header.descriptions.agentConfig'),
    '/settings/agent-workspaces': t('header.descriptions.agentWorkspaces'),
    '/settings/skills': t('header.descriptions.agentSkills'),
    '/settings/knowledge-sources': t('header.descriptions.agentKnowledge')
  };

  const title =
    overrideTitle ??
    (pathname.startsWith('/settings/agent-clients/')
      ? t('header.titles.agentClients')
      : pathname.startsWith('/settings/agent-workspaces/')
        ? t('header.titles.agentWorkspaces')
        : pathname.startsWith('/settings/agents/')
          ? t('header.titles.agentConfig')
          : pathname.startsWith('/settings/issues/')
            ? t('header.titles.workflowExecution')
            : pathname.startsWith('/settings/workflows/')
              ? t('header.titles.workflowDesign')
              : pathname.startsWith('/settings/skills/')
                ? t('header.titles.agentSkills')
                : (titleMap[pathname] ?? t('header.titles.dashboard')));

  const description = descriptionMap[pathname] ?? null;

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 !self-center data-[orientation=vertical]:!h-4"
          />
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate text-base font-medium">{title}</h1>
            {description ? (
              <p className="hidden truncate text-xs text-muted-foreground lg:block">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {center ? (
          <div className="flex items-center justify-center">{center}</div>
        ) : null}
        {actions ? (
          <div className="ml-auto flex items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
