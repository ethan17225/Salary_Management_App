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
      className="card src clickable s4"
      style={{ '--c': source.color } as CSSProperties}
      onClick={() => router.push(href)}
    >
      {children}
      <div className="src-foot">
        <Link
          href={href}
          className="src-open"
          aria-label={`${source.name} — view source details`}
          onClick={(e) => e.stopPropagation()}
        >
          View details
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

