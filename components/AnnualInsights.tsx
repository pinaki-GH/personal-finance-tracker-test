"use client";

import { useMemo, useState } from "react";
import { getMonthlySnapshots, type MonthlySnapshot } from "../utils/storage";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const change = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency(Math.abs(value))}`;

type MonthRow = { month: string; label: string; snapshot: MonthlySnapshot | null; assets: number | null; liabilities: number | null; netWorth: number | null; change: number | null };

function LineChart({ rows, metric, title }: { rows: MonthRow[]; metric: "assets" | "liabilities" | "netWorth"; title: string }) {
  const values = rows.map(row => row[metric]);
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return <div className="card"><h3>{title}</h3><p>No saved snapshots for this year yet.</p></div>;
  const min = Math.min(0, ...known);
  const max = Math.max(1, ...known);
  const width = 720, height = 220, left = 44, right = 12, top = 18, bottom = 32;
  const x = (i: number) => left + i * (width - left - right) / 11;
  const y = (v: number) => top + (max - v) * (height - top - bottom) / (max - min || 1);
  const points = rows.map((row, i) => row[metric] === null ? null : `${x(i)},${y(row[metric] as number)}`).filter(Boolean).join(" ");
  return <div className="card" style={{ minWidth: 0 }}><h3>{title}</h3><div style={{ width: "100%", overflowX: "auto" }}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} across the year`} style={{ display: "block", width: "100%", minWidth: 520 }}>
    {[0, 1, 2, 3].map(tick => { const value = max - tick * (max - min) / 3; const yy = y(value); return <g key={tick}><line x1={left} y1={yy} x2={width - right} y2={yy} stroke="var(--border, #e5e7eb)" strokeDasharray="3 4"/><text x={left - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="currentColor">{new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}</text></g>; })}
    {points && <polyline points={points} fill="none" stroke="var(--primary, #2563eb)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}
    {rows.map((row, i) => <g key={row.month}>{row[metric] !== null && <circle cx={x(i)} cy={y(row[metric] as number)} r="4" fill="var(--primary, #2563eb)"><title>{`${row.label}: ${currency(row[metric] as number)}`}</title></circle>}<text x={x(i)} y={height - 9} textAnchor="middle" fontSize="10" fill="currentColor">{row.label.slice(0, 3)}</text></g>)}
  </svg></div><p style={{ color: "var(--muted-foreground, #64748b)", fontSize: 12, marginBottom: 0 }}>Only saved monthly snapshots are plotted; gaps indicate months without a snapshot.</p></div>;
}

export default function AnnualInsights() {
  const [snapshots] = useState<MonthlySnapshot[]>(() => getMonthlySnapshots());
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const years = useMemo(() => {
    const list = new Set(snapshots.map(s => s.month.slice(0, 4)));
    list.add(String(new Date().getFullYear()));
    return Array.from(list).sort((a, b) => Number(b) - Number(a));
  }, [snapshots]);
  const rows = useMemo<MonthRow[]>(() => {
    const byMonth = new Map(snapshots.filter(s => s.month.startsWith(`${selectedYear}-`)).map(s => [s.month, s]));
    let previous: number | null = null;
    return MONTHS.map((label, i) => {
      const month = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
      const snapshot = byMonth.get(month) ?? null;
      const assets = snapshot?.totals?.totalAssets ?? null;
      const liabilities = snapshot?.totals?.totalLiabilities ?? null;
      const netWorth = snapshot?.totals?.netWorth ?? null;
      const monthChange = netWorth !== null && previous !== null ? netWorth - previous : null;
      if (netWorth !== null) previous = netWorth;
      return { month, label, snapshot, assets, liabilities, netWorth, change: monthChange };
    });
  }, [snapshots, selectedYear]);
  const savedRows = rows.filter(row => row.snapshot);
  const latest = savedRows[savedRows.length - 1] ?? null;
  const first = savedRows[0] ?? null;
  const annualNetWorthChange = first && latest && first.month !== latest.month ? (latest.netWorth as number) - (first.netWorth as number) : null;
  const priorYearLatest = snapshots.filter(s => s.month.startsWith(`${Number(selectedYear) - 1}-`)).sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  const currentYearLatest = latest?.snapshot;
  const yearOverYear = priorYearLatest && currentYearLatest ? currentYearLatest.totals.netWorth - priorYearLatest.totals.netWorth : null;
  const yearOverYearPercent = yearOverYear !== null && priorYearLatest ? (priorYearLatest.totals.netWorth === 0 ? null : yearOverYear / Math.abs(priorYearLatest.totals.netWorth) * 100) : null;

  return <section>
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div><h2 style={{ marginTop: 0, marginBottom: 6 }}>Full-Year Financial Insights</h2><p style={{ margin: 0 }}>Annual trends calculated from your saved monthly snapshots.</p></div>
      <div><label htmlFor="insights-year" style={{ display: "block", marginBottom: 6 }}>Calendar year</label><select id="insights-year" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></div>
    </div>

    <div className="summary-grid" style={{ marginTop: 16 }}>
      <div className="summary-card"><p style={{ margin: 0 }}>Latest saved assets</p><h2>{latest ? currency(latest.assets as number) : "—"}</h2><small>{latest ? latest.label : "No snapshots saved"}</small></div>
      <div className="summary-card"><p style={{ margin: 0 }}>Latest saved liabilities</p><h2>{latest ? currency(latest.liabilities as number) : "—"}</h2><small>{latest ? latest.label : "No snapshots saved"}</small></div>
      <div className="summary-card highlight"><p style={{ margin: 0 }}>Latest saved net worth</p><h2>{latest ? currency(latest.netWorth as number) : "—"}</h2><small>{latest ? latest.label : "No snapshots saved"}</small></div>
    </div>

    <div className="summary-grid">
      <div className="summary-card"><p style={{ margin: 0 }}>Change: first to latest snapshot</p><h3>{change(annualNetWorthChange)}</h3><small>{first && latest ? `${first.label} → ${latest.label}` : "Save at least two months to compare"}</small></div>
      <div className="summary-card"><p style={{ margin: 0 }}>Year-over-year net worth change</p><h3>{change(yearOverYear)}</h3><small>{priorYearLatest && currentYearLatest ? `${priorYearLatest.month} snapshot → ${currentYearLatest.month} snapshot` : "Requires a snapshot in this and the previous year"}</small></div>
      <div className="summary-card"><p style={{ margin: 0 }}>Year-over-year change (%)</p><h3>{percent(yearOverYearPercent)}</h3><small>Based on the latest available snapshot in each year</small></div>
    </div>

    <div className="two-column" style={{ alignItems: "start" }}>
      <LineChart rows={rows} metric="assets" title="Assets across the year" />
      <LineChart rows={rows} metric="liabilities" title="Liabilities across the year" />
    </div>
    <LineChart rows={rows} metric="netWorth" title="Net worth trend across the year" />

    <div className="card"><h3>{selectedYear} monthly comparison</h3><p>Months without a saved snapshot are shown as unavailable. Month-to-month change compares with the preceding month that has a saved snapshot.</p><div className="table-scroll-wrapper"><table className="data-table" style={{ minWidth: 760 }}><thead><tr><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Month</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Total Assets</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Total Liabilities</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Net Worth</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Change in Net Worth</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Status</th></tr></thead><tbody>{rows.map(row => <tr key={row.month}><td>{row.label}</td><td>{row.assets === null ? "—" : currency(row.assets)}</td><td>{row.liabilities === null ? "—" : currency(row.liabilities)}</td><td>{row.netWorth === null ? "—" : currency(row.netWorth)}</td><td>{change(row.change)}</td><td>{row.snapshot ? "Saved" : "No snapshot"}</td></tr>)}</tbody></table></div><p style={{ marginBottom: 0, marginTop: 12 }}>Snapshots saved for {savedRows.length} of 12 months in {selectedYear}.</p></div>

    <div className="card"><h3>How to read this report</h3><ul><li>Monthly figures are taken from the saved snapshot for that calendar month, not from today's live records.</li><li>The first-to-latest change compares the earliest and latest available snapshots in the selected year.</li><li>Year-over-year change compares the latest available snapshot in the selected year with the latest available snapshot in the previous year. It is not necessarily a same-month comparison.</li><li>If a prior net worth is zero, percentage change is shown as unavailable to avoid division by zero.</li></ul></div>
  </section>;
}
