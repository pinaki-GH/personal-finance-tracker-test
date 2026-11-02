"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  exportMonthlySnapshotsBackup,
  getMonthlySnapshot,
  getMonthlySnapshots,
  saveMonthlySnapshot,
  type MonthlySnapshot
} from "../utils/storage";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
};

const numberValue = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string" || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatSavedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
};

export default function MonthlyTracking() {
  const [month, setMonth] = useState(currentMonth);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<MonthlySnapshot | null>(null);
  const [status, setStatus] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [isClient, setIsClient] = useState(false);

  const refreshSnapshots = useCallback((selectedMonth: string) => {
    const allSnapshots = getMonthlySnapshots();
    setSnapshots(allSnapshots);
    setSelectedSnapshot(getMonthlySnapshot(selectedMonth));
  }, []);

  useEffect(() => {
    setIsClient(true);
    refreshSnapshots(month);
  }, [month, refreshSnapshots]);

  const previewTotals = useMemo(() => {
    if (!selectedSnapshot) return null;
    const totalAssets = selectedSnapshot.totals?.totalAssets ??
      selectedSnapshot.assets.reduce((sum, asset) => sum + numberValue(asset?.assetValue), 0);
    const totalLiabilities = selectedSnapshot.totals?.totalLiabilities ??
      selectedSnapshot.liabilities.reduce((sum, liability) => sum + numberValue(liability?.liabilityValue), 0);
    return {
      totalAssets,
      totalLiabilities,
      netWorth: selectedSnapshot.totals?.netWorth ?? totalAssets - totalLiabilities
    };
  }, [selectedSnapshot]);

  const saveSnapshot = () => {
    setStatus(null);
    const existing = getMonthlySnapshot(month);
    let replaceExisting = false;

    if (existing) {
      const confirmed = window.confirm(
        `A snapshot for ${monthLabel(month)} already exists (saved ${formatSavedAt(existing.savedAt)}).\n\nReplace it with the current Assets and Liabilities records? This will replace that month's saved snapshot.`
      );
      if (!confirmed) {
        setStatus({ kind: "info", text: "No changes made. The existing snapshot was kept." });
        return;
      }
      replaceExisting = true;
    } else {
      const confirmed = window.confirm(
        `Save the current Assets and Liabilities as the snapshot for ${monthLabel(month)}?\n\nThis records the values as they are now; it does not reconstruct historical values from that month.`
      );
      if (!confirmed) return;
    }

    const result = saveMonthlySnapshot(month, { replaceExisting });
    if (result.ok === false) {
      setStatus({ kind: "error", text: result.message });
      refreshSnapshots(month);
      return;
    }

    refreshSnapshots(month);
    setStatus({
      kind: "success",
      text: `${monthLabel(month)} snapshot ${result.replaced ? "replaced" : "saved"}. Assets: ${currency.format(result.snapshot.totals.totalAssets)} · Liabilities: ${currency.format(result.snapshot.totals.totalLiabilities)} · Net worth: ${currency.format(result.snapshot.totals.netWorth)}.`
    });
  };

  const exportBackup = () => {
    const success = exportMonthlySnapshotsBackup();
    setStatus(success
      ? { kind: "success", text: "Monthly snapshot backup downloaded as a JSON file." }
      : { kind: "error", text: "The backup could not be downloaded. Please try again." });
  };

  const hasSnapshot = Boolean(selectedSnapshot);

  return (
    <section className="monthly-tracking-section" style={{ color: "#172b4d", fontFamily: "inherit", display: "grid", gap: 18 }}>
      <style>{`
        .monthly-tracking-section { min-width: 0; }
        .monthly-tracking-section > header h2 {
          margin: 5px 0 0; font-size: 28px; line-height: 1.2;
          letter-spacing: -.04em; color: #172b4d;
        }
        .monthly-tracking-section .card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
          padding: 20px; box-shadow: 0 4px 18px rgba(20, 39, 60, .04); min-width: 0;
        }
        .monthly-tracking-section h3, .monthly-tracking-section h4 {
          color: #24364b; font-size: 16px; letter-spacing: -.02em;
        }
        .monthly-tracking-section p, .monthly-tracking-section small { color: #718096; }
        .monthly-tracking-section label {
          display: block; margin-bottom: 7px; color: #52637a;
          font-size: 12px; font-weight: 700;
        }
        .monthly-tracking-section input, .monthly-tracking-section select {
          width: 100%; min-width: 0; box-sizing: border-box; padding: 11px 12px;
          border: 1px solid #d9e2ec; border-radius: 10px; background: #fff;
          color: #172b4d; font: inherit; font-size: 14px;
        }
        .monthly-tracking-section input:focus, .monthly-tracking-section select:focus {
          outline: 2px solid rgba(23, 75, 59, .18); border-color: #5d8b78;
        }
        .monthly-tracking-section button {
          border: 1px solid #d9e2ec; border-radius: 10px; padding: 10px 14px;
          background: #fff; color: #24364b; font-weight: 700; cursor: pointer;
          transition: background .15s ease, border-color .15s ease;
        }
        .monthly-tracking-section button:hover { border-color: #b9c9d7; background: #f8fafc; }
        .monthly-tracking-section button.primary {
          background: #174b3b; border-color: #174b3b; color: #fff;
        }
        .monthly-tracking-section button.primary:hover { background: #103d30; }
        .monthly-tracking-section button:disabled { opacity: .5; cursor: not-allowed; }
        .monthly-tracking-section .summary-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
          padding: 18px; box-shadow: 0 4px 18px rgba(20, 39, 60, .04);
        }
        .monthly-tracking-section .summary-card.highlight {
          border-color: #c9ddd3; background: #f5faf7;
        }
        .monthly-tracking-section .summary-card strong { color: #172b4d; letter-spacing: -.03em; }
        .monthly-tracking-section .summary-card div { color: #718096; font-size: 12px !important; font-weight: 700; }
        .monthly-tracking-section .data-table {
          width: 100%; border-collapse: collapse; color: #52637a;
        }
        .monthly-tracking-section .data-table th {
          text-align: left; font-size: 11px; letter-spacing: .06em; color: #718096;
          padding: 12px 10px; background: #f7f9fc !important; border-bottom: 1px solid #e8edf2;
        }
        .monthly-tracking-section .data-table td {
          padding: 13px 10px; border-top: 1px solid #edf1f5; font-size: 13px; vertical-align: middle;
        }
        .monthly-tracking-section .data-table tbody tr:hover { background: #fbfcfd; }
        .monthly-tracking-section .table-scroll-wrapper {
          border: 1px solid #e8edf2; border-radius: 12px; background: #fff;
        }
        @media (max-width: 600px) {
          .monthly-tracking-section .card, .monthly-tracking-section .summary-card { padding: 14px; }
          .monthly-tracking-section > header h2 { font-size: 25px; }
        }
      `}</style>
      <header>
        <div>
          <div style={{ color: "#5d8b78", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>PERSONAL FINANCE</div>
          <h2>Monthly Tracking</h2>
          <p style={{ margin: "5px 0 0", maxWidth: 850, fontSize: 14 }}>
            Preserve monthly snapshots of your assets, liabilities and net worth over time.
          </p>
        </div>
      </header>

      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 16 }}>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <label htmlFor="snapshot-month" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Reporting month
            </label>
            <input
              id="snapshot-month"
              type="month"
              value={month}
              onChange={event => {
                setMonth(event.target.value);
                setStatus(null);
              }}
              style={{ boxSizing: "border-box", width: "100%", maxWidth: 320 }}
            />
          </div>
          <button className="primary" type="button" onClick={saveSnapshot} disabled={!isClient || !month}>
            {hasSnapshot ? "Update Monthly Snapshot" : "Save Monthly Snapshot"}
          </button>
          <button type="button" onClick={exportBackup} disabled={!isClient || snapshots.length === 0}>
            Export Snapshot Backup
          </button>
        </div>
        <p style={{ marginBottom: 0, fontSize: 13, opacity: 0.8 }}>
          Select any calendar month. When saving, the app captures the values currently in your Assets and Liabilities registers.
        </p>
      </div>

      {status && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          style={{
            border: `1px solid ${status.kind === "error" ? "#fecaca" : status.kind === "success" ? "#bbf7d0" : "#bfdbfe"}`,
            background: status.kind === "error" ? "#fef2f2" : status.kind === "success" ? "#f0fdf4" : "#eff6ff",
            color: status.kind === "error" ? "#991b1b" : status.kind === "success" ? "#166534" : "#1d4ed8",
            borderRadius: 8,
            padding: 12,
            marginBottom: 20
          }}
        >
          {status.text}
        </div>
      )}

      {hasSnapshot && selectedSnapshot && previewTotals ? (
        <>
          <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="summary-card">
              <div style={{ fontSize: 13, opacity: 0.75 }}>Total Assets</div>
              <strong style={{ display: "block", fontSize: 21, marginTop: 8 }}>{currency.format(previewTotals.totalAssets)}</strong>
              <small>{selectedSnapshot.assets.length} recorded items</small>
            </div>
            <div className="summary-card">
              <div style={{ fontSize: 13, opacity: 0.75 }}>Total Liabilities</div>
              <strong style={{ display: "block", fontSize: 21, marginTop: 8 }}>{currency.format(previewTotals.totalLiabilities)}</strong>
              <small>{selectedSnapshot.liabilities.length} recorded items</small>
            </div>
            <div className="summary-card highlight">
              <div style={{ fontSize: 13, opacity: 0.75 }}>Net Worth</div>
              <strong style={{ display: "block", fontSize: 21, marginTop: 8 }}>{currency.format(previewTotals.netWorth)}</strong>
              <small>Assets minus liabilities</small>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Snapshot details — {monthLabel(selectedSnapshot.month)}</h3>
            <p style={{ marginBottom: 0 }}>Saved on: <strong>{formatSavedAt(selectedSnapshot.savedAt)}</strong></p>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 0 }}>
              These are the records captured when this snapshot was saved. They are not automatically adjusted to month-end market values.
            </p>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Assets in this snapshot</h3>
            {selectedSnapshot.assets.length === 0 ? <p>No assets were recorded in this snapshot.</p> : (
              <div className="table-scroll-wrapper" role="region" aria-label="Snapshot assets" tabIndex={0}>
                <table className="data-table" style={{ minWidth: 720 }}>
                  <thead><tr><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Asset Name</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Category</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Owner</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Value</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Value record date</th></tr></thead>
                  <tbody>{selectedSnapshot.assets.map((asset: any, index: number) => (
                    <tr key={`${asset.assetId || asset.assetName || "asset"}-${index}`}>
                      <td>{asset.assetName || "Unnamed asset"}</td>
                      <td>{asset.category || "—"}</td>
                      <td>{asset.owner?.trim() || "—"}</td>
                      <td>{currency.format(numberValue(asset.assetValue))}</td>
                      <td>{asset.valueRecordDate ? String(asset.valueRecordDate).slice(0, 10) : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Liabilities in this snapshot</h3>
            {selectedSnapshot.liabilities.length === 0 ? <p>No liabilities were recorded in this snapshot.</p> : (
              <div className="table-scroll-wrapper" role="region" aria-label="Snapshot liabilities" tabIndex={0}>
                <table className="data-table" style={{ minWidth: 720 }}>
                  <thead><tr><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Liability</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Category</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Owner</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Value</th><th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Value record date</th></tr></thead>
                  <tbody>{selectedSnapshot.liabilities.map((liability: any, index: number) => (
                    <tr key={`${liability.liabilityId || liability.liabilityName || "liability"}-${index}`}>
                      <td>{liability.liabilityName || "Unnamed liability"}</td>
                      <td>{liability.category || "—"}</td>
                      <td>{liability.owner?.trim() || "—"}</td>
                      <td>{currency.format(numberValue(liability.liabilityValue))}</td>
                      <td>{liability.valueRecordDate ? String(liability.valueRecordDate).slice(0, 10) : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 28 }}>
          <h3>No snapshot for {monthLabel(month)}</h3>
          <p>Save a snapshot to preserve the current asset and liability values for this reporting month.</p>
          {snapshots.length > 0 && <p style={{ fontSize: 13, opacity: 0.8 }}>You have {snapshots.length} saved {snapshots.length === 1 ? "month" : "months"}. Choose a saved month below or use the month selector.</p>}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Saved months</h3>
        {snapshots.length === 0 ? <p>No monthly snapshots have been saved yet.</p> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {snapshots.map(snapshot => (
              <button
                type="button"
                key={snapshot.month}
                onClick={() => { setMonth(snapshot.month); setStatus(null); }}
                aria-pressed={snapshot.month === month}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: snapshot.month === month ? "#dbeafe" : "#fff",
                  fontWeight: snapshot.month === month ? 700 : 400
                }}
              >
                {monthLabel(snapshot.month)}
              </button>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, opacity: 0.75 }}>
        Storage note: snapshots are saved in this browser's local storage. Export a JSON backup regularly, especially before clearing browser data or changing devices.
      </p>
    </section>
  );
}
