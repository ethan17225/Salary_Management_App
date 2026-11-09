import { z } from 'zod';

const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const num = Number(String(val).replace(/[$,]/g, ''));
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : Number.NaN;
  })
  .refine((val) => val === null || (!Number.isNaN(val) && val > 0), {
    message: 'Target hourly rate must be greater than zero',
  });

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
  is_tax_withheld: z.boolean().default(true),
  tax_reserve_percent: z.coerce
    .number()
    .min(0, 'Reserve % cannot be negative')
    .max(60, 'Reserve % cannot exceed 60%')
    .default(0),
  expected_cadence_days: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).max(366).nullable().default(null)
  ),
  active_until: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : String(v).trim()),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
      .nullable()
      .default(null)
  ),
  target_hourly: optionalMoneySchema.optional().default(null),
});

export const deleteSourceSchema = z.object({
  id: z.coerce.number().int().positive('Invalid source ID'),
});

export type SaveSourceInput = z.input<typeof saveSourceSchema>;

