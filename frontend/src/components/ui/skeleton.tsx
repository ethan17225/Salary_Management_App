import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg bg-surface motion-safe:animate-pulse', className)}
      aria-hidden="true"
    />
  );
}
