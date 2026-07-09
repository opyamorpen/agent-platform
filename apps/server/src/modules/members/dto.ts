import { z } from 'zod';

export const createAppMemberSchema = z.object({
  userUUID: z.string().trim().min(1, 'userUUID is required'),
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().email().optional().nullable(),
  staffID: z.string().trim().optional().nullable()
});
