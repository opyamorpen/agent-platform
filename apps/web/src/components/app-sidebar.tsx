import * as React from 'react';

import { NavDocuments } from '@/components/nav-documents';
import { NavTeamSwitcher } from '@/components/nav-team-switcher';
import { NavUser } from '@/components/nav-user';
import { useTeamContext } from '@/layouts/app-layout';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader
} from '@/components/ui/sidebar';
import {
  Settings2Icon,
  BotIcon,
  WorkflowIcon,
  TicketIcon,
  PackageIcon,
  FolderIcon,
  UsersIcon,
  SparklesIcon,
  BookOpenIcon,
  Repeat2Icon,
  ShieldCheckIcon,
  ChartNoAxesCombinedIcon,
  BrainCircuitIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const { currentUser, isAdmin } = useTeamContext();
  const data = {
    workflow: [
      {
        name: t('navigation.items.workflowExecution'),
        url: '/settings/issues',
        icon: <TicketIcon />
      },
      {
        name: t('navigation.items.workflowDesign'),
        url: '/settings/workflows',
        icon: <WorkflowIcon />
      }
    ],
    agentDesign: [
      {
        name: t('navigation.items.agentConfig'),
        url: '/settings/agents',
        icon: <BotIcon />
      },
      {
        name: t('navigation.items.agentSkills'),
        url: '/settings/skills',
        icon: <PackageIcon />
      },
      {
        name: t('navigation.items.agentKnowledge'),
        url: '/settings/knowledge-sources',
        icon: <BookOpenIcon />
      },
      {
        name: t('navigation.items.agentWorkspaces'),
        url: '/settings/agent-workspaces',
        icon: <FolderIcon />
      }
    ],
    adminSettings: [
      {
        name: t('navigation.items.loopRuntimeConfig'),
        url: '/settings/loop-runtime-config',
        icon: <Repeat2Icon />
      },
      {
        name: t('navigation.items.assetOptimizations'),
        url: '/settings/asset-optimizations',
        icon: <ChartNoAxesCombinedIcon />
      },
      {
        name: t('navigation.items.experiencePatterns'),
        url: '/settings/experience-patterns',
        icon: <BrainCircuitIcon />
      },
      {
        name: t('navigation.items.workspaceVerificationProfiles'),
        url: '/settings/workspace-verification-profiles',
        icon: <ShieldCheckIcon />
      },
      {
        name: t('navigation.items.aiModelConfig'),
        url: '/settings/ai-model-config',
        icon: <SparklesIcon />
      },
      {
        name: t('navigation.items.agentClients'),
        url: '/settings/agent-clients',
        icon: <Settings2Icon />
      },
      {
        name: t('navigation.items.members'),
        url: '/settings/members',
        icon: <UsersIcon />
      }
    ]
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <NavTeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavDocuments
          label={t('navigation.groups.aiWorkflow')}
          items={data.workflow}
        />
        <NavDocuments
          label={t('navigation.groups.agentDesign')}
          items={data.agentDesign}
        />
        {isAdmin ? (
          <NavDocuments
            label={t('navigation.groups.adminSettings')}
            items={data.adminSettings}
          />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: currentUser?.name ?? t('common.fallback.currentUser')
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
