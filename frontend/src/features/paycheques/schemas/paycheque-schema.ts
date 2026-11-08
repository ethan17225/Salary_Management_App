import { z } from 'zod';

const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const num = Number(String(val).replace(/[$,]/g, ''));
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : Number.NaN;
  })
  .refine((val) => val === null || (!Number.isNaN(val) && val >= 0), {
    message: 'Must be a valid non-negative dollar amount',
  });

export const savePaychequeSchema = z
  .object({
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
    gross: optionalMoneySchema.optional().default(null),
    tax: optionalMoneySchema.optional().default(null),
    deductions: optionalMoneySchema.optional().default(null),
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
  })
  .superRefine((data, ctx) => {
    const net = Number(data.amount);
    if (data.gross !== null && data.gross < net) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gross'],
        message: 'Gross pay must be at least equal to net take-home pay.',
      });
    }
    if (
      data.gross !== null &&
      (data.tax ?? 0) + (data.deductions ?? 0) > Number((data.gross - net).toFixed(2))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gross'],
        message: 'Taxes + deductions cannot exceed (Gross - Net).',
      });
    }
  });

export const deletePaychequeSchema = z.object({
  id: z.coerce.number().int().positive('Invalid paycheque ID'),
});

export type SavePaychequeInput = z.input<typeof savePaychequeSchema>;

