import { z } from 'zod';

export const savePaychequeSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
  source_id: z.coerce.number().int().positive('Pick a source'),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/[,$]/g, '').trim())
    .refine(
      (v) => {
        const n = Number(v);
        return v !== '' && Number.isFinite(n) && n > 0 && n < 10_000_000;
      },
      { message: 'Amount must be between 0 and 10,000,000' }
    ),
  paid_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must look like 2026-11-08'),
  hours: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === null || v === undefined ? '' : String(v).trim()))
    .refine(
      (v) => {
        if (v === '') return true;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 && n < 1000;
      },
      { message: 'Hours must be between 0 and 1000' }
    ),
  note: z
    .string()
    .max(200, 'Note must be 200 characters or fewer')
    .optional()
    .default(''),
});

export const deletePaychequeSchema = z.object({
  id: z.coerce.number().int().positive('Invalid paycheque ID'),
});

export type SavePaychequeInput = z.input<typeof savePaychequeSchema>;

