import { z } from 'zod';

export const knowledgeSourceMutationSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).default(''),
  spaceUUID: z.string().trim().min(1),
  status: z.enum(['active', 'disabled']).default('active')
});

export type KnowledgeSourceMutationDTO = z.infer<
  typeof knowledgeSourceMutationSchema
>;
