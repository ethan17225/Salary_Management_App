'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import type { ActionState } from '@/types/payday';
import { importRowsSchema, type ParsedRow } from '../schemas/import-schema';

export interface PaychequeImportResult {
  ok: boolean;
  imported_count: number;
  skipped_duplicates: number;
  created_sources: number;
  error_count: number;
  errors: Array<{ row: number; error: string }>;
}

export async function importPaychequesAction(input: {
  rows: ParsedRow[];
  auto_create_sources: boolean;
}): Promise<ActionState<PaychequeImportResult>> {
  const parsed = importRowsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Fix the flagged rows.' };
  }

  try {
    const result = await db.request<PaychequeImportResult>(
      'POST',
      'paycheques/import',
      parsed.data
    );
    revalidatePath('/', 'layout');
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Import failed. Try again.',
    };
  }
}
