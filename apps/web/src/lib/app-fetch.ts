import { ONES } from '@ones-open/web-sdk';
import type { ApiError, ApiSuccess } from '@ones-ai-workflow/shared';
import { i18n, syncI18nWithOnesLanguage } from '@/i18n';
import {
  persistTeams,
  readStoredSelectedTeamUUID,
  resolveSelectedTeamUUID,
  type StoredTeamOption,
} from './team-storage';
import { getApiErrorMessage } from './api-error';
import { DEFAULT_LOCALE, resolveLocale, toOnesLanguage } from './locale';

const nativeFetch = window.fetch.bind(window);
const ONES_FETCH_TIMEOUT_MS = 800;
const ONES_ORG_JWT_STORAGE_KEY = '_ones_json_ones_org_jwt';
const ONES_TEAM_UUID_HEADER = 'x-ones-team-uuid';
let redirectingToLogin = false;
let redirectingToForbidden = false;
let teamContextReadyPromise: Promise<void> | null = null;

type TokenInfoResponse =
  | ApiSuccess<{
      user: {
        language?: string;
      };
      teams: StoredTeamOption[];
    }>
  | ApiError;

function getStoredAuthorizationHeader(): string | null {
  const rawValue = window.localStorage.getItem(ONES_ORG_JWT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      access_token?: unknown;
    };
    const accessToken =
      typeof parsed.access_token === 'string' ? parsed.access_token.trim() : '';

    return accessToken ? `Bearer ${accessToken}` : null;
  } catch {
    return null;
  }
}

function resolveRequestHeaders(
  input: RequestInfo | URL,
  init?: RequestInit
): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  const initHeaders = new Headers(init?.headers);

  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  if (!headers.has('authorization')) {
    const authorizationHeader = getStoredAuthorizationHeader();

    if (authorizationHeader) {
      headers.set('authorization', authorizationHeader);
    }
  }

  if (!headers.has(ONES_TEAM_UUID_HEADER)) {
    const selectedTeamUUID = readStoredSelectedTeamUUID();

    if (selectedTeamUUID) {
      headers.set(ONES_TEAM_UUID_HEADER, selectedTeamUUID);
    }
  }

  return headers;
}

function withAuthorizationInit(
  input: RequestInfo | URL,
  init?: RequestInit
): RequestInit {
  return {
    ...init,
    headers: resolveRequestHeaders(input, init)
  };
}

function shouldUseOnesFetch(input: RequestInfo | URL): boolean {
  if (typeof input === 'string') {
    return input.startsWith('/');
  }

  if (input instanceof URL) {
    return input.origin === window.location.origin;
  }

  if (input instanceof Request) {
    return input.url.startsWith(window.location.origin) || input.url.startsWith('/');
  }

  return false;
}

function resolveSameOriginPathname(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') {
    if (input.startsWith('/')) {
      return new URL(input, window.location.origin).pathname;
    }

    try {
      const url = new URL(input, window.location.origin);
      return url.origin === window.location.origin ? url.pathname : null;
    } catch {
      return null;
    }
  }

  if (input instanceof URL) {
    return input.origin === window.location.origin ? input.pathname : null;
  }

  if (input instanceof Request) {
    const url = new URL(input.url, window.location.origin);
    return url.origin === window.location.origin ? url.pathname : null;
  }

  return null;
}

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  const pathname = resolveSameOriginPathname(input);
  return pathname?.startsWith('/api/') ?? false;
}

function isTokenInfoRequest(input: RequestInfo | URL): boolean {
  return resolveSameOriginPathname(input) === '/api/ones/token-info';
}

function shouldWaitForTeamContext(input: RequestInfo | URL): boolean {
  return isSameOriginApiRequest(input) && !isTokenInfoRequest(input);
}

function getReturnUrl(): string {
  try {
    if (window.top?.location?.href) {
      return window.top.location.href;
    }
  } catch {
    // Ignore cross-origin access failures and fall back to current frame URL.
  }

  return window.location.href;
}

function buildLoginUrl(): string {
  const loginUrl = new URL('/auth/login', window.location.origin);
  const locale =
    resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  loginUrl.searchParams.set('lang', toOnesLanguage(locale));
  loginUrl.searchParams.set('ones_from', getReturnUrl());
  return loginUrl.toString();
}

