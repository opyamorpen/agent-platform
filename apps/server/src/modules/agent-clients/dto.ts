import { z } from 'zod';

const connectClientSchema = z.object({
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  version: z.string().trim().min(1)
});

const taskReportSchema = z.object({
  taskUUID: z.string().trim().min(1),
  claimToken: z.string().trim().min(1).optional(),
  status: z.enum(['queued', 'running', 'success', 'failure', 'blocked']),
  logs: z.string(),
  executeResult: z.string(),
  attachmentUploads: z
    .array(
      z.object({
        outputName: z.string().trim().min(1),
        uploads: z.array(
          z.object({
            resourceToken: z.string().trim().min(1),
            fileName: z.string().trim().min(1),
            localPath: z.string().trim().min(1)
          })
        )
      })
    )
    .optional(),
  verificationResults: z
    .array(
      z.object({
        profileUUID: z.string().trim().min(1),
        profileName: z.string().trim().min(1),
        status: z.enum(['passed', 'failed']),
        steps: z.array(
          z.object({
            stepUUID: z.string().trim().min(1),
            stepName: z.string().trim().min(1),
            repositoryUUID: z.string().trim().min(1),
            command: z.string(),
            status: z.enum(['passed', 'failed', 'timed_out', 'skipped']),
            exitCode: z.number().int().nullable(),
            stdout: z.string(),
            stderr: z.string(),
            startedAt: z.string().datetime(),
            finishedAt: z.string().datetime(),
            durationMs: z.number().int().min(0)
          })
        )
      })
    )
    .optional(),
  workspacePatch: z
    .object({
      sourceTaskUUID: z.string().trim().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      byteSize: z.number().int().min(1),
      repositoryCount: z.number().int().min(0),
      changedFiles: z.number().int().min(0),
      additions: z.number().int().min(0),
      deletions: z.number().int().min(0)
    })
    .optional(),
  usage: z
    .object({
      inputTokens: z.number().finite().nullable(),
      outputTokens: z.number().finite().nullable()
    })
    .nullable()
    .optional(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable()
});

export const agentClientConnectSchema = z.object({
  client: connectClientSchema,
  connectCode: z.string().trim().min(1)
});

export const agentClientConnectPollSchema = z.object({
  clientUUID: z.string().trim().min(1),
  connectionRequestUUID: z.string().trim().min(1),
  connectCode: z.string().trim().min(1)
});

export const agentClientTaskReportSchema = z.object({
  reports: z.array(taskReportSchema)
});

export const agentClientTaskClaimSchema = z.object({
  availableSlots: z.number().int().min(0),
  capabilities: z
    .array(
      z.enum([
        'workspace-verification-v1',
        'workspace-patch-v1',
        'task-lease-v1',
        'skill-version-pinning-v1'
      ])
    )
    .default([])
});

export type AgentClientConnectDTO = z.infer<typeof agentClientConnectSchema>;
export type AgentClientConnectPollDTO = z.infer<typeof agentClientConnectPollSchema>;
export type AgentClientTaskReportDTO = z.infer<typeof agentClientTaskReportSchema>;
export type AgentClientTaskClaimDTO = z.infer<typeof agentClientTaskClaimSchema>;
