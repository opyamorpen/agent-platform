export function buildOnesIssueURL(
  displayId: string,
  config: {
    onesBaseUrl: string | null;
    teamUUID: string | null;
  }
): string | null {
  if (!displayId || !config.onesBaseUrl || !config.teamUUID) {
    return null;
  }

  const normalizedBaseURL = config.onesBaseUrl.replace(/\/+$/, '');
  return `${normalizedBaseURL}/project/#/team/${encodeURIComponent(config.teamUUID)}/issue/${encodeURIComponent(displayId)}`;
}
