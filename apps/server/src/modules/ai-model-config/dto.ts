import { z } from 'zod';

export const updateAIModelConfigSchema = z.object({
  baseURL: z.string().trim().url(),
  model: z.string().trim().min(1).max(128),
  temperature: z.number().min(0).max(2).default(0.2),
  apiKey: z.string().trim().min(1).max(4096).optional()
});

export type UpdateAIModelConfigDTO = z.infer<typeof updateAIModelConfigSchema>;
