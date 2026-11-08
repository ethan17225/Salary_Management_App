import { getSourcesData, SourceGrid } from '@/features/sources';

export default async function SourcesPage() {
  const summaries = await getSourcesData();

  return <SourceGrid summaries={summaries} />;
}

