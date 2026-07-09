export const TEAM_OPTIONS_STORAGE_KEY = 'ones-ai-workflow-team-options';
export const SELECTED_TEAM_STORAGE_KEY = 'ones-ai-workflow-selected-team-uuid';

export type StoredTeamOption = {
  uuid: string;
  name: string;
};

export function readStoredSelectedTeamUUID(): string | null {
  const rawValue = window.localStorage.getItem(SELECTED_TEAM_STORAGE_KEY);
  const normalizedValue = rawValue?.trim();
  return normalizedValue ? normalizedValue : null;
}

export function persistSelectedTeamUUID(teamUUID: string | null) {
  if (!teamUUID) {
    window.localStorage.removeItem(SELECTED_TEAM_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SELECTED_TEAM_STORAGE_KEY, teamUUID);
}

export function readStoredTeams(): StoredTeamOption[] {
  const rawValue = window.localStorage.getItem(TEAM_OPTIONS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof item.uuid === 'string' &&
        typeof item.name === 'string'
      ) {
        return [
          {
            uuid: item.uuid,
            name: item.name,
          },
        ];
      }

      return [];
    });
  } catch {
    return [];
  }
}

export function persistTeams(teams: StoredTeamOption[]) {
  window.localStorage.setItem(TEAM_OPTIONS_STORAGE_KEY, JSON.stringify(teams));
}

export function resolveSelectedTeamUUID(
  teams: StoredTeamOption[],
  preferredTeamUUID: string | null
): string | null {
  if (teams.length === 0) {
    persistSelectedTeamUUID(null);
    return null;
  }

  if (preferredTeamUUID && teams.some((team) => team.uuid === preferredTeamUUID)) {
    persistSelectedTeamUUID(preferredTeamUUID);
    return preferredTeamUUID;
  }

  const defaultTeamUUID = teams[0]?.uuid ?? null;
  persistSelectedTeamUUID(defaultTeamUUID);
  return defaultTeamUUID;
}