function redirectToLogin(): void {
  if (redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;
  window.location.replace(buildLoginUrl());
}

function buildForbiddenUrl(reason = 'missing_org_admin'): string {
  const nextUrl = new URL(window.location.href);
  nextUrl.hash = `#/forbidden?reason=${encodeURIComponent(reason)}`;
  return nextUrl.toString();
}

function redirectToForbidden(reason?: string): void {
  if (redirectingToForbidden) {
    return;
  }

  redirectingToForbidden = true;
  window.location.replace(buildForbiddenUrl(reason));
}

async function withSessionRedirect(
  input: RequestInfo | URL,
  request: Promise<Response>
): Promise<Response> {
  const response = await request;

  if (response.status === 401 && isSameOriginApiRequest(input)) {
    redirectToLogin();
  }

  if (response.status === 403 && isTokenInfoRequest(input)) {
    redirectToForbidden('missing_org_admin');
  }

  return response;
}

function getRuntimeBasePath(): string {
  const modulesIndex = window.location.pathname.indexOf('/modules/');

  if (modulesIndex >= 0) {
    return window.location.pathname.slice(0, modulesIndex);
  }

  return '';
}

export function resolveAppPath(pathname: string): string {
  const runtimeBasePath = getRuntimeBasePath();

  if (!runtimeBasePath || !pathname.startsWith('/')) {
    return pathname;
  }

  return `${runtimeBasePath}${pathname}`;
}

function resolveFallbackInput(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string') {
    return resolveAppPath(input);
  }

  if (input instanceof URL) {
    if (input.origin !== window.location.origin || !input.pathname.startsWith('/')) {
      return input;
    }

    return new URL(resolveAppPath(`${input.pathname}${input.search}`), window.location.origin);
  }

  if (input instanceof Request) {
    const requestUrl = new URL(input.url, window.location.origin);

    if (requestUrl.origin !== window.location.origin || !requestUrl.pathname.startsWith('/')) {
      return input;
    }

    return new Request(
      resolveAppPath(`${requestUrl.pathname}${requestUrl.search}`),
      input
    );
  }

  return input;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const requestInit = withAuthorizationInit(input, init);

  return await Promise.race([
    ONES.fetchApp(input, requestInit),
    new Promise<Response>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error('ONES.fetchApp timeout'));
      }, ONES_FETCH_TIMEOUT_MS);
    })
  ]);
}

async function performAppRequestWithoutTeamInitialization(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const requestInit = withAuthorizationInit(input, init);

  if (!shouldUseOnesFetch(input)) {
    return nativeFetch(input, requestInit);
  }

  try {
    return await fetchWithTimeout(input, requestInit);
  } catch {
    return nativeFetch(resolveFallbackInput(input), requestInit);
  }
}

async function ensureTeamContextReady(): Promise<void> {
  if (readStoredSelectedTeamUUID()) {
    return;
  }

  if (teamContextReadyPromise) {
    return teamContextReadyPromise;
  }

  teamContextReadyPromise = (async () => {
    if (readStoredSelectedTeamUUID()) {
      return;
    }

    const response = await withSessionRedirect(
      '/api/ones/token-info',
      performAppRequestWithoutTeamInitialization('/api/ones/token-info')
    );
    const payload = (await response.json()) as TokenInfoResponse;

    if (!response.ok || !payload.success) {
      throw new Error(
        payload.success
          ? i18n.t('app.teamLoadFailed')
          : getApiErrorMessage(payload, i18n.t.bind(i18n), 'app.teamLoadFailed')
      );
    }

    persistTeams(payload.data.teams);
    void syncI18nWithOnesLanguage(payload.data.user.language);

    const selectedTeamUUID = resolveSelectedTeamUUID(
      payload.data.teams,
      readStoredSelectedTeamUUID()
    );

    if (!selectedTeamUUID) {
      throw new Error(i18n.t('app.noAvailableTeam'));
    }
  })().finally(() => {
    teamContextReadyPromise = null;
  });

  return teamContextReadyPromise;
}

export async function appFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (shouldWaitForTeamContext(input) && !readStoredSelectedTeamUUID()) {
    await ensureTeamContextReady();
  }

  const requestInit = withAuthorizationInit(input, init);

  if (!shouldUseOnesFetch(input)) {
    return withSessionRedirect(input, nativeFetch(input, requestInit));
  }

  try {
    return await withSessionRedirect(
      input,
      fetchWithTimeout(input, requestInit)
    );
  } catch {
    return withSessionRedirect(
      input,
      nativeFetch(resolveFallbackInput(input), requestInit)
    );
  }
}

export function installAppFetchPolyfill(): void {
  window.fetch = appFetch as typeof window.fetch;
}
