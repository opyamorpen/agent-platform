import { z } from 'zod';

export const createSkillGenerationSessionSchema = z.object({
  title: z.string().trim().max(120).optional()
});

export const addSkillGenerationMessageSchema = z.object({
  message: z.string().trim().min(1).max(20_000)
});

export const generateSkillDraftSchema = z.object({
  expectedRevision: z.number().int().nonnegative()
});

export const skillGenerationFileSchema = z.object({
  path: z.string().min(1).max(240),
  content: z.string()
});

export const updateSkillGenerationDraftSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  files: z.array(skillGenerationFileSchema).min(1).max(50)
});

export const publishSkillGenerationSessionSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  scriptReviewed: z.boolean().default(false)
});

export type SkillGenerationFileDTO = z.infer<typeof skillGenerationFileSchema>;
