'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useOutsideClick } from '@/hooks/use-outside-click';
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
  const ddRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = useCallback(() => setOpen(false), []);
  useOutsideClick(ddRef, open, close);

  const isAll = activeYear === 'all';
  const displayValue = isAll ? 'All' : String(activeYear);

  const handleSelect = (val: string | number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, String(val));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ddRef}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-2.5 min-h-[44px] pl-4 pr-3.5 rounded-full border text-white font-sans font-medium text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.98]',
          open
            ? 'bg-white/16 border-white/40'
            : 'bg-white/9 border-white/20 hover:bg-white/15 hover:border-white/35'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Year: ${displayValue}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[13px] font-normal text-[#b9c8ce] pr-2.5 border-r border-white/16">
          Year
        </span>
        <span className="font-mono text-sm min-w-[36px] text-left">{displayValue}</span>
        <svg
          className={cn(
            'size-4 transition-transform duration-180',
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
          className="absolute top-[calc(100%+8px)] left-0 md:left-auto md:right-0 z-25 min-w-[224px] m-0 p-1.5 list-none bg-card text-ink border border-line rounded-[14px] shadow-[0_16px_40px_rgb(31_48_56/.22)] animate-pop"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map(([val, label, tot]) => {
            const selected = String(activeYear) === String(val);
            return (
              <li key={val}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'w-full min-h-[42px] py-2 px-3 rounded-[9px] flex items-center gap-2.5 cursor-pointer font-sans font-medium text-[15px] text-left transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
                    selected
                      ? 'bg-accent-soft text-accent-2'
                      : 'text-ink hover:bg-surface'
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
                    {fmt(tot)}
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

