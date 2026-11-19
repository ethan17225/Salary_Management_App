import { AllocationsDashboard } from '@/features/allocations';
import { db } from '@/lib/db';
import { iso } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AllocationsPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const yearParam = typeof filters.year === 'string' ? filters.year : undefined;
  const state = await db.getState();

  return (
    <AllocationsDashboard
      rules={state.allocations ?? []}
      paycheques={state.paycheques}
      sources={state.sources}
      initialYear={yearParam}
      today={iso(new Date())}
    />
  );
}

