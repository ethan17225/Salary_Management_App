'use client';

import type { CSSProperties, ReactNode } from 'react';
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
  const goDetail = () => router.push(`/sources/${source.id}`);

  return (
    <article
      className="card src clickable s4"
      style={{ '--c': source.color } as CSSProperties}
      role="link"
      tabIndex={0}
      aria-label={`${source.name} — view source details`}
      onClick={goDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goDetail();
        }
      }}
    >
      {children}
      <div className="src-foot">
        <span className="src-open">
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
        </span>
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

