import { getImportLogs, ImportLogsView } from '@/features/paycheques';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ImportLogsPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const logs = await getImportLogs();

  return (
    <ImportLogsView
      logs={logs}
      initialFilters={{
        stage: typeof filters.stage === 'string' ? filters.stage : undefined,
        status: typeof filters.status === 'string' ? filters.status : undefined,
        parser: typeof filters.parser === 'string' ? filters.parser : undefined,
        warnings: typeof filters.warnings === 'string' ? filters.warnings : undefined,
        q: typeof filters.q === 'string' ? filters.q : undefined,
        year: typeof filters.year === 'string' ? filters.year : undefined,
      }}
    />
  );
}
