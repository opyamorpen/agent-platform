import { z } from 'zod';

const sshRepositoryUrlPattern =
  /^(?:[^\s@/:]+@[^/\s:]+:[^\s]+|ssh:\/\/[^\s]+)$/;
const httpsRepositoryUrlPattern = /^https:\/\/[^\s]+$/i;
const repositoryUrlPattern = new RegExp(
  `(?:${sshRepositoryUrlPattern.source}|${httpsRepositoryUrlPattern.source})`,
  'i'
);

const repositoryUrlSchema = z.string().trim().regex(
  repositoryUrlPattern,
  'Repository URL must use a valid Git SSH or HTTPS format'
);

const repositoryUrlsSchema = z.array(repositoryUrlSchema).min(1);
const workspaceCredentialEnvNameSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Z][A-Z0-9_]{0,63}$/,
    'Credential env name must start with an uppercase letter and contain only A-Z, 0-9, _'
  )
  .refine((value) => !isReservedCredentialEnvName(value), {
    message: 'Credential env name is reserved'
  });

export const createAgentWorkspaceSchema = z.object({
  name: z.string().trim().min(1)
});

export const updateAgentWorkspaceSchema = z.object({
  name: z.string().trim().min(1)
});

export const createRepositorySchema = z
  .union([
    z.object({
      url: repositoryUrlSchema
    }),
    z.object({
      urls: repositoryUrlsSchema
    })
  ])
  .transform((value) => ({
    urls: 'url' in value ? [value.url] : value.urls
  }));

export const updateRepositorySchema = z.object({
  url: repositoryUrlSchema
});

export const updateWorkspaceAuthSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('none')
  }),
  z.object({
    type: z.literal('ssh')
  }),
  z.object({
    type: z.literal('https'),
    username: z.string().trim().min(1).max(256),
    secret: z.string().min(1).max(2048).optional().nullable()
  })
]);

export const createWorkspaceCredentialSchema = z.object({
  envName: workspaceCredentialEnvNameSchema,
  value: z.string().trim().min(1),
  description: z.string().trim().max(256).optional().nullable()
});

export type CreateAgentWorkspaceDTO = z.infer<typeof createAgentWorkspaceSchema>;
export type UpdateAgentWorkspaceDTO = z.infer<typeof updateAgentWorkspaceSchema>;
export type CreateRepositoryDTO = z.infer<typeof createRepositorySchema>;
export type UpdateRepositoryDTO = z.infer<typeof updateRepositorySchema>;
export type UpdateWorkspaceAuthDTO = z.infer<typeof updateWorkspaceAuthSchema>;
export type CreateWorkspaceCredentialDTO = z.infer<
  typeof createWorkspaceCredentialSchema
>;

const RESERVED_CREDENTIAL_ENV_NAME_PREFIXES = [
  'ONES_',
  'AGENT_CLIENT_'
];
const RESERVED_CREDENTIAL_ENV_NAMES = new Set([
  'CODEX_HOME',
  'GIT_SSH_COMMAND',
  'HOME',
  'NODE_OPTIONS',
  'PATH',
  'PWD',
  'SHELL'
]);

function isReservedCredentialEnvName(value: string): boolean {
  if (RESERVED_CREDENTIAL_ENV_NAMES.has(value)) {
    return true;
  }

  return RESERVED_CREDENTIAL_ENV_NAME_PREFIXES.some((prefix) =>
    value.startsWith(prefix)
  );
}
