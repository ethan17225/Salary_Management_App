import { TaxesDashboard } from '@/features/taxes';
import { db } from '@/lib/db';
import { iso, sumCents } from '@/lib/utils';
import type { YearOption } from '@/components/ui/year-dropdown';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TaxesPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const yearParam = typeof filters.year === 'string' ? filters.year : undefined;

  const state = await db.getState();
  const curYear = +iso(new Date()).slice(0, 4);

  const yearsSet = new Set(state.paycheques.map((p) => +p.paid_on.slice(0, 4)));
  yearsSet.add(curYear);
  const years = [...yearsSet].sort((a, b) => b - a);

  let activeYear: 'all' | number = curYear;
  if (yearParam === 'all') {
    activeYear = 'all';
  } else if (yearParam && /^\d{4}$/.test(yearParam)) {
    activeYear = Number(yearParam);
  }

  const inY =
    activeYear === 'all'
      ? state.paycheques
      : state.paycheques.filter((p) => p.paid_on.startsWith(`${activeYear}-`));

  const yearOptions: YearOption[] = [
    ['all', 'All', sumCents(state.paycheques)],
    ...years.map(
      (y): YearOption => [
        y,
        String(y),
        sumCents(state.paycheques.filter((p) => p.paid_on.startsWith(`${y}-`))),
      ]
    ),
  ];

  return (
    <TaxesDashboard
      paycheques={inY}
      sources={state.sources}
      activeYear={activeYear}
      yearOptions={yearOptions}
    />
  );
}

