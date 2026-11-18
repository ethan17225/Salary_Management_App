'use client';

import { Chart } from 'chart.js';
import { useEffect, useRef } from 'react';
import {
  configureChartDefaults,
  getChartMonths,
} from '@/features/overview/components/overview-charts';
import { formatDollars, plural, shortCurrency, sumCents } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

interface SourceIncomeChartProps {
  source: Source;
  srcPs: Paycheque[];
  srcIsAll: boolean;
  srcYear: 'all' | number;
  srcTimeline: string[];
}

export function SourceIncomeChart({
  source,
  srcPs,
  srcIsAll,
  srcYear,
  srcTimeline,
}: SourceIncomeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    configureChartDefaults();
    const { monthKeys, monthLabels } = getChartMonths(srcIsAll, srcYear, srcTimeline);
    const monthBuckets = monthKeys.map((ym) => srcPs.filter((p) => p.paid_on.startsWith(ym)));

    const chart = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: source.name,
            backgroundColor: source.color,
            borderRadius: 5,
            maxBarThickness: 44,
            data: monthBuckets.map((ps) => sumCents(ps) / 100),
          },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false } },
          y: { border: { display: false }, ticks: { callback: shortCurrency } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => ` ${formatDollars(Number(c.raw))}`,
              afterLabel: (c) => {
                const ps = monthBuckets[c.dataIndex] || [];
                if (!ps.length) return '';
                const h = ps.reduce((t, p) => t + (p.hours || 0), 0);
                return ` ${plural(ps.length, 'paycheque')}${h ? ` · ${+h.toFixed(2)} h` : ''}`;
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [source, srcPs, srcIsAll, srcYear, srcTimeline]);

  return (
    <div className="chart tall">
      <canvas ref={canvasRef} role="img" aria-label={`Monthly income chart for ${source.name}`} />
    </div>
  );
}

