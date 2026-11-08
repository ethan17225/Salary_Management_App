'use server';

import { revalidatePath } from 'next/cache';
import { db, verifySession } from '@/lib/db';
import { updateGoalSchema } from '../schemas/goal-schema';
import type { ActionState } from '@/types/payday';

export async function updateGoalAction(rawInput: unknown): Promise<ActionState> {
  await verifySession();

  const parsed = updateGoalSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid goal input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await db.request('PUT', 'settings', { goal: parsed.data.goal });
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save goal',
    };
  }
}

