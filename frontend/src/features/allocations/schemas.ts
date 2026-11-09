import { z } from 'zod';

export const allocationRuleFormSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Bucket name is required')
    .max(50, 'Bucket name must be 50 characters or fewer'),
  category: z.enum(['essentials', 'investments', 'savings', 'lifestyle']),
  percentage: z.coerce
    .number()
    .min(0.01, 'Minimum allocation is 0.01%')
    .max(100, 'Maximum allocation is 100%'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid 6-digit hex color'),
  sort_order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export const allocationPresetSchema = z.object({
  preset: z.enum(['50-30-20', 'student-coop', 'aggressive-saver']),
});

