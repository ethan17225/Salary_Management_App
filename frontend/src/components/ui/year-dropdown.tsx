'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { fmt } from '@/lib/utils';

export type YearOption = [value: string | number, label: string, totalCents: number];

interface YearDropdownProps {
  activeYear: string | number;
  options: YearOption[];
  ariaLabel?: string;
  paramName?: string;
}

// ponytail: native <select> handles keyboard/Escape/ARIA; swap to custom popover only if multi-column rows are required.
export function YearDropdown({
  activeYear,
  options,
  ariaLabel = 'Select year',
  paramName = 'year',
}: YearDropdownProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, val);
    // ponytail: pushState + client-side year slicing avoids Next 15's aliased loading.tsx Suspense transition stall on search-param changes.
    window.history.pushState(null, '', `${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative inline-flex items-center min-h-[44px] pl-4 rounded-full border border-white/20 bg-white/9 hover:bg-white/15 hover:border-white/35 focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2 transition-[background-color,border-color] duration-150">
      <span
        className="text-[13px] font-normal text-[#b9c8ce] pr-2.5 border-r border-white/16 select-none pointer-events-none"
        aria-hidden="true"
      >
        Year
      </span>
      <select
        name={paramName}
        aria-label={ariaLabel}
        value={String(activeYear)}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none bg-transparent border-0 min-h-[44px] w-auto pl-3 pr-9 text-white font-mono text-sm cursor-pointer focus:outline-none"
      >
        {options.map(([val, label, tot]) => (
          <option key={val} value={String(val)} className="bg-card text-ink">
            {label} · Net {fmt(tot)}
          </option>
        ))}
      </select>
      <svg
        className="size-4 text-[#b9c8ce] pointer-events-none absolute right-3.5"
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
    </div>
  );
}
