'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDialogs } from '@/components/ui/dialog-provider';
import type { Source } from '@/types/payday';

export function SourceCardShell({
  source,
  children,
}: {
  source: Source;
  children: ReactNode;
}) {
  const router = useRouter();
  const { openSourceDialog } = useDialogs();
  const href = `/sources/${source.id}`;

  return (
    <article
      className="card src clickable group flex flex-col gap-[18px] md:col-span-6 lg:col-span-4 cursor-pointer transition-all duration-180 hover:-translate-y-0.5"
      style={{ '--c': source.color } as CSSProperties}
      onClick={() => router.push(href)}
    >
      {children}
      <div className="flex items-center justify-between gap-3 mt-auto pt-3.5 border-t border-line">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--c)"
          aria-label={`${source.name} — view source details`}
          onClick={(e) => e.stopPropagation()}
        >
          View details
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-180 group-hover:translate-x-[3px]"
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
          className="btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openSourceDialog(source);
          }}
        >
          Edit
        </button>
      </div>
    </article>
  );
}

