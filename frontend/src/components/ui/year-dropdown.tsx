'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn, fmt } from '@/lib/utils';

export type YearOption = [value: string | number, label: string, totalCents: number];

interface YearDropdownProps {
  activeYear: string | number;
  options: YearOption[];
  ariaLabel?: string;
  paramName?: string;
}

export function YearDropdown({
  activeYear,
  options,
  ariaLabel = 'Select year',
  paramName = 'year',
}: YearDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const displayValue = activeYear === 'all' ? 'All' : String(activeYear);
  const activeOption = options.find(([val]) => String(val) === String(activeYear));
  const activeSummary = activeOption ? `${activeOption[1]} · Net ${fmt(activeOption[2])}` : displayValue;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex(([val]) => String(val) === String(activeYear))
    );
    const raf = requestAnimationFrame(() => optionRefs.current[idx]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, activeYear, options]);

  const handleSelect = (val: string | number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, String(val));
    // ponytail: pushState + client-side year slicing avoids Next 15's aliased loading.tsx Suspense transition stall on search-param changes.
    window.history.pushState(null, '', `${pathname}?${params.toString()}`);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const items = optionRefs.current.filter(Boolean) as HTMLButtonElement[];
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full sm:w-auto min-w-[232px]" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'w-full inline-flex items-center gap-2.5 min-h-[44px] pl-4 pr-3.5 rounded-full border text-white font-sans font-medium text-[15px] cursor-pointer transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]',
          open
            ? 'bg-white/16 border-white/40'
            : 'bg-white/9 border-white/20 hover:bg-white/15 hover:border-white/35'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`Year: ${activeSummary}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[13px] font-normal text-[#b9c8ce] pr-2.5 border-r border-white/16">
          Year
        </span>
        <span className="font-mono text-sm text-left whitespace-nowrap">{activeSummary}</span>
        <svg
          className={cn(
            'size-4 ml-auto transition-transform duration-150',
            open ? 'rotate-180 text-white' : 'text-[#b9c8ce]'
          )}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul
          id={listboxId}
          className="absolute top-[calc(100%+8px)] left-0 w-full z-25 m-0 p-1.5 list-none bg-card text-ink border border-line rounded-[14px] shadow-[0_16px_40px_rgb(31_48_56/.22)] origin-top animate-pop"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map(([val, label, tot], i) => {
            const selected = String(activeYear) === String(val);
            return (
              <li key={val} role="none">
                <button
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'w-full min-h-[42px] py-2 px-3 rounded-[9px] flex items-center gap-2.5 cursor-pointer font-sans font-medium text-[15px] text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
                    selected ? 'bg-accent-soft text-accent-2' : 'text-ink hover:bg-surface'
                  )}
                  onClick={() => handleSelect(val)}
                >
                  <svg
                    className={cn(
                      'size-4 text-accent shrink-0',
                      selected ? 'opacity-100' : 'opacity-0'
                    )}
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{label}</span>
                  <span
                    className={cn(
                      'num ml-auto text-[13px] font-normal',
                      selected ? 'text-accent-2' : 'text-muted'
                    )}
                  >
                    Net {fmt(tot)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
