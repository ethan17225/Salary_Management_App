'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDialogs } from '@/components/ui/dialog-provider';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', match: (p: string) => p === '/' },
  { href: '/paycheques', label: 'Paycheques', match: (p: string) => p.startsWith('/paycheques') },
  { href: '/sources', label: 'Sources', match: (p: string) => p.startsWith('/sources') },
] as const;

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
      if (h === 'overview') {
        router.replace('/');
        return;
      }
      if (h === 'paycheques') {
        router.replace('/paycheques');
        return;
      }
      if (h === 'sources') {
        router.replace('/sources');
        return;
      }
      const m = h.match(/^source\/(\d+)$/);
      if (m) {
        router.replace(`/sources/${m[1]}`);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [router, openPaychequeDialog, activeSourceId]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <div className="wrap top-in">
          <Link className="brand" href="/">
            <span className="mark" aria-hidden="true">
              P
            </span>
            Payday
          </Link>
          <nav className="tabs" aria-label="Sections">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.match(pathname) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            className="btn primary"
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

