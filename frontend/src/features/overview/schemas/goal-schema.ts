import { z } from 'zod';

export const updateGoalSchema = z.object({
  goal: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return '';
      return String(val).trim();
    })
    .refine(
      (val) => {
        if (val === '') return true;
        const n = Number(val.replace(/[,$]/g, ''));
        return Number.isFinite(n) && n > 0 && n < 10_000_000;
      },
      { message: 'Goal must be between 0 and 10,000,000' }
    ),
});

export type UpdateGoalInput = z.input<typeof updateGoalSchema>;

