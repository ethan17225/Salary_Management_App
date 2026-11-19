import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading dashboard…</span>
      <div className="rounded-[20px] bg-ink/90 p-7 min-h-[176px] flex flex-wrap justify-between gap-6">
        <div className="grid gap-3 flex-1 min-w-[240px]">
          <Skeleton className="h-4 w-44 bg-white/15" />
          <Skeleton className="h-14 w-64 max-w-full bg-white/15" />
          <Skeleton className="h-4 w-72 max-w-full bg-white/15" />
        </div>
        <div className="flex flex-col items-end justify-between gap-4">
          <Skeleton className="h-11 w-32 rounded-full bg-white/15" />
          <Skeleton className="h-4 w-36 bg-white/15" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card md:col-span-6 lg:col-span-3 grid gap-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <div className="card md:col-span-12 lg:col-span-8 h-[390px] flex flex-col gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="flex-1 w-full rounded-xl" />
        </div>
        <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="card h-[185px] grid gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="card flex-1 min-h-[185px] grid gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
