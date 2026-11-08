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
  const [ovYear, setOvYear] = useState(null);
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
  const amountRef = useRef(null);
  const srcNameRef = useRef(null);
  const goalInputRef = useRef(null);
  const bigTotalRef = useRef(null);
  const countedRef = useRef(false);
  const toastTimer = useRef(null);
  const monthlyCanvas = useRef(null);
  const cumCanvas = useRef(null);
  const splitCanvas = useRef(null);

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
    (p, snap = data, nowStr = today || iso(new Date())) => {
      const activeSources = snap.sources.filter((s) => !s.archived || s.id === p?.source_id);
      const defaultSrc = p ? p.source_id : upcoming[0]?.s.id ?? snap.paycheques[0]?.source_id ?? activeSources[0]?.id ?? 0;
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
    [data, today, upcoming]
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
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openPay]);

  // Overview calculations
  const isCur = activeYear === curYear;
  const inY = useMemo(
    () => data.paycheques.filter((p) => p.paid_on.startsWith(activeYear + "-")),
    [data.paycheques, activeYear]
  );
  const sumY = useMemo(() => sum(inY), [inY]);

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
    const run = (yr, stop) => {
      let t = 0;
      return MONTHS.map((_, m) => {
        if (m > stop) return null;
        t += sum(data.paycheques.filter((p) => p.paid_on.startsWith(`${yr}-${pad(m + 1)}`)));
        return t / 100;
      });
    };

    const c1 = new Chart(monthlyCanvas.current, {
      type: "bar",
      data: {
        labels: MONTHS,
        datasets: used.map((s) => ({
          label: s.name,
          backgroundColor: s.color,
          borderRadius: 4,
          maxBarThickness: 46,
          data: MONTHS.map((_, m) => sum(inY.filter((p) => p.source_id === s.id && +p.paid_on.slice(5, 7) === m + 1)) / 100),
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
      data: {
        labels: MONTHS,
        datasets: [
          { label: String(activeYear), data: run(activeYear, isCur ? curMonth : 11), borderColor: "#0d7480", backgroundColor: "rgba(13,116,128,.09)", fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5 },
          { label: String(activeYear - 1), data: run(activeYear - 1, 11), borderColor: "#9aa8af", borderDash: [5, 4], tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
        ],
      },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: { x: { grid: { display: false } }, y: { border: { display: false }, ticks: { callback: short } } },
        plugins: { legend, tooltip: { callbacks: { label: money } } },
      },
    });
    return () => { c1.destroy(); c2.destroy(); c3.destroy(); };
  }, [ready, tab, data.sources, data.paycheques, inY, bySrc, sumY, activeYear, isCur, today]);

  // Derived overview stats
  const cutoff = isCur && today ? `${activeYear - 1}-${today.slice(5)}` : `${activeYear - 1}-12-31`;
  const prevTotal = sum(data.paycheques.filter((p) => p.paid_on.startsWith(activeYear - 1 + "-") && p.paid_on <= cutoff));
  const prevPct = prevTotal ? ((sumY - prevTotal) / prevTotal) * 100 : null;
  const thisMonthTotal = today ? sum(data.paycheques.filter((p) => p.paid_on.startsWith(today.slice(0, 7)))) : 0;

  const byMonth = Array(12).fill(0);
  inY.forEach((p) => (byMonth[+p.paid_on.slice(5, 7) - 1] += p.amount_cents));
  const activeMonths = byMonth.filter(Boolean).length;
  const bestIdx = byMonth.indexOf(Math.max(...byMonth));
  const topSrc = [...bySrc].sort((a, b) => b[1] - a[1])[0];

  const goal = +data.settings.goal_cents || 0;
  const goalPct = goal ? Math.min(100, (sumY / goal) * 100) : 0;
  const daysInYr = diffDays(`${activeYear}-01-01`, `${activeYear + 1}-01-01`);
  const daysDone = isCur && today ? diffDays(`${activeYear}-01-01`, today) + 1 : daysInYr;
  const goalLeft = goal - sumY;
  const monthsLeft = (daysInYr - daysDone) / 30.44;

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
    const vals = Array.from({ length: 12 }, (_, i) => {
      const k = iso(new Date(base.getFullYear(), base.getMonth() - 11 + i, 1)).slice(0, 7);
      return sum(data.paycheques.filter((p) => p.source_id === sourceId && p.paid_on.startsWith(k)));
    });
    return { vals, max: Math.max(...vals, 1) };
  };

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
      await api("DELETE", "sources/" + srcForm.id);
      srcDlgRef.current?.close();
      toast("Source deleted");
      await reload();
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
              <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined}>{label}</a>
            ))}
          </nav>
          <button className="btn primary" type="button" onClick={() => openPay()}>
            Add paycheque <kbd aria-hidden="true">N</kbd>
          </button>
        </div>
      </header>

      <main id="main" className="wrap" tabIndex={-1}>
        <section hidden={tab !== "overview"}>
          <div className="hero" data-enter={entered ? undefined : ""} onAnimationEnd={() => setEntered(true)}>
            <div>
              <h1>{isCur ? `Earned so far in ${activeYear}` : `Earned in ${activeYear}`}</h1>
              <p className="big" ref={bigTotalRef}>$0.00</p>
              <p className="delta">
                {prevPct !== null ? (
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
              <label className="sr" htmlFor="ovYear">Year</label>
              <select id="ovYear" value={activeYear} onChange={(e) => setOvYear(+e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <p className="muted">{isCur ? `${fmt(thisMonthTotal)} so far this month` : plural(inY.length, "paycheque")}</p>
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
              <p className="val">{sumY ? dateLabel(`${activeYear}-${pad(bestIdx + 1)}-01`, { month: "long" }) : "—"}</p>
              <p className="sub">{sumY ? fmt(byMonth[bestIdx]) : "No pay yet"}</p>
            </article>
            <article className="card kpi s3">
              <p className="label">Paycheques</p>
              <p className="val num">{inY.length}</p>
              <p className="sub">{inY.length ? `${fmt(sumY / inY.length)} each on average` : "None yet"}</p>
            </article>
            <article className="card kpi s3">
              <p className="label">Top source</p>
              <p className="val">{topSrc ? srcById(topSrc[0]).name : "—"}</p>
              <p className="sub">{topSrc ? `${Math.round((topSrc[1] / sumY) * 100)}% of ${activeYear} income` : "None yet"}</p>
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
                        <span className="num">{fmt(sumY)}</span> <span className="muted">of <span className="num">{fmt(goal)}</span></span>
                      </p>
                      <progress max="100" value={goalPct} aria-label={`Progress toward the ${activeYear} goal`}>{goalPct.toFixed(0)}%</progress>
                      <p className="muted">{goalPct.toFixed(0)}% of the {activeYear} goal</p>
                      {isCur && (
                        <>
                          <p>On pace for <b className="num">{fmt((sumY / daysDone) * daysInYr)}</b> by Dec 31.</p>
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
              <h2>This year against last year</h2>
              <div className="chart"><canvas ref={cumCanvas} role="img" aria-label="Running total this year compared with last year" /></div>
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
                const { vals, max } = sparkValues(s.id);
                return (
                  <article key={s.id} className="card src s4" style={{ "--c": s.color }}>
                    <div className="src-head">
                      <span className="swatch" />
                      <h2>{s.name}</h2>
                      <span className="tag">{KIND[s.kind]}</span>
                      {s.archived ? <span className="tag">Archived</span> : null}
                    </div>
                    <div>
                      <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Last 12 months</p>
                      <svg className="spark" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
                        {vals.map((v, i) => {
                          const h = v ? Math.max(3, (v / max) * 44) : 2;
                          return <rect key={i} className={v ? "" : "z"} x={i * 10 + 1} y={44 - h} width={8} height={h} rx={1.5} />;
                        })}
                      </svg>
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
                    <button className="btn" type="button" onClick={() => openSrc(s)}>Edit {s.name}</button>
                  </article>
                );
              })
            ) : (
              <p className="muted s12">No sources yet. Add your first job.</p>
            )}
          </div>
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

