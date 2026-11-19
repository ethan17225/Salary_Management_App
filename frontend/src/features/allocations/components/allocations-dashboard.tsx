'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { YearDropdown, type YearOption } from '@/components/ui/year-dropdown';
import {
  allocateCentsLargestRemainder,
  computeAggregateAllocations,
  type AllocationCategory,
  type AllocationRule,
} from '@/lib/allocation-engine';
import { cn, fmt, plural, SOURCE_COLORS } from '@/lib/utils';
import {
  applyAllocationPresetAction,
  deleteAllocationRuleAction,
  saveAllocationRuleAction,
} from '../actions';
import type { Paycheque, Source } from '@/types/payday';

const CATEGORY_LABELS: Record<AllocationCategory, string> = {
  essentials: 'Essentials',
  investments: 'Investments',
  savings: 'Savings',
  lifestyle: 'Lifestyle',
};

const PRESET_CARDS = [
  {
    id: '50-30-20',
    title: '50 / 30 / 20 Balanced',
    desc: '50% Essentials · 20% Investments · 30% Lifestyle',
  },
  {
    id: 'student-coop',
    title: 'Co-op / Student Plan',
    desc: '50% Tuition & Rent · 25% TFSA/FHSA · 10% Emergency · 15% Campus/Fun',
  },
  {
    id: 'aggressive-saver',
    title: 'Aggressive Wealth Builder',
    desc: '45% Portfolio · 35% Fixed Costs · 10% Cash Reserve · 10% Fun',
  },
] as const;

interface AllocationsDashboardProps {
  rules: AllocationRule[];
  paycheques: Paycheque[];
  sources: Source[];
  activeYear: 'all' | number;
  yearOptions: YearOption[];
}

