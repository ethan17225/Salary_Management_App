'use client';

import Chart from 'chart.js/auto';
import { useEffect, useMemo, useRef } from 'react';
import { formatDollars, MONTHS, pad, shortCurrency, sumCents } from '@/lib/utils';
import type { Paycheque, Source } from '@/types/payday';

function configureChartDefaults() {
  const fontSans = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-sans')
    .trim();
  Chart.defaults.color = '#5d6e76';
  Chart.defaults.borderColor = '#e8edf0';
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.font.family = `${fontSans || "'Outfit'"}, system-ui, sans-serif`;
}

interface MonthlyChartProps {
  sources: Source[];
  inY: Paycheque[];
  bySrcEntries: [number, number][];
  isAll: boolean;
  activeYear: 'all' | number;
  timelineMonths: string[];
}

export function MonthlyIncomeChart({
  sources,
  inY,
  bySrcEntries,
  isAll,
  activeYear,
  timelineMonths,
}: MonthlyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bySrc = useMemo(() => new Map(bySrcEntries), [bySrcEntries]);

  useEffect(() => {
    if (!canvasRef.current) return;
    configureChartDefaults();
    const used = sources.filter((s) => bySrc.has(s.id));
    const monthKeys = isAll ? timelineMonths : MONTHS.map((_, m) => `${activeYear}-${pad(m + 1)}`);
    const monthLabels = isAll
      ? timelineMonths.map((ym) => `${MONTHS[+ym.slice(5, 7) - 1]} '${ym.slice(2, 4)}`)
      : [...MONTHS];

    const chart = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: used.map((s) => ({
          label: s.name,
          backgroundColor: s.color,
          borderRadius: 4,
          maxBarThickness: 46,
          data: monthKeys.map(
            (ym) =>
              sumCents(inY.filter((p) => p.source_id === s.id && p.paid_on.startsWith(ym))) / 100
          ),
        })),
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, border: { display: false }, ticks: { callback: shortCurrency } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: {
            filter: (i) => Number(i.raw) > 0,
            callbacks: {
              label: (c) => ` ${c.dataset.label || c.label}: ${formatDollars(Number(c.raw))}`,
              footer: (items) =>
                `Total ${formatDollars(items.reduce((t, i) => t + Number(i.raw), 0))}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [sources, inY, bySrc, isAll, activeYear, timelineMonths]);

  return (
    <div className="chart tall">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Stacked bar chart of income per month by source"
      />
    </div>
  );
}

interface CumulativeChartProps {
  paycheques: Paycheque[];
  inY: Paycheque[];
  isAll: boolean;
  isCur: boolean;
  activeYear: 'all' | number;
  timelineMonths: string[];
  today: string;
}

export function CumulativeIncomeChart({
  paycheques,
  inY,
  isAll,
  isCur,
  activeYear,
  timelineMonths,
  today,
}: CumulativeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    configureChartDefaults();
    const curMonth = today ? +today.slice(5, 7) - 1 : 11;
    const monthLabels = isAll
      ? timelineMonths.map((ym) => `${MONTHS[+ym.slice(5, 7) - 1]} '${ym.slice(2, 4)}`)
      : [...MONTHS];

    const run = (yr: number, stop: number) => {
      let t = 0;
      return MONTHS.map((_, m) => {
        if (m > stop) return null;
        t += sumCents(paycheques.filter((p) => p.paid_on.startsWith(`${yr}-${pad(m + 1)}`)));
        return t / 100;
      });
    };

    let allRun = 0;
    const cumData = isAll
      ? {
          labels: monthLabels,
          datasets: [
            {
              label: 'All-time cumulative',
              data: timelineMonths.map(
                (ym) => ((allRun += sumCents(inY.filter((p) => p.paid_on.startsWith(ym)))), allRun / 100)
              ),
              borderColor: '#0d7480',
              backgroundColor: 'rgba(13,116,128,.09)',
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2.5,
            },
          ],
        }
      : {
          labels: [...MONTHS],
          datasets: [
            {
              label: String(activeYear),
              data: run(activeYear as number, isCur ? curMonth : 11),
              borderColor: '#0d7480',
              backgroundColor: 'rgba(13,116,128,.09)',
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2.5,
            },
            {
              label: String((activeYear as number) - 1),
              data: run((activeYear as number) - 1, 11),
              borderColor: '#9aa8af',
              borderDash: [5, 4],
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
            },
          ],
        };

    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: cumData,
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false } },
          y: { border: { display: false }, ticks: { callback: shortCurrency } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label || c.label}: ${formatDollars(Number(c.raw))}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [paycheques, inY, isAll, isCur, activeYear, timelineMonths, today]);

  return (
    <div className="chart">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          isAll ? 'Cumulative income over time' : 'Running total compared with prior year'
        }
      />
    </div>
  );
}

interface SplitChartProps {
  sources: Source[];
  bySrcEntries: [number, number][];
  sumY: number;
}

export function SourceSplitChart({ sources, bySrcEntries, sumY }: SplitChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bySrc = useMemo(() => new Map(bySrcEntries), [bySrcEntries]);

  useEffect(() => {
    if (!canvasRef.current) return;
    configureChartDefaults();
    const used = sources.filter((s) => bySrc.has(s.id));

    const chart = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: used.map((s) => s.name),
        datasets: [
          {
            data: used.map((s) => (bySrc.get(s.id) || 0) / 100),
            backgroundColor: used.map((s) => s.color),
            borderColor: '#fff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        cutout: '66%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (c) =>
                ` ${formatDollars(Number(c.raw))} · ${
                  sumY ? Math.round((Number(c.raw) * 10000) / sumY) : 0
                }%`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [sources, bySrc, sumY]);

  return (
    <div className="chart">
      <canvas ref={canvasRef} role="img" aria-label="Share of income by source" />
    </div>
  );
}

