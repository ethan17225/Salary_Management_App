'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDialogs } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', keepYear: true, match: (p: string) => p === '/' },
  {
    href: '/paycheques',
    label: 'Paycheques',
    keepYear: true,
    match: (p: string) => p.startsWith('/paycheques'),
  },
  { href: '/taxes', label: 'Taxes', keepYear: true, match: (p: string) => p.startsWith('/taxes') },
  {
    href: '/allocations',
    label: 'Allocations',
    keepYear: true,
    match: (p: string) => p.startsWith('/allocations'),
  },
  {
    href: '/sources',
    label: 'Sources',
    keepYear: false,
    match: (p: string) => p.startsWith('/sources'),
  },
] as const;

const HASH_ROUTES: Record<string, string> = {
  overview: '/',
  paycheques: '/paycheques',
  taxes: '/taxes',
  allocations: '/allocations',
  sources: '/sources',
};

function withYearParam(href: string, yearParam: string | null): string {
  if (!yearParam) return href;
  return `${href}?year=${encodeURIComponent(yearParam)}`;
}

function NavLinks({
  pathname,
  yearParam,
}: {
  pathname: string;
  yearParam: string | null;
}) {
  return (
    // ponytail: CSS horizontal scroll on <md; switch to fixed bottom tab bar if mobile usage dominates.
    <nav
      className="order-3 md:order-none w-full md:w-auto flex gap-1 overflow-x-auto whitespace-nowrap -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible"
      aria-label="Sections"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const targetHref = item.keepYear ? withYearParam(item.href, yearParam) : item.href;
        return (
          <Link
            key={item.href}
            href={targetHref}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 md:flex-initial inline-flex items-center justify-center min-h-[44px] px-3.5 md:px-4 rounded-full font-medium no-underline transition-colors duration-150',
              active ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-surface'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function NavbarSearchParamsSync({
  pathname,
  activeSourceId,
}: {
  pathname: string;
  activeSourceId: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openPaychequeDialog } = useDialogs();
  const yearParam = searchParams.get('year');

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
        const dest =
          HASH_ROUTES[h] === '/sources'
            ? HASH_ROUTES[h]
            : withYearParam(HASH_ROUTES[h], yearParam);
        router.replace(dest);
        return;
      }
      const m = h.match(/^source\/(\d+)$/);
      if (m) router.replace(`/sources/${m[1]}`);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [router, openPaychequeDialog, activeSourceId, yearParam]);

  return <NavLinks pathname={pathname} yearParam={yearParam} />;
}

export function Navbar() {
  const pathname = usePathname();
  const { openPaychequeDialog } = useDialogs();

  const sourceMatch = pathname.match(/^\/sources\/(\d+)/);
  const activeSourceId = sourceMatch ? Number(sourceMatch[1]) : null;

  return (
    <>
      <a
        className="absolute left-3 top-3 -translate-y-24 focus:translate-y-0 z-50 bg-ink text-white px-4 py-2.5 rounded-lg transition-transform duration-150"
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
          <Suspense fallback={<NavLinks pathname={pathname} yearParam={null} />}>
            <NavbarSearchParamsSync pathname={pathname} activeSourceId={activeSourceId} />
          </Suspense>
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
