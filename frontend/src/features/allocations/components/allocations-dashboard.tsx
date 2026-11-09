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
import { fmt, plural, SOURCE_COLORS } from '@/lib/utils';
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
  }

  async function handleToggleActive(rule: AllocationRule) {
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
  }

  async function handleDeleteRule(rule: AllocationRule) {
    const res = await deleteAllocationRuleAction(rule.id);
    if (!res.success) {
      toast(res.error);
      return;
    }
    toast(`Deleted ${rule.name}`);
  }

  async function handleApplyPreset(presetId: string) {
    const res = await applyAllocationPresetAction(presetId);
    if (!res.success) {
      toast(res.error);
      return;
    }
    toast('Applied allocation preset');
  }

  const bucketSummaryById = useMemo(
    () => new Map(report.buckets.map((b) => [b.rule_id, b])),
    [report.buckets]
  );

  return (
    <section>
      <div className="hero" data-enter="">
        <div>
          <h1>
            {activeYear === 'all'
              ? 'Allocated across all years'
              : `Allocated in ${activeYear}`}
          </h1>
          <p className="big num">{fmt(report.totalAllocatedCents)}</p>
          <p className="delta">
            <b className="up">{(report.totalActiveBps / 100).toFixed(1)}% configured</b> ·{' '}
            {fmt(report.totalUnallocatedCents)} unallocated cash buffer across{' '}
            {plural(report.paychequeCount, 'paycheque')}
            {report.totalTaxReserveCents > 0
              ? ` (after ${fmt(report.totalTaxReserveCents)} tax reserve)`
              : ''}
          </p>
        </div>
        <div className="hero-side">
          <YearDropdown activeYear={activeYear} options={yearOptions} />
          <button
            type="button"
            className="btn primary"
            onClick={() => openRuleModal()}
          >
            + New Allocation Bucket
          </button>
        </div>
      </div>

      <div className="grid">
        <article className="card s12">
          <div className="card-h">
            <div>
              <h2>Pay Yourself First Rules</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Split every paycheque into exact integer-cent buckets using Largest Remainder
                conservation.
              </p>
            </div>
            <div className="actions">
              <select
                aria-label="Reset with preset"
                value=""
                onChange={(e) => {
                  if (e.target.value) void handleApplyPreset(e.target.value);
                }}
                style={{ width: 'auto' }}
              >
                <option value="" disabled>
                  Reset with Preset…
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
                onClick={() => openRuleModal()}
              >
                + New Bucket
              </button>
            </div>
          </div>

          <div
            className="allocation-bar-track"
            role="img"
            aria-label="Allocation proportion bar"
          >
            {report.buckets.map((b) => (
              <span
                key={b.rule_id}
                className="allocation-bar-seg"
                style={{
                  width: `${b.weight_bps / 100}%`,
                  background: b.color,
                }}
                title={`${b.name}: ${(b.weight_bps / 100).toFixed(1)}%`}
              />
            ))}
            {report.unallocatedBps > 0 ? (
              <span
                className="allocation-bar-seg"
                style={{
                  width: `${report.unallocatedBps / 100}%`,
                  background: 'var(--line)',
                }}
                title={`Unallocated buffer: ${(report.unallocatedBps / 100).toFixed(1)}%`}
              />
            ) : null}
          </div>

          {rules.length === 0 ? (
            <div>
              <p className="muted" style={{ marginBottom: 8 }}>
                No allocation buckets yet. Start with a proven template in one click:
              </p>
              <div className="preset-grid">
                {PRESET_CARDS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="bucket-card"
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => void handleApplyPreset(p.id)}
                  >
                    <b style={{ fontSize: 16 }}>{p.title}</b>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {p.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bucket-grid">
              {rules.map((rule) => {
                const summary = bucketSummaryById.get(rule.id);
                const isActive = Boolean(rule.active);
                return (
                  <div
                    key={rule.id}
                    className={
                      isActive ? 'bucket-card' : 'bucket-card bucket-card-inactive'
                    }
                  >
                    <div className="src-head">
                      <span
                        className="dot"
                        style={{ '--c': rule.color } as CSSProperties}
                      />
                      <b style={{ marginRight: 'auto', fontSize: 16 }}>{rule.name}</b>
                      <span className="tag">{CATEGORY_LABELS[rule.category]}</span>
                    </div>
                    <div>
                      <p className="kpi" style={{ margin: '4px 0' }}>
                        <span className="val num" style={{ fontSize: 24 }}>
                          {isActive ? fmt(summary?.total_allocated_cents ?? 0) : 'Paused'}
                        </span>
                      </p>
                      <p className="muted" style={{ fontSize: 13 }}>
                        Target {(rule.weight_bps / 100).toFixed(2).replace(/\.00$/, '')}% ·{' '}
                        {isActive
                          ? `${fmt(summary?.average_per_cheque_cents ?? 0)} / cheque`
                          : 'Excluded from splits'}
                      </p>
                    </div>
                    <div className="actions" style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ minHeight: 34, padding: '0 12px', fontSize: 13 }}
                        onClick={() => openRuleModal(rule)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ minHeight: 34, padding: '0 12px', fontSize: 13 }}
                        onClick={() => void handleToggleActive(rule)}
                      >
                        {isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        style={{ minHeight: 34, padding: '0 12px', fontSize: 13 }}
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

      <div className="grid">
        <article className="card s12">
          <div className="card-h">
            <div>
              <h2>Paycheque Split &amp; Hourly Wage Simulator</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Test any direct deposit or hourly wage what-if scenario with zero-drift cent
                conservation.
              </p>
            </div>
            <div className="chips">
              <button
                type="button"
                className={simMode === 'direct' ? 'btn primary' : 'btn'}
                style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }}
                onClick={() => setSimMode('direct')}
              >
                Direct Deposit ($)
              </button>
              <button
                type="button"
                className={simMode === 'hourly' ? 'btn primary' : 'btn'}
                style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }}
                onClick={() => setSimMode('hourly')}
              >
                Hourly Wage ($/h × Hours)
              </button>
            </div>
          </div>

          {simMode === 'direct' ? (
            <div className="simulator-grid">
              <label className="field">
                Net Deposit Amount ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="num"
                  value={simDirect}
                  onChange={(e) => setSimDirect(e.target.value)}
                />
              </label>
              <div className="kpi">
                <p className="label">Allocated to Buckets</p>
                <p className="val num">{fmt(simSplit.allocatedTotalCents)}</p>
                <p className="sub">{(report.totalActiveBps / 100).toFixed(1)}% of deposit</p>
              </div>
              <div className="kpi">
                <p className="label">Unallocated Cash Buffer</p>
                <p className="val num">{fmt(simSplit.unallocatedCents)}</p>
                <p className="sub">{(report.unallocatedBps / 100).toFixed(1)}% remaining</p>
              </div>
            </div>
          ) : (
            <div className="simulator-grid">
              <label className="field">
                Net Hourly Wage ($/h)
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="num"
                  value={simHourly}
                  onChange={(e) => setSimHourly(e.target.value)}
                />
              </label>
              <label className="field">
                Hours per Pay Period
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="num"
                  value={simHours}
                  onChange={(e) => setSimHours(e.target.value)}
                />
              </label>
              <div className="kpi">
                <p className="label">Simulated Net Paycheque</p>
                <p className="val num">{fmt(simCents)}</p>
                <p className="sub">
                  Allocated {fmt(simSplit.allocatedTotalCents)} · Buffer{' '}
                  {fmt(simSplit.unallocatedCents)}
                </p>
              </div>
            </div>
          )}

          <div>
            {simSplit.buckets.map((b) => (
              <div key={b.rule_id} className="split-row">
                <span className="who">
                  <span className="dot" style={{ '--c': b.color } as CSSProperties} />
                  <b>{b.name}</b>
                  <span className="tag">{CATEGORY_LABELS[b.category]}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {(b.weight_bps / 100).toFixed(2).replace(/\.00$/, '')}%
                  </span>
                </span>
                <span className="num" style={{ fontWeight: 500 }}>
                  {fmt(b.allocated_cents)}
                </span>
              </div>
            ))}
            {simSplit.unallocatedCents > 0 ? (
              <div className="split-row">
                <span className="who">
                  <span className="dot" style={{ '--c': '#94a3b8' } as CSSProperties} />
                  <span className="muted">Unallocated Cash Buffer</span>
                </span>
                <span className="num muted">{fmt(simSplit.unallocatedCents)}</span>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <dialog ref={dlgRef} aria-labelledby="allocTitle">
        <form onSubmit={handleSaveRule}>
          <h2 id="allocTitle">
            {formState.id ? `Edit ${formState.name || 'bucket'}` : 'New Allocation Bucket'}
          </h2>
          <label className="field">
            Bucket Name
            <input
              ref={nameRef}
              maxLength={50}
              required
              placeholder="e.g., TFSA / Index Funds"
              value={formState.name}
              onChange={(e) => setFormState((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <div className="row2">
            <label className="field">
              Category
              <select
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
            <label className="field">
              Target Share (%) ·{' '}
              <span className="opt">{remainingPct.toFixed(1)}% available</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                required
                className="num"
                value={formState.percentage}
                onChange={(e) =>
                  setFormState((f) => ({ ...f, percentage: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="field">
            <span>Accent Colour</span>
            <div className="chips">
              {SOURCE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormState((f) => ({ ...f, color: c }))}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 99,
                    background: c,
                    border:
                      formState.color === c
                        ? '3px solid var(--ink)'
                        : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  aria-label={`Select color ${c}`}
                />
              ))}
              <input
                type="color"
                value={formState.color}
                onChange={(e) => setFormState((f) => ({ ...f, color: e.target.value }))}
                style={{ width: 44, height: 32, minHeight: 32, padding: 2 }}
              />
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={formState.active}
              onChange={(e) =>
                setFormState((f) => ({ ...f, active: e.target.checked }))
              }
            />
            Active in paycheque splits
          </label>
          <p className="err" role="alert">
            {formErr}
          </p>
          <div className="actions">
            <span className="sp" />
            <button
              type="button"
              className="btn"
              onClick={() => dlgRef.current?.close()}
            >
              Cancel
            </button>
            <button className="btn primary">Save bucket</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

