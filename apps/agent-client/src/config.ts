import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import type {
  ExecuteAgentType,
  ModelReasoningEffort
} from './agent-session/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');

dotenv.config({
  path: path.resolve(repoRoot, '.env')
});

const defaultClientUUID = `${os.hostname()}-agent-client`;
const defaultClientName = `${os.hostname()} agent client`;
const defaultClientVersion = '0.1.0';
const defaultCodexModel = 'gpt-5.4';
const defaultCodexReasoningEffort = 'high';
const defaultHermesExecutable = 'hermes';
const SOURCE_WORKSPACES_DIRECTORY_NAME = 'source-workspaces';
const SKILLS_DIRECTORY_NAME = 'skills';
const defaultWorkingRoot = path.resolve(repoRoot, '.agent-client');
const defaultCodexHome = path.join(os.homedir(), '.codex');
const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const envSchema = z.object({
  AGENT_CLIENT_UUID: z.string().trim().min(1).default(defaultClientUUID),
  AGENT_CLIENT_NAME: z.string().trim().min(1).default(defaultClientName),
  AGENT_CLIENT_VERSION: z.string().trim().min(1).default(defaultClientVersion),
  AGENT_CLIENT_SERVER_BASE_URL: z
    .string()
    .url()
    .default('http://127.0.0.1:3001'),
  AGENT_CLIENT_CONCURRENCY: z.coerce.number().int().positive().default(1),
  AGENT_CLIENT_WORKING_ROOT: z.string().trim().min(1).default(defaultWorkingRoot),
  AGENT_CLIENT_LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'off'])
    .default('info'),
  AGENT_CLIENT_DEFAULT_AGENT: z
    .enum(['codex', 'claude', 'hermes'])
    .default('codex'),
  AGENT_CLIENT_CODEX_HOMES: z.string().optional(),
  AGENT_CLIENT_CODEX_API_KEY: z.string().trim().optional(),
  AGENT_CLIENT_CODEX_BASE_URL: z.string().trim().url().optional(),
  AGENT_CLIENT_CODEX_MODEL: z
    .string()
    .trim()
    .min(1)
    .default(defaultCodexModel),
  AGENT_CLIENT_CODEX_REASONING_EFFORT: z
    .enum(['minimal', 'low', 'medium', 'high', 'xhigh'])
    .default(defaultCodexReasoningEffort),
  AGENT_CLIENT_HERMES_EXECUTABLE: z
    .string()
    .trim()
    .min(1)
    .default(defaultHermesExecutable),
  AGENT_CLIENT_HERMES_PROFILE: optionalTrimmedString,
  AGENT_CLIENT_HERMES_MODEL: optionalTrimmedString,
  AGENT_CLIENT_HERMES_PROVIDER: optionalTrimmedString,
  AGENT_CLIENT_HERMES_TOOLSETS: optionalTrimmedString
});

const parsedEnv = envSchema.parse(process.env);
const hasCodexApiKey = Boolean(parsedEnv.AGENT_CLIENT_CODEX_API_KEY);
const hasCodexBaseUrl = Boolean(parsedEnv.AGENT_CLIENT_CODEX_BASE_URL);

if (hasCodexApiKey !== hasCodexBaseUrl) {
  throw new Error(
    'AGENT_CLIENT_CODEX_API_KEY and AGENT_CLIENT_CODEX_BASE_URL must be configured together'
  );
}

if (
  parsedEnv.AGENT_CLIENT_HERMES_PROVIDER &&
  !parsedEnv.AGENT_CLIENT_HERMES_MODEL
) {
  throw new Error(
    'AGENT_CLIENT_HERMES_PROVIDER requires AGENT_CLIENT_HERMES_MODEL'
  );
}

const workingRoot = parsedEnv.AGENT_CLIENT_WORKING_ROOT;
const codexHomes = parseCodexHomes(
  parsedEnv.AGENT_CLIENT_CODEX_HOMES,
  process.env.CODEX_HOME
);

export const env = {
  clientUUID: parsedEnv.AGENT_CLIENT_UUID,
  clientName: parsedEnv.AGENT_CLIENT_NAME,
  clientVersion: parsedEnv.AGENT_CLIENT_VERSION,
  serverBaseUrl: parsedEnv.AGENT_CLIENT_SERVER_BASE_URL.replace(/\/+$/, ''),
  concurrency: parsedEnv.AGENT_CLIENT_CONCURRENCY,
  defaultAgent: parsedEnv.AGENT_CLIENT_DEFAULT_AGENT as ExecuteAgentType,
  workingRoot,
  sourceWorkspacesRoot: path.join(
    workingRoot,
    SOURCE_WORKSPACES_DIRECTORY_NAME
  ),
  skillsRoot: path.join(workingRoot, SKILLS_DIRECTORY_NAME),
  logLevel: parsedEnv.AGENT_CLIENT_LOG_LEVEL,
  codexHomes,
  codexApiKey: parsedEnv.AGENT_CLIENT_CODEX_API_KEY,
  codexBaseUrl: parsedEnv.AGENT_CLIENT_CODEX_BASE_URL,
  codexUsesApiKey: hasCodexApiKey,
  codexModel: parsedEnv.AGENT_CLIENT_CODEX_MODEL,
  codexReasoningEffort:
    parsedEnv.AGENT_CLIENT_CODEX_REASONING_EFFORT as ModelReasoningEffort,
  hermesExecutable: parsedEnv.AGENT_CLIENT_HERMES_EXECUTABLE,
  hermesProfile: parsedEnv.AGENT_CLIENT_HERMES_PROFILE,
  hermesModel: parsedEnv.AGENT_CLIENT_HERMES_MODEL,
  hermesProvider: parsedEnv.AGENT_CLIENT_HERMES_PROVIDER,
  hermesToolsets: parsedEnv.AGENT_CLIENT_HERMES_TOOLSETS
} as const;

function parseCodexHomes(
  configuredHomes: string | undefined,
  fallbackCodexHome: string | undefined
): string[] {
  const rawValues =
    configuredHomes?.split(',') ??
    [fallbackCodexHome?.trim() || defaultCodexHome];

  const homes = rawValues
    .map((value) => value.trim())
    .filter(Boolean)
    .map(resolveCodexHomePath);

  return Array.from(new Set(homes));
}

function resolveCodexHomePath(input: string): string {
  if (input === '~') {
    return os.homedir();
  }

  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }

  if (path.isAbsolute(input)) {
    return input;
  }

  return path.join(os.homedir(), input);
}
