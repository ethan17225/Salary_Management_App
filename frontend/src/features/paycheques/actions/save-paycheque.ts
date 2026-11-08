'use server';

import { revalidatePath } from 'next/cache';
import { db, verifySession } from '@/lib/db';
import { savePaychequeSchema } from '../schemas/paycheque-schema';
import type { ActionState } from '@/types/payday';

export async function savePaychequeAction(
  rawInput: unknown
): Promise<ActionState<{ id?: number }>> {
  await verifySession();

  const parsed = savePaychequeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid paycheque data',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, source_id, amount, paid_on, hours, note } = parsed.data;

  try {
    const result = await db.request<{ id?: number }>(
      id ? 'PUT' : 'POST',
      id ? `paycheques/${id}` : 'paycheques',
      {
        source_id,
        amount,
        paid_on,
        hours: hours === '' ? null : Number(hours),
        note,
      }
    );
    revalidatePath('/', 'layout');
    return { success: true, data: { id: result.id ?? id ?? undefined } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save paycheque',
    };
  }
}

