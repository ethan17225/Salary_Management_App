import { getOverviewData, OverviewDashboard } from '@/features/overview';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function OverviewPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const year = typeof filters.year === 'string' ? filters.year : undefined;
  const data = await getOverviewData(year);

  return <OverviewDashboard data={data} />;
}

