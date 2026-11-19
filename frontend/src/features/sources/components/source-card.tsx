'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useDialogs } from '@/components/ui/dialog-provider';
import type { Source } from '@/types/payday';

export function SourceCardShell({
  source,
  children,
}: {
  source: Source;
  children: ReactNode;
}) {
  const { openSourceDialog } = useDialogs();
  const href = `/sources/${source.id}`;

  return (
    <article
      className="card src clickable group relative flex flex-col gap-[18px] md:col-span-6 lg:col-span-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-accent"
      style={{ '--c': source.color } as CSSProperties}
    >
      {children}
      <div className="flex items-center justify-between gap-3 mt-auto pt-3.5 border-t border-line">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-ink no-underline after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none"
          aria-label={`${source.name} — view source details`}
        >
          <span className="size-2 rounded-full bg-(--c) shrink-0" aria-hidden="true" />
          View details
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:translate-x-[3px]"
          >
            <path
              d="M3.5 8h9M8.5 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <button
          className="btn relative z-10"
          type="button"
          onClick={() => openSourceDialog(source)}
          aria-label={`Edit ${source.name}`}
        >
          Edit
        </button>
      </div>
    </article>
  );
}
