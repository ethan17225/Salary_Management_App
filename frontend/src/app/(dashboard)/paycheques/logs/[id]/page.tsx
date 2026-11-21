import { notFound } from 'next/navigation';
import { getImportLogById, ImportLogDetailView } from '@/features/paycheques';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ImportLogDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const filters = await searchParams;

  if (!/^\d+$/.test(id)) notFound();
  const numId = Number(id);
  if (!Number.isSafeInteger(numId) || numId <= 0) notFound();

  const log = await getImportLogById(numId);
  if (!log) notFound();

  return (
    <ImportLogDetailView
      log={log}
      yearParam={typeof filters.year === 'string' ? filters.year : undefined}
    />
  );
}