export function AllocationsDashboard({
  rules,
  paycheques,
  sources,
  activeYear,
  yearOptions,
}: AllocationsDashboardProps) {
  const { toast } = useDialogs();
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const sourcesById = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources]
  );

  const report = useMemo(
    () => computeAggregateAllocations(paycheques, rules, sourcesById),
    [paycheques, rules, sourcesById]
  );

  const [formState, setFormState] = useState<{
    id?: number;
    name: string;
    category: AllocationCategory;
    percentage: string;
    color: string;
    sort_order: number;
    active: boolean;
  }>({
    name: '',
    category: 'investments',
    percentage: '20',
    color: SOURCE_COLORS[0],
    sort_order: 1,
    active: true,
  });
  const [formErr, setFormErr] = useState('');
  const [pending, setPending] = useState<'save' | 'preset' | number | null>(null);

  // Simulator state
  const latestAmount = paycheques[0]?.amount_cents
    ? (paycheques[0].amount_cents / 100).toFixed(2)
    : '1500.00';
  const [simMode, setSimMode] = useState<'direct' | 'hourly'>('direct');
  const [simDirect, setSimDirect] = useState(latestAmount);
  const [simHourly, setSimHourly] = useState('28.50');
  const [simHours, setSimHours] = useState('80');

  useEffect(() => {
    setSimDirect(latestAmount);
  }, [latestAmount]);

  const simCents = useMemo(() => {
    if (simMode === 'direct') {
      const n = Number(simDirect.replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
    }
    const rate = Number(simHourly.replace(/[^0-9.]/g, ''));
    const hrs = Number(simHours.replace(/[^0-9.]/g, ''));
    return Number.isFinite(rate) && Number.isFinite(hrs) && rate > 0 && hrs > 0
      ? Math.round(rate * hrs * 100)
      : 0;
  }, [simMode, simDirect, simHourly, simHours]);

  const simSplit = useMemo(
    () => allocateCentsLargestRemainder(simCents, rules),
    [simCents, rules]
  );

  const otherActiveBps = useMemo(() => {
    return rules
      .filter((r) => Boolean(r.active) && r.id !== formState.id)
      .reduce((s, r) => s + r.weight_bps, 0);
  }, [rules, formState.id]);

  const remainingPct = Math.max(0, (10000 - otherActiveBps) / 100);

  function openRuleModal(rule?: AllocationRule) {
    setFormErr('');
    if (rule) {
      setFormState({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        percentage: (rule.weight_bps / 100).toString(),
        color: rule.color,
        sort_order: rule.sort_order,
        active: Boolean(rule.active),
      });
    } else {
      const nextColor =
        SOURCE_COLORS.find((c) => !rules.some((r) => r.color === c)) ?? SOURCE_COLORS[0];
      const availBps = Math.max(0, 10000 - report.totalActiveBps);
      const defaultPct = availBps > 0 ? Math.min(20, availBps / 100) : 10;
      setFormState({
        id: undefined,
        name: '',
        category: 'investments',
        percentage: String(defaultPct),
        color: nextColor,
        sort_order: rules.length + 1,
        active: availBps > 0,
      });
    }
    if (!dlgRef.current?.open) {
      dlgRef.current?.showModal();
    }
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  async function handleSaveRule(e: FormEvent) {
    e.preventDefault();
    if (pending !== null) return;
    setPending('save');
    try {
      const res = await saveAllocationRuleAction({
        ...formState,
        percentage: Number(formState.percentage),
      });
      if (!res.success) {
        setFormErr(res.error);
        return;
      }
      dlgRef.current?.close();
      toast(formState.id ? 'Bucket updated' : `Added ${formState.name}`);
    } finally {
      setPending(null);
    }
  }

  async function handleToggleActive(rule: AllocationRule) {
    if (pending !== null) return;
    setPending(rule.id);
    try {
      const nextActive = !rule.active;
      const res = await saveAllocationRuleAction({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        percentage: rule.weight_bps / 100,
        color: rule.color,
        sort_order: rule.sort_order,
        active: nextActive,
      });
      if (!res.success) {
        toast(res.error);
        return;
      }
      toast(nextActive ? `Activated ${rule.name}` : `Paused ${rule.name}`);
    } finally {
      setPending(null);
    }
  }

  async function handleDeleteRule(rule: AllocationRule) {
    if (pending !== null) return;
    setPending(rule.id);
    try {
      const res = await deleteAllocationRuleAction(rule.id);
      if (!res.success) {
        toast(res.error);
        return;
      }
      toast(`Deleted ${rule.name}`, async () => {
        const restore = await saveAllocationRuleAction({
          name: rule.name,
          category: rule.category,
          percentage: rule.weight_bps / 100,
          color: rule.color,
          sort_order: rule.sort_order,
          active: Boolean(rule.active),
        });
        if (!restore.success) {
          throw new Error(restore.error);
        }
        toast('Bucket restored');
      });
    } finally {
      setPending(null);
    }
  }

  async function handleApplyPreset(presetId: string) {
    const preset = PRESET_CARDS.find((p) => p.id === presetId);
    // ponytail: native window.confirm() guards preset overwrite; add preview dialog + snapshot undo if needed.
    if (
      rules.length > 0 &&
      !window.confirm(
        `Replace your ${rules.length} custom buckets with "${preset?.title ?? presetId}"?`
      )
    ) {
      return;
    }
    if (pending !== null) return;
    setPending('preset');
    try {
      const res = await applyAllocationPresetAction(presetId);
      if (!res.success) {
        toast(res.error);
        return;
      }
      toast('Applied allocation preset');
    } finally {
      setPending(null);
    }
  }

  const bucketSummaryById = useMemo(
    () => new Map(report.buckets.map((b) => [b.rule_id, b])),
    [report.buckets]
  );

  return (
    <section>
      <div className="hero animate-enter">
        <div>
          <h1 className="text-[15px] font-medium text-[#b9c8ce]">
            {activeYear === 'all'
              ? 'Allocated across all years'
              : `Allocated in ${activeYear}`}
          </h1>
          <p className="num text-[clamp(2.75rem,7vw,5.25rem)] leading-[1.05] tracking-[-0.04em] mt-1.5 mb-2.5">
            {fmt(report.totalAllocatedCents)}
          </p>
          <p className="text-[#b9c8ce] text-[15px]">
            <b className="font-medium text-[#6fe0b0]">
              {(report.totalActiveBps / 100).toFixed(1)}% configured
            </b>{' '}
            · {fmt(report.totalUnallocatedCents)} unallocated cash buffer across{' '}
            {plural(report.paychequeCount, 'paycheque')}
            {report.totalTaxReserveCents > 0
              ? ` (after ${fmt(report.totalTaxReserveCents)} tax reserve)`
              : ''}
          </p>
        </div>
        <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-4 w-full md:w-auto flex-wrap">
          <YearDropdown activeYear={activeYear} options={yearOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-12">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3.5">
            <div>
              <h2 className="text-base font-medium tracking-[-0.01em]">
                Pay Yourself First Rules
              </h2>
              <p className="text-sm text-muted">
                Automatically divide each paycheque into your savings, investment, and spending
                buckets down to the exact cent.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                name="preset"
                aria-label="Reset with preset"
                disabled={pending !== null}
                value=""
                onChange={(e) => {
                  if (e.target.value) void handleApplyPreset(e.target.value);
                }}
                className="w-auto"
              >
                <option value="" disabled>
                  {pending === 'preset' ? 'Applying…' : 'Reset with Preset…'}
                </option>
                {PRESET_CARDS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn primary"
                disabled={pending !== null}
                onClick={() => openRuleModal()}
              >
                + New Bucket
              </button>
            </div>
          </div>

          <div
            className="w-full h-3 rounded-full bg-surface overflow-hidden flex gap-0.5 my-3.5"
            role="img"
            aria-label="Allocation proportion bar"
          >
            {report.buckets.map((b) => (
              <span
                key={b.rule_id}
                className="h-full transition-[width] duration-200 ease-out"
                style={{
                  width: `${b.weight_bps / 100}%`,
                  background: b.color,
                }}
                title={`${b.name}: ${(b.weight_bps / 100).toFixed(1)}%`}
              />
            ))}
            {report.unallocatedBps > 0 ? (
              <span
                className="h-full transition-[width] duration-200 ease-out bg-line"
                style={{
                  width: `${report.unallocatedBps / 100}%`,
                }}
                title={`Unallocated buffer: ${(report.unallocatedBps / 100).toFixed(1)}%`}
              />
            ) : null}
          </div>

          {rules.length === 0 ? (
            <div>
              <p className="text-muted mb-2">
                No allocation buckets yet. Start with a proven template in one click:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3">
                {PRESET_CARDS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={pending !== null}
                    className="p-[18px] rounded-xl bg-bg border border-line flex flex-col gap-2.5 text-left cursor-pointer hover:border-[#c9d4d9] transition-colors"
                    onClick={() => void handleApplyPreset(p.id)}
                  >
                    <b className="text-base font-medium">{p.title}</b>
                    <span className="text-sm text-muted">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 mt-4">
              {rules.map((rule) => {
                const summary = bucketSummaryById.get(rule.id);
                const isActive = Boolean(rule.active);
                const busy = pending === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'p-[18px] rounded-xl bg-bg border border-line flex flex-col gap-2.5',
                      !isActive && 'opacity-55'
                    )}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                        style={{ '--c': rule.color } as CSSProperties}
                      />
                      <b className="mr-auto text-base font-medium">{rule.name}</b>
                      <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
                        {CATEGORY_LABELS[rule.category]}
                      </span>
                    </div>
                    <div>
                      <p className="my-1">
                        <span className="num text-2xl leading-[1.25] tracking-[-0.03em]">
                          {isActive ? fmt(summary?.total_allocated_cents ?? 0) : 'Paused'}
                        </span>
                      </p>
                      <p className="text-[13px] text-muted">
                        Target {(rule.weight_bps / 100).toFixed(2).replace(/\.00$/, '')}% ·{' '}
                        {isActive
                          ? `${fmt(summary?.average_per_cheque_cents ?? 0)} / cheque`
                          : 'Excluded from splits'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 mt-auto pt-2">
                      <button
                        type="button"
                        disabled={pending !== null}
                        className="btn min-h-[40px] px-3 text-[13px]"
                        onClick={() => openRuleModal(rule)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        className="btn min-h-[40px] px-3 text-[13px]"
                        onClick={() => void handleToggleActive(rule)}
                      >
                        {busy ? 'Saving…' : isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        className="btn danger min-h-[40px] px-3 text-[13px]"
                        onClick={() => void handleDeleteRule(rule)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        <article className="card md:col-span-12">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3.5">
            <div>
              <h2 className="text-base font-medium tracking-[-0.01em]">
                Paycheque Split &amp; Hourly Wage Simulator
              </h2>
              <p className="text-sm text-muted">
                Preview how a paycheque or hourly shift splits across your active buckets.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  'btn min-h-[40px] px-3.5 text-sm',
                  simMode === 'direct' && 'primary'
                )}
                onClick={() => setSimMode('direct')}
              >
                Direct Deposit ($)
              </button>
              <button
                type="button"
                className={cn(
                  'btn min-h-[40px] px-3.5 text-sm',
                  simMode === 'hourly' && 'primary'
                )}
                onClick={() => setSimMode('hourly')}
              >
                Hourly Wage ($/h × Hours)
              </button>
            </div>
          </div>

          {simMode === 'direct' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Net Deposit Amount ($)
                <input
                  name="simDirect"
                  type="number"
                  step="0.01"
                  min="0"
                  autoComplete="off"
                  className="num"
                  value={simDirect}
                  onChange={(e) => setSimDirect(e.target.value)}
                />
              </label>
              <div>
                <p className="text-sm text-muted">Allocated to Buckets</p>
                <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
                  {fmt(simSplit.allocatedTotalCents)}
                </p>
                <p className="text-sm text-muted">
                  {(report.totalActiveBps / 100).toFixed(1)}% of deposit
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Unallocated Cash Buffer</p>
                <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
                  {fmt(simSplit.unallocatedCents)}
                </p>
                <p className="text-sm text-muted">
                  {(report.unallocatedBps / 100).toFixed(1)}% remaining
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Net Hourly Wage ($/h)
                <input
                  name="simHourly"
                  type="number"
                  step="0.25"
                  min="0"
                  autoComplete="off"
                  className="num"
                  value={simHourly}
                  onChange={(e) => setSimHourly(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Hours per Pay Period
                <input
                  name="simHours"
                  type="number"
                  step="0.5"
                  min="0"
                  autoComplete="off"
                  className="num"
                  value={simHours}
                  onChange={(e) => setSimHours(e.target.value)}
                />
              </label>
              <div>
                <p className="text-sm text-muted">Simulated Net Paycheque</p>
                <p className="num text-[25px] leading-[1.25] tracking-[-0.03em] mt-1.5 mb-0.5 truncate">
                  {fmt(simCents)}
                </p>
                <p className="text-sm text-muted">
                  Allocated {fmt(simSplit.allocatedTotalCents)} · Buffer{' '}
                  {fmt(simSplit.unallocatedCents)}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {simSplit.buckets.map((b) => (
              <div
                key={b.rule_id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-bg border border-line"
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span
                    className="size-2.5 rounded-full bg-(--c) shrink-0 inline-block"
                    style={{ '--c': b.color } as CSSProperties}
                  />
                  <b className="font-medium">{b.name}</b>
                  <span className="text-xs font-medium py-[3px] px-[9px] rounded-full bg-surface text-muted">
                    {CATEGORY_LABELS[b.category]}
                  </span>
                  <span className="text-[13px] text-muted">
                    {(b.weight_bps / 100).toFixed(2).replace(/\.00$/, '')}%
                  </span>
                </span>
                <span className="num font-medium">{fmt(b.allocated_cents)}</span>
              </div>
            ))}
            {simSplit.unallocatedCents > 0 ? (
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-bg border border-line">
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="size-2.5 rounded-full bg-[#94a3b8] shrink-0 inline-block" />
                  <span className="text-muted">Unallocated Cash Buffer</span>
                </span>
                <span className="num text-muted">{fmt(simSplit.unallocatedCents)}</span>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <dialog ref={dlgRef} aria-labelledby="allocTitle">
        <form className="grid gap-[18px] p-[26px]" onSubmit={handleSaveRule}>
          <h2 id="allocTitle" className="text-[22px] font-medium tracking-[-0.02em]">
            {formState.id ? `Edit ${formState.name || 'bucket'}` : 'New Allocation Bucket'}
          </h2>
          <label className="grid gap-1.5 text-sm font-medium">
            Bucket Name
            <input
              ref={nameRef}
              name="name"
              maxLength={50}
              required
              autoComplete="off"
              placeholder="TFSA / Index Funds…"
              value={formState.name}
              onChange={(e) => setFormState((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Category
              <select
                name="category"
                value={formState.category}
                onChange={(e) =>
                  setFormState((f) => ({
                    ...f,
                    category: e.target.value as AllocationCategory,
                  }))
                }
              >
                <option value="essentials">Essentials</option>
                <option value="investments">Investments</option>
                <option value="savings">Savings</option>
                <option value="lifestyle">Lifestyle</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>
                Target Share (%) ·{' '}
                <span className="font-normal text-muted">{remainingPct.toFixed(1)}% available</span>
              </span>
              <input
                name="percentage"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                required
                autoComplete="off"
                className="num"
                value={formState.percentage}
                onChange={(e) =>
                  setFormState((f) => ({ ...f, percentage: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Accent Colour
            <input
              name="color"
              type="color"
              aria-label="Accent colour"
              value={formState.color}
              onChange={(e) => setFormState((f) => ({ ...f, color: e.target.value }))}
              className="p-1 cursor-pointer"
            />
          </label>
          <label className="flex items-center gap-2.5 text-[15px] min-h-[44px] cursor-pointer">
            <input
              name="active"
              type="checkbox"
              className="size-5 min-h-5 accent-accent"
              checked={formState.active}
              onChange={(e) =>
                setFormState((f) => ({ ...f, active: e.target.checked }))
              }
            />
            Active in paycheque splits
          </label>
          {formErr ? (
            <p className="text-down text-sm" role="alert">
              {formErr}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="hidden sm:block sm:flex-1" />
            <button
              type="button"
              disabled={pending !== null}
              className="btn flex-1 sm:flex-initial"
              onClick={() => dlgRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending !== null}
              className="btn primary flex-1 sm:flex-initial"
            >
              {pending === 'save' ? 'Saving…' : 'Save bucket'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

