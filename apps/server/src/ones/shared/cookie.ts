function toCookieMap(cookieHeader?: string): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const cookie of cookieHeader.split(';')) {
    const trimmedCookie = cookie.trim();

    if (!trimmedCookie) {
      continue;
    }

    const separatorIndex = trimmedCookie.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmedCookie.slice(0, separatorIndex).trim();
    const value = trimmedCookie.slice(separatorIndex + 1).trim();

    if (name) {
      cookies.set(name, value);
    }
  }

  return cookies;
}

function parseSetCookiePair(setCookie: string): [string, string] | null {
  const [cookiePart] = setCookie.split(';', 1);
  const separatorIndex = cookiePart.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const name = cookiePart.slice(0, separatorIndex).trim();
  const value = cookiePart.slice(separatorIndex + 1).trim();

  if (!name) {
    return null;
  }

  return [name, value];
}

export function getSetCookieValues(headers: Headers): string[] {
  const nodeHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof nodeHeaders.getSetCookie === 'function') {
    return nodeHeaders.getSetCookie();
  }

  const setCookieHeader = headers.get('set-cookie');
  return setCookieHeader ? [setCookieHeader] : [];
}

export function mergeSetCookies(
  existingCookieHeader: string | undefined,
  setCookies: readonly string[]
): string {
  const cookies = toCookieMap(existingCookieHeader);

  for (const setCookie of setCookies) {
    const parsedPair = parseSetCookiePair(setCookie);

    if (!parsedPair) {
      continue;
    }

    const [name, value] = parsedPair;
    cookies.set(name, value);
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}
