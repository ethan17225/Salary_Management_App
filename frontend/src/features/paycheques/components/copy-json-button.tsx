'use client';

import { useState } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';

export function CopyJsonButton({
  value,
  label = 'Copy JSON',
  className,
}: {
  value: unknown;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useDialogs();

  async function handleCopy() {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('Could not copy to clipboard');
    }
  }

  return (
    <button
      type="button"
      className={cn('btn min-h-[40px] px-3.5 text-sm', className)}
      onClick={() => void handleCopy()}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
