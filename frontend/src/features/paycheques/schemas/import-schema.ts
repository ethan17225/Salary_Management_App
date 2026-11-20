import { z } from 'zod';

const AMOUNT_MSG = 'Use an amount like 1842.50';

const money = (missingMsg = AMOUNT_MSG) =>
  z
    .string({ invalid_type_error: missingMsg })
    .transform((v) => v.replace(/[$,\s]/g, ''))
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, AMOUNT_MSG));

const toCents = (v: string | null | undefined) => (v ? Math.round(Number(v) * 100) : 0);

// Shared by the review table (per-row status) and the server action (trust boundary).
// The backend re-validates everything in integer cents.
export const importRowSchema = z
  .object({
    source_name: z
      .string({ invalid_type_error: 'Pick a source' })
      .trim()
      .min(1, 'Pick a source')
      .max(60, 'Source name must be 60 characters or fewer'),
    paid_on: z
      .string({ invalid_type_error: 'Add the pay date' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Add the pay date'),
    amount: money('Add the take-home amount').refine((v) => Number(v) > 0, {
      message: 'Take-home must be more than 0',
    }),
    gross: money().nullable(),
    tax: money().nullable(),
    deductions: money().nullable(),
    hours: z.number().positive().lt(1000).nullable(),
    note: z.string().max(200, 'Note must be 200 characters or fewer').nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.gross === null) return;
    const netCents = toCents(data.amount);
    const grossCents = toCents(data.gross);
    const taxCents = toCents(data.tax);
    const dedCents = toCents(data.deductions);
    if (grossCents <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gross'],
        message: 'Gross must be more than 0',
      });
    } else if (grossCents < netCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gross'],
        message: 'Gross must be at least take-home',
      });
    } else if (taxCents + dedCents > grossCents - netCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gross'],
        message: 'Tax and deductions exceed gross minus take-home',
      });
    }
  });

export const importRowsSchema = z.object({
  rows: z.array(importRowSchema).min(1, 'Add at least one row').max(5000),
  auto_create_sources: z.boolean(),
});

type Nullable<T> = { [K in keyof T]: T[K] | null };

/** A candidate row from POST /api/paycheques/parse (money as decimal strings). */
export type ParsedRow = Nullable<z.input<typeof importRowSchema>> & {
  confidence: number;
  warnings: string[];
};

export interface ParseResponse {
  filename: string;
  detected_mime: string;
  parser_used: 'tabular' | 'pdf_text' | 'ocr';
  used_llm_fallback: boolean;
  rows: ParsedRow[];
  unmapped_columns: string[];
}
