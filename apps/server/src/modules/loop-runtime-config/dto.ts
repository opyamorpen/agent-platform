import { z } from 'zod';

export const updateLoopRuntimeConfigSchema = z.object({
  enabled: z.boolean()
});

export type UpdateLoopRuntimeConfigDTO = z.infer<
  typeof updateLoopRuntimeConfigSchema
>;
