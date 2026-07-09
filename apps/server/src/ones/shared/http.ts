import { OnesRequestError } from '../errors.js';
import { ensureLeadingSlash, trimTrailingSlash } from './utils.js';

type OnesHttpHeaders = Headers | Record<string, string>;
type OnesHttpBodyInit =
  | string
  | URLSearchParams
  | Blob
  | FormData
  | ArrayBuffer
  | ArrayBufferView;
type OnesHttpSearchValue = string | number | boolean | null | undefined;

export interface OnesHttpRequest {
  baseUrl: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  searchParams?: Record<string, OnesHttpSearchValue>;
  headers?: OnesHttpHeaders;
  body?: unknown;
  redirect?: 'follow' | 'manual' | 'error';
  allowedStatusCodes?: readonly number[];
}

function isBodyInitLike(body: unknown): body is OnesHttpBodyInit {
  return (
    body instanceof FormData ||
    typeof body === 'string' ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

export function buildOnesUrl(
  baseUrl: string,
  path: string,
  searchParams?: OnesHttpRequest['searchParams']
): URL {
  const url = new URL(
    ensureLeadingSlash(path),
    `${trimTrailingSlash(baseUrl)}/`
  );

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export async function requestRaw(request: OnesHttpRequest): Promise<Response> {
  const url = buildOnesUrl(request.baseUrl, request.path, request.searchParams);
  const headers = new Headers(request.headers);
  let body: OnesHttpBodyInit | undefined;

  if (request.body !== undefined && request.body !== null) {
    if (isBodyInitLike(request.body)) {
      body = request.body;
    } else {
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }

      body = JSON.stringify(request.body);
    }
  }

  const response = await fetch(url, {
    method: request.method ?? 'GET',
    headers,
    body: body as RequestInit['body'],
    redirect: request.redirect
  });

  const allowedStatusCodes = new Set(request.allowedStatusCodes ?? []);

  if (response.ok || allowedStatusCodes.has(response.status)) {
    return response;
  }

  const responseBody = await response.text();
  throw new OnesRequestError(
    `ONES request failed: ${response.status} ${response.statusText}`,
    response.status,
    url.toString(),
    responseBody
  );
}

export async function readResponsePayload(
  response: Response
): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

export async function requestJson(request: OnesHttpRequest): Promise<unknown> {
  const response = await requestRaw(request);
  return readResponsePayload(response);
}
