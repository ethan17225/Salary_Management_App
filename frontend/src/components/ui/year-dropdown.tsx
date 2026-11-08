'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { fmt } from '@/lib/utils';

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
    <div className="year-dd" ref={ddRef}>
      <button
        type="button"
        className="year-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Year: ${displayValue}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="year-lbl">Year</span>
        <span className="year-val">{displayValue}</span>
        <svg className="year-chev" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
        <ul className="year-menu" role="listbox" aria-label={ariaLabel}>
          {options.map(([val, label, tot]) => {
            const selected = String(activeYear) === String(val);
            return (
              <li key={val}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'year-opt active' : 'year-opt'}
                  onClick={() => handleSelect(val)}
                >
                  <svg className="year-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{label}</span>
                  <span className="num">{fmt(tot)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

