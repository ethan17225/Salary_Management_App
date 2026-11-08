import { getPaychequesData, PaychequesView } from '@/features/paycheques';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PaychequesPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const data = await getPaychequesData();

  return (
    <PaychequesView
      data={data}
      filters={{
        year: typeof filters.year === 'string' ? filters.year : undefined,
        source: typeof filters.source === 'string' ? filters.source : undefined,
        q: typeof filters.q === 'string' ? filters.q : undefined,
      }}
    />
  );
}

