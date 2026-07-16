import type { ApiError } from '@ones-ai-workflow/shared';

export type SSEEventName =
  | 'meta'
  | 'stage'
  | 'text_delta'
  | 'draft_ready'
  | 'done'
  | 'error'
  | 'ping';

export interface SSEEvent<T = unknown> {
  event: SSEEventName;
  data: T;
}

export async function streamPost(
  path: string,
  body: unknown,
  onEvent: (event: SSEEvent) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiError | null;
    throw new Error(
      payload?.message || `Request failed with status ${response.status}`
    );
  }
  if (!response.body) {
    throw new Error('Streaming response is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      const event = lines
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim() as SSEEventName | undefined;
      const rawData = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!event || !rawData) continue;

      const data = JSON.parse(rawData) as unknown;
      if (event === 'error') {
        const error = data as { message?: unknown };
        throw new Error(
          typeof error.message === 'string'
            ? error.message
            : 'Streaming request failed'
        );
      }
      await onEvent({ event, data });
    }

    if (done) break;
  }
}
