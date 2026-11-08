import { z } from 'zod';

export const saveSourceSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name must be 60 characters or fewer'),
  kind: z.enum(['job', 'government', 'other']).default('job'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #0d7480')
    .default('#0d7480'),
  archived: z.boolean().optional().default(false),
});

export const deleteSourceSchema = z.object({
  id: z.coerce.number().int().positive('Invalid source ID'),
});

export type SaveSourceInput = z.input<typeof saveSourceSchema>;

