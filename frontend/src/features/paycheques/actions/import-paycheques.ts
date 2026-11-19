'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import type { ActionState } from '@/types/payday';

export interface PaychequeImportResult {
  ok: boolean;
  imported_count: number;
  skipped_duplicates: number;
  created_sources: number;
  error_count: number;
  errors: Array<{ row: number; error: string }>;
}

export async function importPaychequesAction(input: {
  csv_text: string;
  auto_create_sources: boolean;
}): Promise<ActionState<PaychequeImportResult>> {
  const text = input.csv_text?.trim();
  if (!text) {
    return { success: false, error: 'Choose a non-empty CSV file to import.' };
  }

  try {
    const result = await db.request<PaychequeImportResult>('POST', 'paycheques/import', {
      csv_text: text,
      auto_create_sources: input.auto_create_sources,
    });
    revalidatePath('/', 'layout');
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to import CSV',
    };
  }
}
