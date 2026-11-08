'use server';

import { revalidatePath } from 'next/cache';
import { db, verifySession } from '@/lib/db';
import { deleteSourceSchema } from '../schemas/source-schema';
import type { ActionState } from '@/types/payday';

export async function deleteSourceAction(rawInput: unknown): Promise<ActionState> {
  await verifySession();

  const parsed = deleteSourceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid source ID',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db.request('DELETE', `sources/${parsed.data.id}`);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete source',
    };
  }
}

