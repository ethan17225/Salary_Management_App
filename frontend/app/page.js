"use client";

import Chart from "chart.js/auto";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

const CAD = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const fmt = (c) => CAD.format(c / 100);
const short = (v) => (v >= 1000 ? "$" + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : "$" + Math.round(v));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KIND = { job: "Job", government: "Government", other: "Other" };
const COLORS = ["#0d7480", "#c2410c", "#2563eb", "#4d7c0f", "#b45309", "#be123c", "#0e7490", "#475569"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const dateLabel = (s, o = { month: "short", day: "numeric", year: "numeric" }) => parse(s).toLocaleDateString("en-CA", o);
const monthLabel = (ym) => dateLabel(ym + "-01", { month: "long", year: "numeric" });
const sum = (ps) => ps.reduce((t, p) => t + p.amount_cents, 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

async function api(method, path, body) {
  const r = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export default function PaydayPage() {
  const [data, setData] = useState({ sources: [], paycheques: [], settings: {} });
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [tab, setTab] = useState("overview");
  const [activeSrcId, setActiveSrcId] = useState(null);
  const [ovYear, setOvYear] = useState(null);
  const [srcYear, setSrcYear] = useState("all");
  const [yearOpen, setYearOpen] = useState(false);
  const [srcYearOpen, setSrcYearOpen] = useState(false);
  const [srcSearch, setSrcSearch] = useState("");
  const [fYear, setFYear] = useState("");
  const [fSource, setFSource] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [entered, setEntered] = useState(false);

  const [payForm, setPayForm] = useState({ id: null, source_id: 0, amount: "", paid_on: "", hours: "", note: "" });
  const [payErr, setPayErr] = useState("");
  const [srcForm, setSrcForm] = useState({ id: null, name: "", kind: "job", color: COLORS[0], archived: false });
  const [srcErr, setSrcErr] = useState("");
  const [goalVal, setGoalVal] = useState("");
  const [goalErr, setGoalErr] = useState("");
  const [toastState, setToastState] = useState(null);

  const payDlgRef = useRef(null);
  const srcDlgRef = useRef(null);
  const goalDlgRef = useRef(null);
  const yearDdRef = useRef(null);
  const srcYearDdRef = useRef(null);
  const amountRef = useRef(null);
  const srcNameRef = useRef(null);
  const goalInputRef = useRef(null);
  const bigTotalRef = useRef(null);
  const countedRef = useRef(false);
  const toastTimer = useRef(null);
  const monthlyCanvas = useRef(null);
  const cumCanvas = useRef(null);
  const splitCanvas = useRef(null);
  const srcChartCanvas = useRef(null);

  const toast = useCallback((msg, undo) => {
    setToastState({ msg, undo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), undo ? 7000 : 3000);
  }, []);

  const reload = useCallback(async () => {
    const next = await api("GET", "state");
    setData(next);
    setReady(true);
    return next;
  }, []);

  const srcById = useCallback(
    (id) => data.sources.find((s) => s.id === id) || { name: "Unknown", color: "#94a3b8" },
    [data.sources]
  );

  // ponytail: median-gap heuristic; add explicit recurrence rules if schedules get irregular.
  const upcoming = useMemo(() => {
    if (!today) return [];
    return data.sources
      .filter((s) => !s.archived)
      .map((s) => {
        const ps = data.paycheques.filter((p) => p.source_id === s.id).reverse();
        if (ps.length < 3) return null;
        const recent = ps.slice(-7);
        const gap = Math.round(median(recent.slice(1).map((p, i) => diffDays(recent[i].paid_on, p.paid_on))));
        const last = ps.at(-1).paid_on;
        if (gap < 1 || diffDays(last, today) > gap * 2 + 7) return null;
        return { s, gap, next: addDays(last, gap), amount: median(ps.slice(-4).map((p) => p.amount_cents)) };
      })
      .filter(Boolean)
      .sort((a, b) => (a.next < b.next ? -1 : 1));
  }, [data.sources, data.paycheques, today]);

  const curYear = today ? +today.slice(0, 4) : 2026;
  const years = useMemo(() => {
    const ys = new Set(data.paycheques.map((p) => +p.paid_on.slice(0, 4)));
    ys.add(curYear);
    return [...ys].sort((a, b) => b - a);
  }, [data.paycheques, curYear]);

  const activeYear = ovYear ?? curYear;

  const openPay = useCallback(
    (p, snap = data, nowStr = today || iso(new Date()), forceSrcId = null) => {
      const activeSources = snap.sources.filter((s) => !s.archived || s.id === p?.source_id || s.id === forceSrcId);
      const preferred = forceSrcId ?? (tab === "source" ? activeSrcId : null);
      const defaultSrc = p ? p.source_id : preferred ?? upcoming[0]?.s.id ?? snap.paycheques[0]?.source_id ?? activeSources[0]?.id ?? 0;
      setPayErr("");
      setPayForm({
        id: p ? p.id : null,
        source_id: defaultSrc,
        amount: p ? (p.amount_cents / 100).toFixed(2) : "",
        paid_on: p ? p.paid_on : nowStr,
        hours: p?.hours ?? "",
        note: p?.note ?? "",
      });
      payDlgRef.current?.showModal();
      requestAnimationFrame(() => amountRef.current?.focus());
    },
    [data, today, upcoming, tab, activeSrcId]
  );

  const openSrc = useCallback(
    (s) => {
      setSrcErr("");
      setSrcForm({
        id: s ? s.id : null,
        name: s?.name ?? "",
        kind: s?.kind ?? "job",
        color: s?.color ?? (COLORS.find((c) => !data.sources.some((x) => x.color === c)) || COLORS[0]),
        archived: !!s?.archived,
      });
      srcDlgRef.current?.showModal();
      requestAnimationFrame(() => srcNameRef.current?.focus());
    },
    [data.sources]
  );

  useEffect(() => {
    const nowStr = iso(new Date());
    setToday(nowStr);
    const applyHash = (snap) => {
      const h = location.hash.slice(1) || "overview";
      if (h === "add") {
        history.replaceState(null, "", "#overview");
        setTab("overview");
        if (snap) openPay(null, snap, nowStr);
        return;
      }
      const m = h.match(/^source\/(\d+)$/);
      if (m) {
        setActiveSrcId(+m[1]);
        setSrcYear("all");
        setSrcSearch("");
        setTab("source");
        return;
      }
      if (["overview", "paycheques", "sources"].includes(h)) setTab(h);
    };
    reload()
      .then((snap) => applyHash(snap))
      .catch((err) => toast("Could not reach the Payday server: " + err.message));
    const onHash = () => { applyHash(null); scrollTo(0, 0); };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setYearOpen(false);
        setSrcYearOpen(false);
      }
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey && !e.ctrlKey && !e.altKey &&
        !document.querySelector("dialog[open]") &&
        !e.target.closest("input, select, textarea")
      ) {
        e.preventDefault();
        openPay();
      }
    };
    const onDown = (e) => {
      if (yearDdRef.current && !yearDdRef.current.contains(e.target)) setYearOpen(false);
      if (srcYearDdRef.current && !srcYearDdRef.current.contains(e.target)) setSrcYearOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [openPay]);

  // Overview calculations
  const isAll = activeYear === "all";
  const isCur = !isAll && activeYear === curYear;
  const inY = useMemo(
    () => (isAll ? data.paycheques : data.paycheques.filter((p) => p.paid_on.startsWith(activeYear + "-"))),
    [data.paycheques, activeYear, isAll]
  );
  const sumY = useMemo(() => sum(inY), [inY]);

  const timelineMonths = useMemo(() => {
    if (!data.paycheques.length) return MONTHS.map((_, m) => `${curYear}-${pad(m + 1)}`);
    const [sy, sm] = data.paycheques.at(-1).paid_on.slice(0, 7).split("-").map(Number);
    const [ey, em] = data.paycheques[0].paid_on.slice(0, 7).split("-").map(Number);
    const out = [];
    for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, (m = 1)) : m++) {
      out.push(`${y}-${pad(m)}`);
    }
    return out;
  }, [data.paycheques, curYear]);

  useEffect(() => {
    const el = bigTotalRef.current;
    if (!el || !ready) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (countedRef.current || reduced) {
      el.textContent = fmt(sumY);
      return;
    }
    countedRef.current = true;
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = fmt(Math.round(sumY * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready, sumY]);

  const bySrc = useMemo(() => {
    const m = new Map();
    inY.forEach((p) => m.set(p.source_id, (m.get(p.source_id) || 0) + p.amount_cents));
    return m;
  }, [inY]);

  useEffect(() => {
    if (!ready || tab !== "overview") return;
    const fontSans = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
    Chart.defaults.color = "#5d6e76";
    Chart.defaults.borderColor = "#e8edf0";
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.font.family = `${fontSans || "'Outfit'"}, system-ui, sans-serif`;

    const legend = { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 16 } };
    const money = (c) => ` ${c.dataset.label || c.label}: ${CAD.format(c.raw)}`;
    const used = data.sources.filter((s) => bySrc.has(s.id));
    const curMonth = today ? +today.slice(5, 7) - 1 : 11;
    const monthKeys = isAll ? timelineMonths : MONTHS.map((_, m) => `${activeYear}-${pad(m + 1)}`);
    const monthLabels = isAll ? timelineMonths.map((ym) => `${MONTHS[+ym.slice(5, 7) - 1]} '${ym.slice(2, 4)}`) : MONTHS;
    const run = (yr, stop) => {
      let t = 0;
      return MONTHS.map((_, m) => {
        if (m > stop) return null;
        t += sum(data.paycheques.filter((p) => p.paid_on.startsWith(`${yr}-${pad(m + 1)}`)));
        return t / 100;
      });
    };
    let allRun = 0;
    const cumData = isAll
      ? {
          labels: monthLabels,
          datasets: [
            {
              label: "All-time cumulative",
              data: timelineMonths.map((ym) => ((allRun += sum(inY.filter((p) => p.paid_on.startsWith(ym)))), allRun / 100)),
              borderColor: "#0d7480",
              backgroundColor: "rgba(13,116,128,.09)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2.5,
            },
          ],
        }
      : {
          labels: MONTHS,
          datasets: [
            { label: String(activeYear), data: run(activeYear, isCur ? curMonth : 11), borderColor: "#0d7480", backgroundColor: "rgba(13,116,128,.09)", fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5 },
            { label: String(activeYear - 1), data: run(activeYear - 1, 11), borderColor: "#9aa8af", borderDash: [5, 4], tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
          ],
        };

    const c1 = new Chart(monthlyCanvas.current, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: used.map((s) => ({
          label: s.name,
          backgroundColor: s.color,
          borderRadius: 4,
          maxBarThickness: 46,
          data: monthKeys.map((ym) => sum(inY.filter((p) => p.source_id === s.id && p.paid_on.startsWith(ym))) / 100),
        })),
      },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, border: { display: false }, ticks: { callback: short } } },
        plugins: {
          legend,
          tooltip: { filter: (i) => i.raw > 0, callbacks: { label: money, footer: (items) => "Total " + CAD.format(items.reduce((t, i) => t + i.raw, 0)) } },
        },
      },
    });
    const c2 = new Chart(splitCanvas.current, {
      type: "doughnut",
      data: {
        labels: used.map((s) => s.name),
        datasets: [{ data: used.map((s) => bySrc.get(s.id) / 100), backgroundColor: used.map((s) => s.color), borderColor: "#fff", borderWidth: 2 }],
      },
      options: {
        cutout: "66%",
        plugins: { legend, tooltip: { callbacks: { label: (c) => ` ${CAD.format(c.raw)} · ${sumY ? Math.round((c.raw * 10000) / sumY) : 0}%` } } },
      },
    });
    const c3 = new Chart(cumCanvas.current, {
      type: "line",
      data: cumData,
      options: {
        interaction: { mode: "index", intersect: false },
        scales: { x: { grid: { display: false } }, y: { border: { display: false }, ticks: { callback: short } } },
        plugins: { legend, tooltip: { callbacks: { label: money } } },
      },
    });
    return () => { c1.destroy(); c2.destroy(); c3.destroy(); };
  }, [ready, tab, data.sources, data.paycheques, inY, bySrc, sumY, activeYear, isAll, isCur, timelineMonths, today]);

  // Derived overview stats
  const cutoff = isCur && today ? `${activeYear - 1}-${today.slice(5)}` : `${activeYear - 1}-12-31`;
  const prevTotal = isAll ? 0 : sum(data.paycheques.filter((p) => p.paid_on.startsWith(activeYear - 1 + "-") && p.paid_on <= cutoff));
  const prevPct = prevTotal ? ((sumY - prevTotal) / prevTotal) * 100 : null;
  const thisMonthTotal = today ? sum(data.paycheques.filter((p) => p.paid_on.startsWith(today.slice(0, 7)))) : 0;
  const paidYearCount = new Set(inY.map((p) => p.paid_on.slice(0, 4))).size;

  const periodMonths = new Map();
  inY.forEach((p) => {
    const ym = p.paid_on.slice(0, 7);
    periodMonths.set(ym, (periodMonths.get(ym) || 0) + p.amount_cents);
  });
  const activeMonths = periodMonths.size;
  const bestPeriodMonth = [...periodMonths].sort((a, b) => b[1] - a[1])[0];
  const topSrc = [...bySrc].sort((a, b) => b[1] - a[1])[0];

  const goal = +data.settings.goal_cents || 0;
  const goalYear = isAll ? curYear : activeYear;
  const goalSum = isAll ? sum(data.paycheques.filter((p) => p.paid_on.startsWith(curYear + "-"))) : sumY;
  const goalIsCur = goalYear === curYear;
  const goalPct = goal ? Math.min(100, (goalSum / goal) * 100) : 0;
  const daysInYr = diffDays(`${goalYear}-01-01`, `${goalYear + 1}-01-01`);
  const daysDone = goalIsCur && today ? diffDays(`${goalYear}-01-01`, today) + 1 : daysInYr;
  const goalLeft = goal - goalSum;
  const monthsLeft = (daysInYr - daysDone) / 30.44;
  const yearOptions = [
    ["all", "All", sum(data.paycheques)],
    ...years.map((y) => [y, String(y), sum(data.paycheques.filter((p) => p.paid_on.startsWith(y + "-")))]),
  ];

  const allMonths = {};
  data.paycheques.forEach((p) => { const k = p.paid_on.slice(0, 7); allMonths[k] = (allMonths[k] || 0) + p.amount_cents; });
  const bestEver = Object.entries(allMonths).sort((a, b) => b[1] - a[1])[0];
  const biggest = data.paycheques.reduce((m, p) => (!m || p.amount_cents > m.amount_cents ? p : m), null);

  // Filtered table groups
  const filteredRows = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return data.paycheques.filter(
      (p) =>
        (!fYear || p.paid_on.startsWith(fYear + "-")) &&
        (!fSource || p.source_id === +fSource) &&
        (!q || `${srcById(p.source_id).name} ${p.note} ${(p.amount_cents / 100).toFixed(2)} ${p.paid_on}`.toLowerCase().includes(q))
    );
  }, [data.paycheques, fYear, fSource, fSearch, srcById]);

  const monthGroups = useMemo(() => {
    const g = new Map();
    filteredRows.forEach((p) => { const k = p.paid_on.slice(0, 7); g.has(k) ? g.get(k).push(p) : g.set(k, [p]); });
    return [...g];
  }, [filteredRows]);

  const sparkValues = (sourceId) => {
    const base = today ? parse(today) : new Date(2026, 10, 1);
    const items = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1, k = `${y}-${pad(m)}`;
      return { k, y, m, v: sum(data.paycheques.filter((p) => p.source_id === sourceId && p.paid_on.startsWith(k))) };
    });
    const yrs = [];
    for (const it of items) {
      if (yrs.at(-1)?.y === it.y) yrs.at(-1).span++;
      else yrs.push({ y: it.y, span: 1 });
    }
    return { items, yrs, max: Math.max(...items.map((x) => x.v), 1) };
  };

  // Source detail calculations
  const activeSrc = useMemo(
    () => data.sources.find((s) => s.id === activeSrcId) || null,
    [data.sources, activeSrcId]
  );
  const srcAllPs = useMemo(
    () => (activeSrc ? data.paycheques.filter((p) => p.source_id === activeSrc.id) : []),
    [data.paycheques, activeSrc]
  );
  const srcYears = useMemo(() => {
    const ys = new Set(srcAllPs.map((p) => +p.paid_on.slice(0, 4)));
    if (!ys.size) ys.add(curYear);
    return [...ys].sort((a, b) => b - a);
  }, [srcAllPs, curYear]);
  const srcIsAll = srcYear === "all";
  const srcPs = useMemo(
    () => (srcIsAll ? srcAllPs : srcAllPs.filter((p) => p.paid_on.startsWith(srcYear + "-"))),
    [srcAllPs, srcYear, srcIsAll]
  );
  const srcSum = useMemo(() => sum(srcPs), [srcPs]);
  const srcTotalPool = useMemo(
    () => sum(srcIsAll ? data.paycheques : data.paycheques.filter((p) => p.paid_on.startsWith(srcYear + "-"))),
    [data.paycheques, srcYear, srcIsAll]
  );
  const srcSharePct = srcTotalPool ? Math.round((srcSum / srcTotalPool) * 100) : 0;
  const srcAvg = srcPs.length ? srcSum / srcPs.length : 0;
  const srcMaxP = srcPs.reduce((m, p) => (!m || p.amount_cents > m.amount_cents ? p : m), null);
  const srcMinP = srcPs.reduce((m, p) => (!m || p.amount_cents < m.amount_cents ? p : m), null);
  const srcMedian = srcPs.length ? median(srcPs.map((p) => p.amount_cents)) : 0;
  const srcTimed = srcPs.filter((p) => p.hours);
  const srcHours = srcTimed.reduce((h, p) => h + p.hours, 0);
  const srcTimedSum = sum(srcTimed);

  const srcPeriodMonths = useMemo(() => {
    const m = new Map();
    srcPs.forEach((p) => {
      const ym = p.paid_on.slice(0, 7);
      m.set(ym, (m.get(ym) || 0) + p.amount_cents);
    });
    return m;
  }, [srcPs]);
  const srcActiveMonths = srcPeriodMonths.size;
  const srcBestMonth = [...srcPeriodMonths].sort((a, b) => b[1] - a[1])[0];

  const srcCadence = useMemo(() => {
    if (!srcAllPs.length) return { weekday: null, gap: null };
    const counts = {};
    srcAllPs.forEach((p) => {
      const w = dateLabel(p.paid_on, { weekday: "long" });
      counts[w] = (counts[w] || 0) + 1;
    });
    const weekday = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const asc = [...srcAllPs].reverse();
    const gaps = asc.slice(1).map((p, i) => diffDays(asc[i].paid_on, p.paid_on)).filter((g) => g > 0 && g <= 45);
    const gap = gaps.length >= 2 ? Math.round(median(gaps)) : null;
    return { weekday, gap };
  }, [srcAllPs]);

  const srcTimeline = useMemo(() => {
    if (!srcAllPs.length) return MONTHS.map((_, m) => `${curYear}-${pad(m + 1)}`);
    const [sy, sm] = srcAllPs.at(-1).paid_on.slice(0, 7).split("-").map(Number);
    const [ey, em] = srcAllPs[0].paid_on.slice(0, 7).split("-").map(Number);
    const out = [];
    for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, (m = 1)) : m++) {
      out.push(`${y}-${pad(m)}`);
    }
    return out;
  }, [srcAllPs, curYear]);

  const srcFilteredRows = useMemo(() => {
    const q = srcSearch.trim().toLowerCase();
    return srcPs.filter(
      (p) => !q || `${p.note} ${(p.amount_cents / 100).toFixed(2)} ${p.paid_on} ${dateLabel(p.paid_on)}`.toLowerCase().includes(q)
    );
  }, [srcPs, srcSearch]);

  const srcMonthGroups = useMemo(() => {
    const g = new Map();
    srcFilteredRows.forEach((p) => {
      const k = p.paid_on.slice(0, 7);
      g.has(k) ? g.get(k).push(p) : g.set(k, [p]);
    });
    return [...g];
  }, [srcFilteredRows]);

  const srcYearOptions = useMemo(
    () => [
      ["all", "All", sum(srcAllPs)],
      ...srcYears.map((y) => [y, String(y), sum(srcAllPs.filter((p) => p.paid_on.startsWith(y + "-")))]),
    ],
    [srcAllPs, srcYears]
  );

  useEffect(() => {
    if (!ready || tab !== "source" || !activeSrc || !srcChartCanvas.current) return;
    const fontSans = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
    Chart.defaults.color = "#5d6e76";
    Chart.defaults.borderColor = "#e8edf0";
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.font.family = `${fontSans || "'Outfit'"}, system-ui, sans-serif`;

    const monthKeys = srcIsAll ? srcTimeline : MONTHS.map((_, m) => `${srcYear}-${pad(m + 1)}`);
    const monthLabels = srcIsAll
      ? srcTimeline.map((ym) => `${MONTHS[+ym.slice(5, 7) - 1]} '${ym.slice(2, 4)}`)
      : MONTHS;
    const monthBuckets = monthKeys.map((ym) => srcPs.filter((p) => p.paid_on.startsWith(ym)));

    const chart = new Chart(srcChartCanvas.current, {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: activeSrc.name,
            backgroundColor: activeSrc.color,
            borderRadius: 5,
            maxBarThickness: 44,
            data: monthBuckets.map((ps) => sum(ps) / 100),
          },
        ],
      },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { display: false } },
          y: { border: { display: false }, ticks: { callback: short } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => ` ${CAD.format(c.raw)}`,
              afterLabel: (c) => {
                const ps = monthBuckets[c.dataIndex] || [];
                if (!ps.length) return "";
                const h = ps.reduce((t, p) => t + (p.hours || 0), 0);
                return ` ${plural(ps.length, "paycheque")}${h ? ` · ${+h.toFixed(2)} h` : ""}`;
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [ready, tab, activeSrc, srcPs, srcIsAll, srcYear, srcTimeline]);

  // Dialog handlers
  const chipSources = data.sources.filter((s) => !s.archived || s.id === payForm.source_id);
  const lastForSrc = payForm.id === null ? data.paycheques.find((p) => p.source_id === +payForm.source_id) : null;

  async function submitPay(e) {
    e.preventDefault();
    try {
      await api(payForm.id ? "PUT" : "POST", "paycheques" + (payForm.id ? "/" + payForm.id : ""), payForm);
      payDlgRef.current?.close();
      toast(payForm.id ? "Paycheque updated" : `Added ${CAD.format(+payForm.amount)} from ${srcById(+payForm.source_id).name}`);
      await reload();
    } catch (err) {
      setPayErr(err.message);
    }
  }

  async function deletePay() {
    const p = data.paycheques.find((x) => x.id === payForm.id);
    if (!p) return;
    try {
      await api("DELETE", "paycheques/" + p.id);
      payDlgRef.current?.close();
      await reload();
      toast(`Deleted ${fmt(p.amount_cents)} from ${srcById(p.source_id).name}`, async () => {
        await api("POST", "paycheques", { ...p, amount: (p.amount_cents / 100).toFixed(2) });
        await reload();
        toast("Paycheque restored");
      });
    } catch (err) {
      setPayErr(err.message);
    }
  }

  async function submitSrc(e) {
    e.preventDefault();
    try {
      const r = await api(srcForm.id ? "PUT" : "POST", "sources" + (srcForm.id ? "/" + srcForm.id : ""), srcForm);
      srcDlgRef.current?.close();
      toast(srcForm.id ? "Source saved" : `Added ${srcForm.name}`);
      await reload();
      if (payDlgRef.current?.open && r.id) setPayForm((f) => ({ ...f, source_id: r.id }));
    } catch (err) {
      setSrcErr(err.message);
    }
  }

  async function deleteSrc() {
    try {
      const deletedId = srcForm.id;
      await api("DELETE", "sources/" + deletedId);
      srcDlgRef.current?.close();
      toast("Source deleted");
      await reload();
      if (activeSrcId === deletedId) location.hash = "#sources";
    } catch (err) {
      setSrcErr(err.message);
    }
  }

  async function saveGoal(val) {
    try {
      await api("PUT", "settings", { goal: val });
      goalDlgRef.current?.close();
      toast(val ? "Goal saved" : "Goal removed");
      await reload();
    } catch (err) {
      setGoalErr(err.message);
    }
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="wrap top-in">
          <a className="brand" href="#overview"><span className="mark" aria-hidden="true">P</span>Payday</a>
          <nav className="tabs" aria-label="Sections">
            {[["overview", "Overview"], ["paycheques", "Paycheques"], ["sources", "Sources"]].map(([id, label]) => (
              <a key={id} href={`#${id}`} aria-current={tab === id || (id === "sources" && tab === "source") ? "page" : undefined}>{label}</a>
            ))}
          </nav>
          <button className="btn primary" type="button" onClick={() => openPay()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add paycheque
          </button>
        </div>
      </header>

      <main id="main" className="wrap" tabIndex={-1}>
        <section hidden={tab !== "overview"}>
          <div className="hero" data-enter={entered ? undefined : ""} onAnimationEnd={() => setEntered(true)}>
            <div>
              <h1>{isAll ? "Earned across all years" : isCur ? `Earned so far in ${activeYear}` : `Earned in ${activeYear}`}</h1>
              <p className="big" ref={bigTotalRef}>$0.00</p>
              <p className="delta">
                {isAll ? (
                  inY.length ? (
                    `${plural(inY.length, "paycheque")} across ${plural(bySrc.size, "source")} since ${dateLabel(inY.at(-1).paid_on, { month: "short", year: "numeric" })}`
                  ) : (
                    "No paycheques recorded yet."
                  )
                ) : prevPct !== null ? (
                  <>
                    <b className={prevPct >= 0 ? "up" : "down"}>
                      {prevPct >= 0 ? "▲" : "▼"} {Math.abs(prevPct).toFixed(0)}%
                    </b>{" "}
                    against {fmt(prevTotal)} {isCur ? "by this date in" : "in"} {activeYear - 1}
                  </>
                ) : (
                  `Nothing recorded in ${activeYear - 1} to compare with.`
                )}
              </p>
            </div>
            <div className="hero-side">
              <div className="year-dd" ref={yearDdRef}>
                <button
                  type="button"
                  className="year-btn"
                  aria-haspopup="listbox"
                  aria-expanded={yearOpen}
                  aria-label={`Year: ${isAll ? "All" : activeYear}`}
                  onClick={() => setYearOpen((o) => !o)}
                >
                  <span className="year-lbl">Year</span>
                  <span className="year-val">{isAll ? "All" : activeYear}</span>
                  <svg className="year-chev" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {yearOpen ? (
                  <ul className="year-menu" role="listbox" aria-label="Select year">
                    {yearOptions.map(([val, label, tot]) => {
                      const selected = activeYear === val;
                      return (
                        <li key={val}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={selected ? "year-opt active" : "year-opt"}
                            onClick={() => {
                              setOvYear(val);
                              setYearOpen(false);
                            }}
                          >
                            <svg className="year-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
              <p className="muted">
                {isAll
                  ? paidYearCount
                    ? `${plural(paidYearCount, "year")} · ${fmt(sumY / paidYearCount)} / yr avg`
                    : "0 paycheques"
                  : isCur
                    ? `${fmt(thisMonthTotal)} so far this month`
                    : plural(inY.length, "paycheque")}
              </p>
            </div>
          </div>

          <div className="grid">
            <article className="card kpi s3">
              <p className="label">Monthly average</p>
              <p className="val num">{activeMonths ? fmt(sumY / activeMonths) : "—"}</p>
              <p className="sub">{activeMonths ? `across ${plural(activeMonths, "month")} with pay` : "No pay yet"}</p>
            </article>
            <article className="card kpi s3">
              <p className="label">Best month</p>
              <p className="val">
                {bestPeriodMonth ? dateLabel(bestPeriodMonth[0] + "-01", isAll ? { month: "short", year: "numeric" } : { month: "long" }) : "—"}
              </p>
              <p className="sub">{bestPeriodMonth ? fmt(bestPeriodMonth[1]) : "No pay yet"}</p>
            </article>
            <article className="card kpi s3">
              <p className="label">Paycheques</p>
              <p className="val num">{inY.length}</p>
              <p className="sub">{inY.length ? `${fmt(sumY / inY.length)} each on average` : "None yet"}</p>
            </article>
            <article className="card kpi s3">
              <p className="label">Top source</p>
              <p className="val">{topSrc ? srcById(topSrc[0]).name : "—"}</p>
              <p className="sub">{topSrc ? `${Math.round((topSrc[1] / sumY) * 100)}% of ${isAll ? "total" : activeYear} income` : "None yet"}</p>
            </article>
          </div>

          <div className="grid">
            <article className="card s8">
              <h2>Monthly income by source</h2>
              <div className="chart tall">
                <canvas ref={monthlyCanvas} role="img" aria-label="Stacked bar chart of income per month by source" />
              </div>
            </article>
            <div className="s4 stack">
              <article className="card">
                <div className="card-h">
                  <h2>Yearly goal</h2>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setGoalErr("");
                      setGoalVal(goal ? String(Math.round(goal / 100)) : "");
                      goalDlgRef.current?.showModal();
                      requestAnimationFrame(() => goalInputRef.current?.focus());
                    }}
                  >
                    {goal ? "Change goal" : "Set a goal"}
                  </button>
                </div>
                <div className="goal-body">
                  {!goal ? (
                    <p className="muted">Set a take-home number for the year. Payday tracks your pace and tells you what each month needs to bring in.</p>
                  ) : (
                    <>
                      <p className="goal-num">
                        <span className="num">{fmt(goalSum)}</span> <span className="muted">of <span className="num">{fmt(goal)}</span></span>
                      </p>
                      <progress max="100" value={goalPct} aria-label={`Progress toward the ${goalYear} goal`}>{goalPct.toFixed(0)}%</progress>
                      <p className="muted">{goalPct.toFixed(0)}% of the {goalYear} goal</p>
                      {goalIsCur && (
                        <>
                          <p>On pace for <b className="num">{fmt((goalSum / daysDone) * daysInYr)}</b> by Dec 31.</p>
                          {goalLeft <= 0 ? (
                            <p className="muted">Goal reached with {plural(daysInYr - daysDone, "day")} to spare.</p>
                          ) : monthsLeft > 0 ? (
                            <p className="muted">{fmt(goalLeft / monthsLeft)} a month from here hits it.</p>
                          ) : null}
                        </>
                      )}
                    </>
                  )}
                </div>
              </article>

              <article className="card">
                <h2>Next paydays</h2>
                <ul className="list">
                  {upcoming.length ? (
                    upcoming.map((u) => {
                      const d = diffDays(today, u.next);
                      const when = d > 1 ? `in ${d} days` : d === 1 ? "tomorrow" : d === 0 ? "today" : `${plural(-d, "day")} late`;
                      return (
                        <li key={u.s.id}>
                          <span className="dot" style={{ "--c": u.s.color }} />
                          <span className="grow">
                            <b>{u.s.name}</b>
                            <span className="muted">{dateLabel(u.next, { weekday: "short", month: "short", day: "numeric" })} · {when} · every {u.gap} days</span>
                          </span>
                          <span className="num">≈ {fmt(u.amount)}</span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="muted">Log three paycheques from a source and Payday learns its schedule.</li>
                  )}
                </ul>
              </article>
            </div>
          </div>

          <div className="grid">
            <article className="card s5">
              <h2>{isAll ? "Cumulative income" : `${activeYear} against ${activeYear - 1}`}</h2>
              <div className="chart"><canvas ref={cumCanvas} role="img" aria-label={isAll ? "Cumulative income over time" : "Running total compared with prior year"} /></div>
            </article>
            <article className="card s3">
              <h2>Where it came from</h2>
              <div className="chart"><canvas ref={splitCanvas} role="img" aria-label="Share of income by source" /></div>
            </article>
            <article className="card s4">
              <h2>Records</h2>
              <dl className="stats">
                {data.paycheques.length ? (
                  <>
                    <div><dt>All time</dt><dd className="num">{fmt(sum(data.paycheques))}</dd></div>
                    <div><dt>Tracking since</dt><dd>{dateLabel(data.paycheques.at(-1).paid_on, { month: "long", year: "numeric" })}</dd></div>
                    <div><dt>Best month ever</dt><dd>{monthLabel(bestEver[0])}<br /><span className="num">{fmt(bestEver[1])}</span></dd></div>
                    <div><dt>Biggest deposit</dt><dd>{srcById(biggest.source_id).name}<br /><span className="num">{fmt(biggest.amount_cents)}</span></dd></div>
                  </>
                ) : (
                  <div className="muted">No paycheques yet.</div>
                )}
              </dl>
            </article>
          </div>

          <div className="grid">
            <article className="card s12">
              <div className="card-h">
                <h2>Latest paycheques</h2>
                <a className="btn" href="#paycheques">See all paycheques</a>
              </div>
              <ul className="list">
                {data.paycheques.length ? (
                  data.paycheques.slice(0, 5).map((p) => {
                    const s = srcById(p.source_id);
                    return (
                      <li key={p.id}>
                        <button className="item" type="button" onClick={() => openPay(p)} aria-label={`Edit ${s.name} paycheque of ${fmt(p.amount_cents)}`}>
                          <span className="dot" style={{ "--c": s.color }} />
                          <span className="grow">
                            <b>{s.name}</b>
                            <span className="muted">{dateLabel(p.paid_on)}{p.note ? ` · ${p.note}` : ""}</span>
                          </span>
                          <span className="num">{fmt(p.amount_cents)}</span>
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="muted">No paycheques yet. Press N to add one.</li>
                )}
              </ul>
            </article>
          </div>
        </section>

        <section hidden={tab !== "paycheques"}>
          <div className="head">
            <div><p className="eyebrow">Paycheques</p><h1>Every deposit, by month</h1></div>
            <a className="btn" href="/api/export.csv" download>Export to CSV</a>
          </div>
          <div className="card filters">
            <label className="field">Year
              <select value={fYear} onChange={(e) => setFYear(e.target.value)}>
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="field">Source
              <select value={fSource} onChange={(e) => setFSource(e.target.value)}>
                <option value="">All sources</option>
                {data.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field search">Search
              <input type="search" value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Note, source or amount" />
            </label>
          </div>
          <div className="card table-wrap">
            <table>
              <caption className="sr">Paycheques grouped by month</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Source</th>
                  <th scope="col">Note</th>
                  <th scope="col" className="num">Hours</th>
                  <th scope="col" className="num">Amount</th>
                </tr>
              </thead>
              {monthGroups.length ? (
                monthGroups.map(([ym, ps]) => (
                  <tbody key={ym}>
                    <tr className="month">
                      <th scope="rowgroup" colSpan={4}>{monthLabel(ym)} <span className="muted">· {plural(ps.length, "paycheque")}</span></th>
                      <td className="num">{fmt(sum(ps))}</td>
                    </tr>
                    {ps.map((p) => {
                      const s = srcById(p.source_id);
                      return (
                        <tr key={p.id} className="row" onClick={() => openPay(p)}>
                          <td>
                            <button className="link" type="button" onClick={(e) => { e.stopPropagation(); openPay(p); }} aria-label={`Edit paycheque from ${dateLabel(p.paid_on)}`}>
                              {dateLabel(p.paid_on, { weekday: "short", month: "short", day: "numeric" })}
                            </button>
                          </td>
                          <td><span className="who"><span className="dot" style={{ "--c": s.color }} />{s.name}</span></td>
                          <td className="muted">{p.note}</td>
                          <td className="num muted">{p.hours ? `${p.hours} h` : ""}</td>
                          <td className="num">{fmt(p.amount_cents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))
              ) : (
                <tbody><tr><td colSpan={5} className="empty">No paycheques match these filters.</td></tr></tbody>
              )}
              <tfoot>
                <tr>
                  <th colSpan={4}>{plural(filteredRows.length, "paycheque")}</th>
                  <td className="num">{fmt(sum(filteredRows))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section hidden={tab !== "sources"}>
          <div className="head">
            <div><p className="eyebrow">Sources</p><h1>Jobs and other income</h1></div>
            <button className="btn primary" type="button" onClick={() => openSrc()}>Add a source</button>
          </div>
          <div className="grid">
            {data.sources.length ? (
              data.sources.map((s) => {
                const ps = data.paycheques.filter((p) => p.source_id === s.id);
                const t = sum(ps);
                const timed = ps.filter((p) => p.hours);
                const hrs = timed.reduce((h, p) => h + p.hours, 0);
                const { items, yrs, max } = sparkValues(s.id);
                const goDetail = () => { location.hash = `#source/${s.id}`; };
                return (
                  <article
                    key={s.id}
                    className="card src clickable s4"
                    style={{ "--c": s.color }}
                    role="link"
                    tabIndex={0}
                    aria-label={`${s.name} — view source details`}
                    onClick={goDetail}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goDetail();
                      }
                    }}
                  >
                    <div className="src-head">
                      <span className="swatch" />
                      <h2>{s.name}</h2>
                      <span className="tag">{KIND[s.kind]}</span>
                      {s.archived ? <span className="tag">Archived</span> : null}
                    </div>
                    <div className="spark-wrap">
                      <div className="spark-head">
                        <span>Last 12 months</span>
                        <span className="num">{yrs.map((g) => g.y).join(" – ")}</span>
                      </div>
                      <div className="spark-grid" role="img" aria-label={`Last 12 months income for ${s.name}`}>
                        {items.map((it) => (
                          <div key={it.k} className="spark-col" data-tip={fmt(it.v)} aria-label={`${MONTHS[it.m - 1]} ${it.y}: ${fmt(it.v)}`}>
                            <div className="spark-track">
                              <span
                                className={it.v ? "spark-bar" : "spark-bar z"}
                                style={{ height: it.v ? `${Math.max(8, (it.v / max) * 100)}%` : "3px" }}
                              />
                            </div>
                            <span className="spark-m num">{it.m}</span>
                          </div>
                        ))}
                      </div>
                      <div className="spark-yrs num" aria-hidden="true">
                        {yrs.map((g) => (
                          <span key={g.y} style={{ gridColumn: `span ${g.span}` }}>{g.y}</span>
                        ))}
                      </div>
                    </div>
                    <dl className="stats">
                      <div><dt>All time</dt><dd className="num">{fmt(t)}</dd></div>
                      <div><dt>Paycheques</dt><dd className="num">{ps.length}</dd></div>
                      <div><dt>Average deposit</dt><dd className="num">{ps.length ? fmt(t / ps.length) : "—"}</dd></div>
                      <div><dt>Last paid</dt><dd>{ps.length ? dateLabel(ps[0].paid_on) : "—"}</dd></div>
                      {hrs ? (
                        <Fragment>
                          <div><dt>Take-home per hour</dt><dd className="num">{fmt(sum(timed) / hrs)}</dd></div>
                          <div><dt>Hours logged</dt><dd className="num">{+hrs.toFixed(2)}</dd></div>
                        </Fragment>
                      ) : null}
                    </dl>
                    <div className="src-foot">
                      <span className="src-open">
                        View details
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3.5 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <button
                        className="btn"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSrc(s);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="muted s12">No sources yet. Add your first job.</p>
            )}
          </div>
        </section>

        <section hidden={tab !== "source"}>
          {activeSrc ? (
            <Fragment>
              <div className="detail-bar">
                <a className="back-link" href="#sources">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M12.5 8h-9M7.5 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  All sources
                </a>
                <div className="detail-actions">
                  <button className="btn" type="button" onClick={() => openSrc(activeSrc)}>
                    Edit {activeSrc.name}
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => openPay(null, data, today || iso(new Date()), activeSrc.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Add to {activeSrc.name}
                  </button>
                </div>
              </div>

              <div className="hero src-hero" style={{ "--c": activeSrc.color }}>
                <div>
                  <div className="src-hero-meta">
                    <span className="swatch" />
                    <h1>{activeSrc.name}</h1>
                    <span className="hero-tag">{KIND[activeSrc.kind]}</span>
                    {activeSrc.archived ? <span className="hero-tag">Archived</span> : null}
                  </div>
                  <p className="big">{fmt(srcSum)}</p>
                  <p className="delta">
                    {srcPs.length ? (
                      <Fragment>
                        <b>{plural(srcPs.length, "paycheque")}</b> · <b>{srcSharePct}%</b> of {srcIsAll ? "all-time" : srcYear} income ·{" "}
                        {dateLabel(srcPs.at(-1).paid_on, { month: "short", day: "numeric", year: "numeric" })} –{" "}
                        {dateLabel(srcPs[0].paid_on, { month: "short", day: "numeric", year: "numeric" })}
                      </Fragment>
                    ) : (
                      `No paycheques recorded for ${activeSrc.name}${srcIsAll ? " yet" : ` in ${srcYear}`}.`
                    )}
                  </p>
                </div>
                <div className="hero-side">
                  <div className="year-dd" ref={srcYearDdRef}>
                    <button
                      type="button"
                      className="year-btn"
                      aria-haspopup="listbox"
                      aria-expanded={srcYearOpen}
                      aria-label={`Year: ${srcIsAll ? "All" : srcYear}`}
                      onClick={() => setSrcYearOpen((o) => !o)}
                    >
                      <span className="year-lbl">Year</span>
                      <span className="year-val">{srcIsAll ? "All" : srcYear}</span>
                      <svg className="year-chev" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {srcYearOpen ? (
                      <ul className="year-menu" role="listbox" aria-label="Select source year">
                        {srcYearOptions.map(([val, label, tot]) => {
                          const selected = srcYear === val;
                          return (
                            <li key={val}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={selected ? "year-opt active" : "year-opt"}
                                onClick={() => {
                                  setSrcYear(val);
                                  setSrcYearOpen(false);
                                }}
                              >
                                <svg className="year-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                  <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                  <p className="muted">
                    {(() => {
                      const up = upcoming.find((u) => u.s.id === activeSrc.id);
                      if (up) return `Next est. ${dateLabel(up.next, { month: "short", day: "numeric" })} · ~${fmt(up.amount)}`;
                      if (srcCadence.weekday) {
                        return `Usually paid on ${srcCadence.weekday}s${srcCadence.gap ? ` · ~${srcCadence.gap}d cycle` : ""}`;
                      }
                      return plural(srcYears.length, "active year");
                    })()}
                  </p>
                </div>
              </div>

              <div className="grid">
                <article className="card kpi s3">
                  <p className="label">Average deposit</p>
                  <p className="val num">{srcPs.length ? fmt(srcAvg) : "—"}</p>
                  <p className="sub">
                    {srcPs.length ? `Range ${fmt(srcMinP.amount_cents)} – ${fmt(srcMaxP.amount_cents)}` : "No pay yet"}
                  </p>
                </article>
                <article className="card kpi s3">
                  <p className="label">Monthly average</p>
                  <p className="val num">{srcActiveMonths ? fmt(srcSum / srcActiveMonths) : "—"}</p>
                  <p className="sub">
                    {srcActiveMonths ? `across ${plural(srcActiveMonths, "month")} with pay` : "No pay yet"}
                  </p>
                </article>
                <article className="card kpi s3">
                  <p className="label">Best month</p>
                  <p className="val">
                    {srcBestMonth ? dateLabel(srcBestMonth[0] + "-01", { month: "short", year: "numeric" }) : "—"}
                  </p>
                  <p className="sub">{srcBestMonth ? fmt(srcBestMonth[1]) : "No pay yet"}</p>
                </article>
                <article className="card kpi s3">
                  {srcHours > 0 ? (
                    <Fragment>
                      <p className="label">Take-home per hour</p>
                      <p className="val num">{fmt(srcTimedSum / srcHours)}</p>
                      <p className="sub">{+srcHours.toFixed(2)} h across {plural(srcTimed.length, "paycheque")}</p>
                    </Fragment>
                  ) : (
                    <Fragment>
                      <p className="label">Pay cadence</p>
                      <p className="val">{srcCadence.gap ? `Every ~${srcCadence.gap} days` : srcCadence.weekday || "—"}</p>
                      <p className="sub">{srcPs.length ? `Median deposit ${fmt(srcMedian)}` : "No pay yet"}</p>
                    </Fragment>
                  )}
                </article>
              </div>

              <div className="grid">
                <article className="card s8">
                  <div className="card-h">
                    <h2>Monthly income · {activeSrc.name}</h2>
                    <span className="muted">{srcIsAll ? "All recorded months" : `Jan – Dec ${srcYear}`}</span>
                  </div>
                  <div className="chart tall">
                    <canvas ref={srcChartCanvas} role="img" aria-label={`Monthly income chart for ${activeSrc.name}`} />
                  </div>
                </article>
                <div className="s4 stack">
                  <article className="card">
                    <div className="card-h">
                      <h2>By year</h2>
                      {!srcIsAll ? (
                        <button className="link muted" type="button" onClick={() => setSrcYear("all")}>
                          Show all
                        </button>
                      ) : null}
                    </div>
                    <ul className="list">
                      {srcYears.map((y) => {
                        const yPs = srcAllPs.filter((p) => p.paid_on.startsWith(y + "-"));
                        const yTot = sum(yPs);
                        const allTot = Math.max(sum(srcAllPs), 1);
                        const pct = Math.round((yTot / allTot) * 100);
                        const isSel = srcYear === y;
                        return (
                          <li key={y}>
                            <button
                              type="button"
                              className={isSel ? "item active-yr" : "item"}
                              onClick={() => setSrcYear(isSel ? "all" : y)}
                            >
                              <span className="grow">
                                <b>{y} <span className="muted">· {plural(yPs.length, "paycheque")}</span></b>
                                <span className="yr-bar">
                                  <i style={{ width: `${Math.max(4, pct)}%`, background: activeSrc.color }} />
                                </span>
                              </span>
                              <span className="yr-right">
                                <span className="num">{fmt(yTot)}</span>
                                <span className="muted num">{pct}%</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </article>

                  <article className="card">
                    <h2>Source records</h2>
                    <ul className="list">
                      {srcMaxP ? (
                        <Fragment>
                          <li>
                            <button type="button" className="item" onClick={() => openPay(srcMaxP)}>
                              <span className="grow">
                                <b>Biggest deposit</b>
                                <span className="muted">{dateLabel(srcMaxP.paid_on)}{srcMaxP.note ? ` · ${srcMaxP.note}` : ""}</span>
                              </span>
                              <span className="num">{fmt(srcMaxP.amount_cents)}</span>
                            </button>
                          </li>
                          <li>
                            <button type="button" className="item" onClick={() => openPay(srcMinP)}>
                              <span className="grow">
                                <b>Smallest deposit</b>
                                <span className="muted">{dateLabel(srcMinP.paid_on)}{srcMinP.note ? ` · ${srcMinP.note}` : ""}</span>
                              </span>
                              <span className="num">{fmt(srcMinP.amount_cents)}</span>
                            </button>
                          </li>
                          <li>
                            <span className="grow">
                              <b>Median deposit</b>
                              <span className="muted">Middle paycheque in {srcIsAll ? "all years" : srcYear}</span>
                            </span>
                            <span className="num">{fmt(srcMedian)}</span>
                          </li>
                        </Fragment>
                      ) : (
                        <li className="muted">No paycheques recorded yet.</li>
                      )}
                    </ul>
                  </article>
                </div>
              </div>

              <div className="card table-wrap src-ledger">
                <div className="ledger-head">
                  <div>
                    <h2>Paycheques from {activeSrc.name}</h2>
                    <p className="muted">
                      {plural(srcFilteredRows.length, "paycheque")} in {srcIsAll ? "all years" : srcYear} · click any row to edit
                    </p>
                  </div>
                  <div className="ledger-tools">
                    <input
                      type="search"
                      placeholder="Search notes, dates, or amounts…"
                      aria-label={`Search ${activeSrc.name} paycheques`}
                      value={srcSearch}
                      onChange={(e) => setSrcSearch(e.target.value)}
                    />
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Note</th>
                      <th scope="col" className="num">Hours</th>
                      <th scope="col" className="num">vs. Avg</th>
                      <th scope="col" className="num">Amount</th>
                    </tr>
                  </thead>
                  {srcMonthGroups.length ? (
                    srcMonthGroups.map(([ym, ps]) => {
                      const mHrs = ps.reduce((t, p) => t + (p.hours || 0), 0);
                      return (
                        <tbody key={ym}>
                          <tr className="month">
                            <th scope="rowgroup" colSpan={2}>
                              {monthLabel(ym)} <span className="muted">· {plural(ps.length, "paycheque")}</span>
                            </th>
                            <td className="num muted">{mHrs ? `${+mHrs.toFixed(2)} h` : ""}</td>
                            <td />
                            <td className="num">{fmt(sum(ps))}</td>
                          </tr>
                          {ps.map((p) => {
                            const diff = p.amount_cents - srcAvg;
                            const pctDiff = srcAvg ? Math.round((diff / srcAvg) * 100) : 0;
                            return (
                              <tr key={p.id} className="row" onClick={() => openPay(p)}>
                                <td>
                                  <button
                                    className="link"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPay(p);
                                    }}
                                  >
                                    {dateLabel(p.paid_on, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                                  </button>
                                </td>
                                <td className="muted">{p.note || "—"}</td>
                                <td className="num muted">
                                  {p.hours ? (
                                    <span>
                                      {p.hours} h <small className="rate-sub">({fmt(p.amount_cents / p.hours)}/h)</small>
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="num">
                                  {Math.abs(pctDiff) < 1 ? (
                                    <span className="vs-avg">Avg</span>
                                  ) : (
                                    <span className={diff > 0 ? "vs-avg up" : "vs-avg down"}>
                                      {diff > 0 ? "+" : ""}
                                      {pctDiff}%
                                    </span>
                                  )}
                                </td>
                                <td className="num">{fmt(p.amount_cents)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      );
                    })
                  ) : (
                    <tbody>
                      <tr>
                        <td colSpan={5} className="empty">
                          No paycheques match this filter.
                        </td>
                      </tr>
                    </tbody>
                  )}
                  <tfoot>
                    <tr>
                      <th colSpan={2}>{plural(srcFilteredRows.length, "paycheque")}</th>
                      <td className="num muted">
                        {(() => {
                          const totH = srcFilteredRows.reduce((t, p) => t + (p.hours || 0), 0);
                          return totH ? `${+totH.toFixed(2)} h` : "";
                        })()}
                      </td>
                      <td />
                      <td className="num">{fmt(sum(srcFilteredRows))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Fragment>
          ) : (
            <div className="card empty">
              <p>Source not found.</p>
              <p style={{ marginTop: 12 }}>
                <a className="btn" href="#sources">Back to Sources</a>
              </p>
            </div>
          )}
        </section>
      </main>

      <dialog ref={payDlgRef} aria-labelledby="payTitle">
        <form onSubmit={submitPay}>
          <h2 id="payTitle">{payForm.id ? "Edit paycheque" : "Add paycheque"}</h2>
          <fieldset className="chips">
            <legend>Source</legend>
            {chipSources.map((s) => (
              <label key={s.id} className="chip" style={{ "--c": s.color }}>
                <input
                  type="radio"
                  name="source_id"
                  value={s.id}
                  required
                  checked={+payForm.source_id === s.id}
                  onChange={() => setPayForm((f) => ({ ...f, source_id: s.id }))}
                />
                <span><i className="dot" />{s.name}</span>
              </label>
            ))}
            <button type="button" className="chip-add" onClick={() => openSrc()}>+ New source</button>
          </fieldset>
          <label className="field">Take-home amount
            <span className="money-in">
              <span aria-hidden="true">$</span>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </span>
          </label>
          {lastForSrc ? (
            <button
              type="button"
              className="btn same"
              onClick={() => {
                setPayForm((f) => ({ ...f, amount: (lastForSrc.amount_cents / 100).toFixed(2) }));
                amountRef.current?.focus();
              }}
            >
              Same as last time: {fmt(lastForSrc.amount_cents)}
            </button>
          ) : null}
          <div className="row2">
            <label className="field">Date paid
              <input
                type="date"
                required
                value={payForm.paid_on}
                onChange={(e) => setPayForm((f) => ({ ...f, paid_on: e.target.value }))}
              />
            </label>
            <label className="field"><span>Hours worked <span className="opt">(optional)</span></span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={payForm.hours}
                onChange={(e) => setPayForm((f) => ({ ...f, hours: e.target.value }))}
              />
            </label>
          </div>
          <label className="field"><span>Note <span className="opt">(optional)</span></span>
            <input
              maxLength={200}
              placeholder="Holiday pay, bonus, tips…"
              value={payForm.note}
              onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>
          <p className="err" role="alert">{payErr}</p>
          <div className="actions">
            {payForm.id ? <button type="button" className="btn danger" onClick={deletePay}>Delete paycheque</button> : null}
            <span className="sp" />
            <button type="button" className="btn" onClick={() => payDlgRef.current?.close()}>Cancel</button>
            <button className="btn primary">Save paycheque</button>
          </div>
        </form>
      </dialog>

      <dialog ref={srcDlgRef} aria-labelledby="srcTitle">
        <form onSubmit={submitSrc}>
          <h2 id="srcTitle">{srcForm.id ? `Edit ${srcForm.name || "source"}` : "Add a source"}</h2>
          <label className="field">Name
            <input
              ref={srcNameRef}
              maxLength={60}
              required
              placeholder="Employer or payer"
              value={srcForm.name}
              onChange={(e) => setSrcForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <div className="row2">
            <label className="field">Kind
              <select value={srcForm.kind} onChange={(e) => setSrcForm((f) => ({ ...f, kind: e.target.value }))}>
                <option value="job">Job</option>
                <option value="government">Government</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">Colour
              <input type="color" value={srcForm.color} onChange={(e) => setSrcForm((f) => ({ ...f, color: e.target.value }))} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={srcForm.archived} onChange={(e) => setSrcForm((f) => ({ ...f, archived: e.target.checked }))} />
            Archived (finished job, hidden from quick add)
          </label>
          <p className="err" role="alert">{srcErr}</p>
          <div className="actions">
            {srcForm.id ? <button type="button" className="btn danger" onClick={deleteSrc}>Delete source</button> : null}
            <span className="sp" />
            <button type="button" className="btn" onClick={() => srcDlgRef.current?.close()}>Cancel</button>
            <button className="btn primary">Save source</button>
          </div>
        </form>
      </dialog>

      <dialog ref={goalDlgRef} aria-labelledby="goalTitle">
        <form onSubmit={(e) => { e.preventDefault(); saveGoal(goalVal); }}>
          <h2 id="goalTitle">Yearly income goal</h2>
          <label className="field">Take-home goal for the year
            <span className="money-in">
              <span aria-hidden="true">$</span>
              <input
                ref={goalInputRef}
                type="number"
                step="1"
                min="1"
                inputMode="decimal"
                placeholder="30000"
                value={goalVal}
                onChange={(e) => setGoalVal(e.target.value)}
              />
            </span>
          </label>
          <p className="err" role="alert">{goalErr}</p>
          <div className="actions">
            {goal ? <button type="button" className="btn danger" onClick={() => saveGoal("")}>Remove goal</button> : null}
            <span className="sp" />
            <button type="button" className="btn" onClick={() => goalDlgRef.current?.close()}>Cancel</button>
            <button className="btn primary">Save goal</button>
          </div>
        </form>
      </dialog>

      <div id="toast" className={toastState ? "show" : undefined} role="status" aria-live="polite">
        {toastState ? (
          <>
            <span>{toastState.msg}</span>
            {toastState.undo ? (
              <button
                type="button"
                onClick={() => {
                  const fn = toastState.undo;
                  setToastState(null);
                  fn().catch((err) => toast(err.message));
                }}
              >
                Undo
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

