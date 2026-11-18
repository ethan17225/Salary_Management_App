'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { allocationPresetSchema, allocationRuleFormSchema } from './schemas';
import type { ActionState } from '@/types/payday';

export async function saveAllocationRuleAction(
  rawInput: unknown
): Promise<ActionState<{ id?: number }>> {
  const parsed = allocationRuleFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid allocation rule',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, name, category, percentage, color, sort_order, active } = parsed.data;
  const weight_bps = Math.round(percentage * 100);

  try {
    const res = await db.request<{ id?: number }>(
      id ? 'PUT' : 'POST',
      id ? `allocations/${id}` : 'allocations',
      {
        name,
        category,
        weight_bps,
        color,
        sort_order,
        active: active ? 1 : 0,
      }
    );
    revalidatePath('/', 'layout');
    return { success: true, data: { id: res.id ?? id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save allocation rule',
    };
  }
}

export async function deleteAllocationRuleAction(id: number): Promise<ActionState> {
  try {
    await db.request('DELETE', `allocations/${id}`);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete allocation rule',
    };
  }
}

export async function applyAllocationPresetAction(
  rawPreset: unknown
): Promise<ActionState<{ count: number }>> {
  const payload = typeof rawPreset === 'string' ? { preset: rawPreset } : rawPreset;
  const parsed = allocationPresetSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid preset',
    };
  }

  try {
    const res = await db.request<{ count: number }>('POST', 'allocations/presets', {
      preset: parsed.data.preset,
    });
    revalidatePath('/', 'layout');
    return { success: true, data: { count: res.count } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to apply preset',
    };
  }
}

