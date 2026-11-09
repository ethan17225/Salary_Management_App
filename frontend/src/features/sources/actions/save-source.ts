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

  const {
    id,
    name,
    kind,
    color,
    archived,
    is_tax_withheld,
    tax_reserve_percent,
    expected_cadence_days,
    active_until,
    target_hourly,
  } = parsed.data;
  const tax_reserve_bps = is_tax_withheld ? 0 : Math.round(tax_reserve_percent * 100);
  const target_hourly_cents =
    target_hourly !== null && target_hourly !== undefined
      ? Math.round(target_hourly * 100)
      : null;

  try {
    const result = await db.request<{ id?: number }>(
      id ? 'PUT' : 'POST',
      id ? `sources/${id}` : 'sources',
      {
        name,
        kind,
        color,
        archived,
        is_tax_withheld: is_tax_withheld ? 1 : 0,
        tax_reserve_bps,
        expected_cadence_days,
        active_until,
        target_hourly_cents,
      }
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

