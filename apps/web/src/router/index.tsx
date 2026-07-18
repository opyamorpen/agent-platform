import { Navigate, createHashRouter } from 'react-router-dom';
import { AdminRouteGuard } from '@/components/admin-route-guard';
import { AppLayout } from '@/layouts/app-layout';
import { AgentDetailPage } from '@/pages/agent-detail-page';
import { AgentClientsPage } from '@/pages/agent-clients-page';
import { AgentWorkspaceCredentialsPage } from '@/pages/agent-workspace-credentials-page';
import { AgentWorkspaceRepositoriesPage } from '@/pages/agent-workspace-repositories-page';
import { AgentWorkspacesPage } from '@/pages/agent-workspaces-page';
import { AgentsPage } from '@/pages/agents-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { IssueDetailPage } from '@/pages/issue-detail-page';
import { IssuesPage } from '@/pages/issues-page';
import { MembersPage } from '@/pages/members-page';
import { PermissionDeniedPage } from '@/pages/permission-denied-page';
import { SkillsPage } from '@/pages/skills-page';
import { WorkflowDetailPage } from '@/pages/workflow-detail-page';
import { WorkflowsPage } from '@/pages/workflows-page';
import { AIModelConfigPage } from '@/pages/ai-model-config-page';
import { SkillCreatorPage } from '@/pages/skill-creator-page';
import { KnowledgeSourcesPage } from '@/pages/knowledge-sources-page';
import { LoopRuntimeConfigPage } from '@/pages/loop-runtime-config-page';
import { WorkspaceVerificationProfilesPage } from '@/pages/workspace-verification-profiles-page';
import { AssetOptimizationsPage } from '@/pages/asset-optimizations-page';
import { ExperiencePatternsPage } from '@/pages/experience-patterns-page';

export const router = createHashRouter([
  {
    path: '/',
    element: <Navigate to="/settings/workflows" replace />
  },
  {
    path: '/forbidden',
    element: <PermissionDeniedPage />
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        path: 'dashboard',
        element: <DashboardPage />
      },
      {
        path: 'settings/issues',
        element: <IssuesPage />
      },
      {
        path: 'settings/issues/:uuid',
        element: <IssueDetailPage />
      },
      {
        path: 'settings/workflows',
        element: <WorkflowsPage />
      },
      {
        path: 'settings/workflows/:uuid',
        element: <WorkflowDetailPage />
      },
      {
        path: 'settings/agents',
        element: <AgentsPage />
      },
      {
        path: 'settings/skills',
        element: <SkillsPage />
      },
      {
        path: 'settings/knowledge-sources',
        element: <KnowledgeSourcesPage />
      },
      {
        path: 'settings/skills/create/:uuid',
        element: <SkillCreatorPage />
      },
      {
        path: 'settings/agents/:uuid',
        element: <AgentDetailPage />
      },
      {
        path: 'settings/agent-clients',
        element: (
          <AdminRouteGuard>
            <AgentClientsPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/members',
        element: (
          <AdminRouteGuard>
            <MembersPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/ai-model-config',
        element: (
          <AdminRouteGuard>
            <AIModelConfigPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/loop-runtime-config',
        element: (
          <AdminRouteGuard>
            <LoopRuntimeConfigPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/asset-optimizations',
        element: (
          <AdminRouteGuard>
            <AssetOptimizationsPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/experience-patterns',
        element: (
          <AdminRouteGuard>
            <ExperiencePatternsPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/workspace-verification-profiles',
        element: (
          <AdminRouteGuard>
            <WorkspaceVerificationProfilesPage />
          </AdminRouteGuard>
        )
      },
      {
        path: 'settings/agent-workspaces',
        element: <AgentWorkspacesPage />
      },
      {
        path: 'settings/agent-workspaces/:uuid/repositories',
        element: <AgentWorkspaceRepositoriesPage />
      },
      {
        path: 'settings/agent-workspaces/:uuid/credentials',
        element: <AgentWorkspaceCredentialsPage />
      }
    ]
  }
]);
