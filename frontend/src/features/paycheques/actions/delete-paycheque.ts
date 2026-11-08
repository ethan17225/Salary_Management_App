'use server';

import { revalidatePath } from 'next/cache';
import { db, verifySession } from '@/lib/db';
import { deletePaychequeSchema } from '../schemas/paycheque-schema';
import type { ActionState } from '@/types/payday';

export async function deletePaychequeAction(rawInput: unknown): Promise<ActionState> {
  await verifySession();

  const parsed = deletePaychequeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid paycheque ID',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db.request('DELETE', `paycheques/${parsed.data.id}`);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete paycheque',
    };
  }
}

