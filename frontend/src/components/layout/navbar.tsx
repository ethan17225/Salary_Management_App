'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDialogs } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', match: (p: string) => p === '/' },
  { href: '/paycheques', label: 'Paycheques', match: (p: string) => p.startsWith('/paycheques') },
  { href: '/taxes', label: 'Taxes', match: (p: string) => p.startsWith('/taxes') },
  { href: '/allocations', label: 'Allocations', match: (p: string) => p.startsWith('/allocations') },
  { href: '/sources', label: 'Sources', match: (p: string) => p.startsWith('/sources') },
] as const;

const HASH_ROUTES: Record<string, string> = {
  overview: '/',
  paycheques: '/paycheques',
  taxes: '/taxes',
  allocations: '/allocations',
  sources: '/sources',
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openPaychequeDialog } = useDialogs();

  const sourceMatch = pathname.match(/^\/sources\/(\d+)/);
  const activeSourceId = sourceMatch ? Number(sourceMatch[1]) : null;

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.slice(1);
      if (!h) return;
      if (h === 'add') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        openPaychequeDialog(null, activeSourceId);
        return;
      }
      if (HASH_ROUTES[h]) {
        router.replace(HASH_ROUTES[h]);
        return;
      }
      const m = h.match(/^source\/(\d+)$/);
      if (m) router.replace(`/sources/${m[1]}`);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [router, openPaychequeDialog, activeSourceId]);

  return (
    <>
      <a
        className="absolute left-3 -top-20 focus:top-3 z-50 bg-ink text-white px-4 py-2.5 rounded transition-[top]"
        href="#main"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur-md border-b border-line">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 md:gap-7 min-h-[68px] py-2.5 md:py-0">
          <Link
            className="flex items-center gap-2.5 font-semibold text-[19px] tracking-[-0.02em] text-inherit no-underline"
            href="/"
          >
            <span
              className="size-7 rounded-lg bg-accent text-white grid place-items-center text-[15px]"
              aria-hidden="true"
            >
              P
            </span>
            Payday
          </Link>
          <nav
            className="order-3 md:order-none w-full md:w-auto flex gap-1"
            aria-label="Sections"
          >
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex-1 md:flex-initial inline-flex items-center justify-center min-h-[44px] px-2 md:px-4 rounded-full font-medium no-underline transition-colors duration-150',
                    active ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-surface'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            className="btn primary ml-auto"
            type="button"
            onClick={() => openPaychequeDialog(null, activeSourceId)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Add paycheque
          </button>
        </div>
      </header>
    </>
  );
}

