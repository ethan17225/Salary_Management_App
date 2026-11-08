import { notFound } from 'next/navigation';
import { getSourceById, SourceDetailView } from '@/features/sources';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SourceDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const filters = await searchParams;
  const year = typeof filters.year === 'string' ? filters.year : undefined;
  const q = typeof filters.q === 'string' ? filters.q : undefined;

  const data = await getSourceById(Number(id), year);
  if (!data) notFound();

  return <SourceDetailView data={data} searchQuery={q} />;
}

