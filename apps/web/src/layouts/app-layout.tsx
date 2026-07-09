import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AppAccess,
  AppAccessRole,
  ApiError,
  ApiSuccess
} from '@ones-ai-workflow/shared';
import { Navigate, Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import {
  persistSelectedTeamUUID,
  persistTeams,
  readStoredSelectedTeamUUID,
  readStoredTeams,
  resolveSelectedTeamUUID,
  type StoredTeamOption,
} from '@/lib/team-storage';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { SiteHeader } from '@/components/site-header';
import { useTranslation } from 'react-i18next';
import { syncI18nWithOnesLanguage } from '@/i18n';

type TeamOption = StoredTeamOption;
type CurrentUser = {
  uuid: string;
  email: string;
  name: string;
  language?: string;
};

type TokenInfoResponse =
  | ApiSuccess<{
      user: CurrentUser;
      teams: TeamOption[];
    }>
  | ApiError;
type AccessResponse = ApiSuccess<AppAccess> | ApiError;

type RequestError = Error & {
  status?: number;
};

type HeaderActionsContextValue = {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
  center: ReactNode;
  setCenter: (center: ReactNode) => void;
  title: string | null;
  setTitle: (title: string | null) => void;
};

type TeamContextValue = {
  currentUser: CurrentUser | null;
  teams: TeamOption[];
  selectedTeam: TeamOption | null;
  selectedTeamUUID: string | null;
  setSelectedTeamUUID: (teamUUID: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  role: AppAccessRole | null;
  isAdmin: boolean;
  isAccessLoading: boolean;
};

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null);
const TeamContext = createContext<TeamContextValue | null>(null);

export function useHeaderActions() {
  const context = useContext(HeaderActionsContext);

  if (!context) {
    throw new Error('useHeaderActions must be used within AppLayout');
  }

  return context;
}

export function useTeamContext() {
  const context = useContext(TeamContext);

  if (!context) {
    throw new Error('useTeamContext must be used within AppLayout');
  }

  return context;
}

export function AppLayout() {
  const { t } = useTranslation();
  const [actions, setActions] = useState<ReactNode>(null);
  const [center, setCenter] = useState<ReactNode>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>(() => readStoredTeams());
  const [selectedTeamUUID, setSelectedTeamUUIDState] = useState<string | null>(() =>
    readStoredSelectedTeamUUID()
  );
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [teamErrorMessage, setTeamErrorMessage] = useState<string | null>(null);
  const [role, setRole] = useState<AppAccessRole | null>(null);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [forbiddenReason, setForbiddenReason] = useState<string | null>(null);

  useEffect(() => {
    const nextTeamUUID = resolveSelectedTeamUUID(
      teams,
      selectedTeamUUID ?? readStoredSelectedTeamUUID()
    );

    if (nextTeamUUID !== selectedTeamUUID) {
      setSelectedTeamUUIDState(nextTeamUUID);
    }
  }, [selectedTeamUUID, teams]);

  useEffect(() => {
    let cancelled = false;

    async function loadTokenInfo() {
      setIsLoadingTeams(true);
      setTeamErrorMessage(null);

      try {
        const response = await fetch('/api/ones/token-info');
        const payload = (await response.json()) as TokenInfoResponse;

        if (!response.ok || !payload.success) {
          const error = new Error(
            payload.success
              ? t('app.teamLoadFailed')
              : getApiErrorMessage(payload, t, 'app.teamLoadFailed')
          ) as RequestError;
          error.status = response.status;
          throw error;
        }

        if (cancelled) {
          return;
        }

        persistTeams(payload.data.teams);
        setCurrentUser(payload.data.user);
        setTeams(payload.data.teams);
        void syncI18nWithOnesLanguage(payload.data.user.language);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if ((error as RequestError).status === 403) {
          setForbiddenReason('missing_org_admin');
          setTeamErrorMessage(null);
          return;
        }

        setTeamErrorMessage(getErrorMessage(error, t, 'app.teamLoadFailed'));
      } finally {
        if (!cancelled) {
          setIsLoadingTeams(false);
        }
      }
    }

    void loadTokenInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTeam =
    teams.find((team) => team.uuid === selectedTeamUUID) ?? null;

  const isResolvingSelectedTeam =
    !forbiddenReason &&
    !isLoadingTeams &&
    teams.length > 0 &&
    !selectedTeamUUID;
  const isResolvingAccess =
    !forbiddenReason &&
    Boolean(selectedTeamUUID) &&
    (isAccessLoading || role === null);
  const isAppInitializing =
    isLoadingTeams || isResolvingSelectedTeam || isResolvingAccess;

  useEffect(() => {
    if (!selectedTeamUUID) {
      setRole(null);
      setIsAccessLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAccess() {
      setRole(null);
      setIsAccessLoading(true);
      setForbiddenReason(null);
      setTeamErrorMessage(null);

      try {
        const response = await fetch('/api/ones/access');
        const payload = (await response.json()) as AccessResponse;

        if (!response.ok || !payload.success) {
          const error = new Error(
            payload.success
              ? t('app.accessLoadFailed')
              : getApiErrorMessage(payload, t, 'app.accessLoadFailed')
          ) as RequestError;
          error.status = response.status;
          throw error;
        }

        if (cancelled) {
          return;
        }

        setRole(payload.data.role);
        setTeamErrorMessage(null);

        if (payload.data.role === 'none') {
          setForbiddenReason('not_app_member');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setTeamErrorMessage(getErrorMessage(error, t, 'app.accessLoadFailed'));
      } finally {
        if (!cancelled) {
          setIsAccessLoading(false);
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [selectedTeamUUID]);

  if (forbiddenReason) {
    return <Navigate to={`/forbidden?reason=${forbiddenReason}`} replace />;
  }

  function setSelectedTeamUUID(teamUUID: string) {
    setSelectedTeamUUIDState(teamUUID);
    persistSelectedTeamUUID(teamUUID);
    setForbiddenReason(null);
  }

  const contextValue = useMemo(
    () => ({
      actions,
      setActions,
      center,
      setCenter,
      title,
      setTitle,
    }),
    [actions, center, title]
  );
  const teamContextValue = useMemo(
    () => ({
      currentUser,
      teams,
      selectedTeam,
      selectedTeamUUID,
      setSelectedTeamUUID,
      isLoading: isLoadingTeams,
      errorMessage: teamErrorMessage,
      role,
      isAdmin: role === 'admin',
      isAccessLoading,
    }),
    [
      currentUser,
      isAccessLoading,
      isLoadingTeams,
      role,
      selectedTeam,
      selectedTeamUUID,
      teamErrorMessage,
      teams
    ]
  );

  if (isAppInitializing) {
    return <AppLoadingScreen />;
  }

  return (
    <HeaderActionsContext.Provider value={contextValue}>
      <TeamContext.Provider value={teamContextValue}>
        <SidebarProvider
          className="h-svh overflow-hidden"
          style={
            {
              '--sidebar-width': 'calc(var(--spacing) * 72)',
              '--header-height': 'calc(var(--spacing) * 12)'
            } as CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset className="min-h-0 overflow-hidden">
            <SiteHeader />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TeamContext.Provider>
    </HeaderActionsContext.Provider>
  );
}

function AppLoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(255,255,255,1))] px-6">
      <div className="flex items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </div>
    </div>
  );
}
