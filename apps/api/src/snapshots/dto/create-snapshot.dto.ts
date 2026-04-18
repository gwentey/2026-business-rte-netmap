import { z } from 'zod';

export const createSnapshotSchema = z.object({
  label: z.string().trim().min(1).max(200),
  envName: z.string().trim().min(1).max(50),
});

export type CreateSnapshotDto = z.infer<typeof createSnapshotSchema>;
