import { AllocationsDashboard } from '@/features/allocations';
import { db } from '@/lib/db';
import { resolveYearFilter } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AllocationsPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const yearParam = typeof filters.year === 'string' ? filters.year : undefined;
  const state = await db.getState();
  const { activeYear, inY, yearOptions } = resolveYearFilter(state.paycheques, yearParam);

  return (
    <AllocationsDashboard
      rules={state.allocations ?? []}
      paycheques={inY}
      sources={state.sources}
      activeYear={activeYear}
      yearOptions={yearOptions}
    />
  );
}

