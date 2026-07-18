import { z } from 'zod';

export const createAssetOptimizationRunSchema = z.object({
  agentUUID: z.string().trim().min(1).max(64)
});

export const mutateAssetCandidateSchema = z.object({
  expectedUpdatedAt: z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
  scriptReviewed: z.boolean().default(false)
});

export const dismissAssetCandidateSchema = z.object({
  expectedUpdatedAt: z
    .string()
    .datetime()
    .transform((value) => new Date(value))
});

export const createShadowReplaySchema = z.object({
  candidateUUID: z.string().trim().min(1).max(64)
});
