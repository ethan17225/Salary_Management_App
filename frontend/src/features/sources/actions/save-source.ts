'use server';

import { revalidatePath } from 'next/cache';
import { db, verifySession } from '@/lib/db';
import { saveSourceSchema } from '../schemas/source-schema';
import type { ActionState } from '@/types/payday';

export async function saveSourceAction(
  rawInput: unknown
): Promise<ActionState<{ id?: number }>> {
  await verifySession();

  const parsed = saveSourceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid source data',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, name, kind, color, archived } = parsed.data;

  try {
    const result = await db.request<{ id?: number }>(
      id ? 'PUT' : 'POST',
      id ? `sources/${id}` : 'sources',
      { name, kind, color, archived }
    );
    revalidatePath('/', 'layout');
    return { success: true, data: { id: result.id ?? id ?? undefined } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save source',
    };
  }
}

