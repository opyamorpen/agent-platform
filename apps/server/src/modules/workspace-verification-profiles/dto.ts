import { z } from 'zod';

const verificationStepSchema = z.object({
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1).max(128),
  repositoryUUID: z.string().trim().min(1),
  workingDirectory: z.string().trim().max(512),
  executable: z.string().trim().min(1).max(512),
  args: z.array(z.string().max(2_000)).max(50),
  timeoutSeconds: z.number().int().min(1).max(1_800)
});

export const workspaceVerificationProfileMutationSchema = z.object({
  workspaceUUID: z.string().trim().min(1),
  name: z.string().trim().min(1).max(128),
  steps: z.array(verificationStepSchema).min(1).max(10)
});

export type WorkspaceVerificationProfileMutationDTO = z.infer<
  typeof workspaceVerificationProfileMutationSchema
>;
