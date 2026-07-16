import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

export type AIStreamEventName =
  | 'meta'
  | 'stage'
  | 'text_delta'
  | 'draft_ready'
  | 'done'
  | 'error'
  | 'ping';

export function streamAIEvents(
  c: Context,
  producer: (input: {
    signal: AbortSignal;
    send: (event: AIStreamEventName, data: unknown) => Promise<void>;
  }) => Promise<void>
) {
  return streamSSE(c, async (stream) => {
    const send = (event: AIStreamEventName, data: unknown) =>
      stream.writeSSE({ event, data: JSON.stringify(data) });
    const keepAlive = setInterval(() => {
      void send('ping', { at: Date.now() });
    }, 15_000);

    try {
      await producer({ signal: c.req.raw.signal, send });
    } catch (error) {
      await send('error', {
        code: error instanceof Error ? error.name : 'AIStreamError',
        message: error instanceof Error ? error.message : 'AI stream failed',
        retryable: Boolean(
          typeof error === 'object' &&
          error !== null &&
          'retryable' in error &&
          (error as { retryable?: unknown }).retryable
        )
      });
    } finally {
      clearInterval(keepAlive);
    }
  });
}
