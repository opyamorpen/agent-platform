import { randomUUID } from 'node:crypto';
import { getLogger } from '../../lib/logger.js';
import { getAIModelRuntimeConfig } from '../ai-model-config/service.js';

const REQUEST_TIMEOUT_MS = 180_000;
const logger = getLogger('ai-model');

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIModelUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AIStreamResult {
  content: string;
  usage: AIModelUsage;
}

export class AIModelRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'AIModelRequestError';
  }
}

export async function streamAIChatCompletion(input: {
  teamUUID: string;
  feature: 'skill-chat' | 'prompt-recommendation';
  messages: AIChatMessage[];
  signal?: AbortSignal;
  onDelta: (delta: string) => Promise<void> | void;
}): Promise<AIStreamResult> {
  const config = await getAIModelRuntimeConfig(input.teamUUID);
  const requestId = randomUUID();
  const startedAt = Date.now();
  let emitted = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        buildChatCompletionsURL(config.baseURL),
        {
          method: 'POST',
          headers: buildHeaders(config.apiKey),
          body: JSON.stringify({
            model: config.model,
            temperature: config.temperature,
            stream: true,
            messages: input.messages
          })
        },
        input.signal
      );

      if (!response.ok) {
        throw await toRequestError(response);
      }

      if (!response.body) {
        throw new AIModelRequestError(
          'AI model returned an empty stream',
          502,
          false
        );
      }

      const result = await consumeOpenAIStream(response.body, async (delta) => {
        emitted = true;
        await input.onDelta(delta);
      });

      if (!result.content.trim()) {
        throw new AIModelRequestError(
          'AI model returned an empty stream',
          502,
          false
        );
      }

      logger.info('[ai-model] stream completed', {
        requestId,
        teamUUID: input.teamUUID,
        feature: input.feature,
        model: config.model,
        durationMs: Date.now() - startedAt,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens
      });
      return result;
    } catch (error) {
      const normalized = normalizeRequestError(error);
      const canRetry = attempt === 0 && !emitted && normalized.retryable;

      if (!canRetry) {
        logger.warn('[ai-model] stream failed', {
          requestId,
          teamUUID: input.teamUUID,
          feature: input.feature,
          model: config.model,
          durationMs: Date.now() - startedAt,
          status: normalized.status,
          retryable: normalized.retryable
        });
        throw normalized;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new AIModelRequestError('AI model request failed', 502, false);
}

export async function completeAIChatCompletion(input: {
  teamUUID: string;
  feature:
    | 'skill-generation'
    | 'skill-repair'
    | 'connection-test'
    | 'agent-execution'
    | 'loop-review'
    | 'loop-review-repair'
    | 'asset-optimization'
    | 'asset-optimization-repair'
    | 'asset-replay'
    | 'asset-replay-repair';
  messages: AIChatMessage[];
  signal?: AbortSignal;
  temperature?: number;
}): Promise<AIStreamResult> {
  const config = await getAIModelRuntimeConfig(input.teamUUID);
  const requestId = randomUUID();
  const startedAt = Date.now();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        buildChatCompletionsURL(config.baseURL),
        {
          method: 'POST',
          headers: buildHeaders(config.apiKey),
          body: JSON.stringify({
            model: config.model,
            temperature: input.temperature ?? config.temperature,
            stream: false,
            messages: input.messages
          })
        },
        input.signal
      );

      if (!response.ok) {
        throw await toRequestError(response);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const content = payload.choices?.[0]?.message?.content;

      if (typeof content !== 'string' || !content.trim()) {
        throw new AIModelRequestError(
          'AI model returned an empty response',
          502,
          false
        );
      }

      const usage = toUsage(payload.usage);
      logger.info('[ai-model] completion completed', {
        requestId,
        teamUUID: input.teamUUID,
        feature: input.feature,
        model: config.model,
        durationMs: Date.now() - startedAt,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens
      });
      return { content, usage };
    } catch (error) {
      const normalized = normalizeRequestError(error);
      if (attempt === 0 && normalized.retryable && !input.signal?.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw normalized;
    }
  }

  throw new AIModelRequestError('AI model request failed', 502, false);
}

export async function testAIModelConnection(teamUUID: string): Promise<void> {
  const result = await completeAIChatCompletion({
    teamUUID,
    feature: 'connection-test',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Reply with OK only.' },
      { role: 'user', content: 'Connection test' }
    ]
  });

  if (!result.content.trim()) {
    throw new AIModelRequestError(
      'AI model connection test returned no content',
      502,
      false
    );
  }
}

function buildChatCompletionsURL(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/chat/completions`;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json'
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  callerSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('AI model request timed out')),
    REQUEST_TIMEOUT_MS
  );
  const abort = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abort, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abort);
  }
}

async function consumeOpenAIStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => Promise<void>
): Promise<AIStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage: AIModelUsage = { inputTokens: null, outputTokens: null };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');

      if (!data || data === '[DONE]') {
        continue;
      }

      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: unknown } }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const delta = parsed.choices?.[0]?.delta?.content;

      if (typeof delta === 'string' && delta) {
        content += delta;
        await onDelta(delta);
      }

      if (parsed.usage) {
        usage = toUsage(parsed.usage);
      }
    }

    if (done) {
      if (buffer.trim()) {
        const data = buffer
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data && data !== '[DONE]') {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: unknown } }>;
            usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            content += delta;
            await onDelta(delta);
          }
          if (parsed.usage) usage = toUsage(parsed.usage);
        }
      }
      break;
    }
  }

  return { content, usage };
}

function toUsage(
  value:
    | {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
      }
    | undefined
): AIModelUsage {
  return {
    inputTokens:
      typeof value?.prompt_tokens === 'number' ? value.prompt_tokens : null,
    outputTokens:
      typeof value?.completion_tokens === 'number'
        ? value.completion_tokens
        : null
  };
}

async function toRequestError(
  response: Response
): Promise<AIModelRequestError> {
  const raw = await response.text().catch(() => '');
  let message = `AI model request failed with status ${response.status}`;

  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === 'string') {
      message = parsed.error.message;
    }
  } catch {
    // Do not include an untrusted upstream response body in errors or logs.
  }

  return new AIModelRequestError(
    message,
    response.status,
    response.status === 429 || response.status >= 500
  );
}

function normalizeRequestError(error: unknown): AIModelRequestError {
  if (error instanceof AIModelRequestError) {
    return error;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new AIModelRequestError(
      'AI model request was cancelled or timed out',
      499,
      true
    );
  }

  return new AIModelRequestError(
    error instanceof Error ? error.message : 'AI model request failed',
    502,
    true
  );
}
