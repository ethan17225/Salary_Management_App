import { Skeleton } from '@/components/ui/skeleton';

export default function SourceDetailLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading source details…</span>
      <div className="flex items-center justify-between gap-4 min-h-[44px] mb-[18px]">
        <Skeleton className="h-9 w-28" />
        <div className="flex gap-2.5">
          <Skeleton className="h-11 w-28 rounded-[10px]" />
          <Skeleton className="h-11 w-36 rounded-[10px]" />
        </div>
      </div>

      <div className="rounded-[20px] bg-ink/90 p-7 min-h-[176px] flex flex-wrap justify-between gap-6">
        <div className="grid gap-3 flex-1 min-w-[240px]">
          <Skeleton className="h-5 w-48 bg-white/15" />
          <Skeleton className="h-14 w-60 max-w-full bg-white/15" />
          <Skeleton className="h-4 w-72 max-w-full bg-white/15" />
        </div>
        <div className="flex flex-col items-end justify-between gap-4">
          <Skeleton className="h-11 w-32 rounded-full bg-white/15" />
          <Skeleton className="h-4 w-40 bg-white/15" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card md:col-span-6 lg:col-span-3 grid gap-2.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>

      <div className="card mt-4 grid gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
