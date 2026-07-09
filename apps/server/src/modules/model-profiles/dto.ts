import { z } from 'zod';

export const modelProfileMutationSchema = z.object({
  name: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  baseURL: z.string().trim().url().nullable().optional(),
  apiKeySecretName: z.string().trim().min(1).nullable().optional(),
  reasoningEffort: z.string().trim().min(1).nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  isDefault: z.boolean().optional()
});

export type ModelProfileMutationDTO = z.infer<typeof modelProfileMutationSchema>;
