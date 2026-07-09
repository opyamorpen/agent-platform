import { z } from 'zod';

const connectClientSchema = z.object({
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  version: z.string().trim().min(1)
});

const taskReportSchema = z.object({
  taskUUID: z.string().trim().min(1),
  status: z.enum(['queued', 'running', 'success', 'failure']),
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
  availableSlots: z.number().int().min(0)
});

export type AgentClientConnectDTO = z.infer<typeof agentClientConnectSchema>;
export type AgentClientConnectPollDTO = z.infer<typeof agentClientConnectPollSchema>;
export type AgentClientTaskReportDTO = z.infer<typeof agentClientTaskReportSchema>;
export type AgentClientTaskClaimDTO = z.infer<typeof agentClientTaskClaimSchema>;
