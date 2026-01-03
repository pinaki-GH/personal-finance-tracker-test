"use client";

import { useEffect, useState } from "react";
import { getData } from "../utils/storage";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

type CategorySummary = Record<string, number>;

export default function NetWorthSummary() {
  const [assetTotal, setAssetTotal] = useState(0);
  const [liabilityTotal, setLiabilityTotal] = useState(0);
  const [assetByCategory, setAssetByCategory] = useState<CategorySummary>({});
  const [liabilityByCategory, setLiabilityByCategory] = useState<CategorySummary>({});

  const calculate = () => {
    const assets = getData("assets");
    const liabilities = getData("liabilities");

    const assetCat: CategorySummary = {};
    const liabilityCat: CategorySummary = {};

    let assetSum = 0;
    let liabilitySum = 0;

    assets.forEach((a: any) => {
      const value = Number(a.assetValue || 0);
      assetSum += value;
      const cat = a.category || "Uncategorized";
      assetCat[cat] = (assetCat[cat] || 0) + value;
    });

    liabilities.forEach((l: any) => {
      const value = Number(l.liabilityValue || 0);
      liabilitySum += value;
      const cat = l.category || "Uncategorized";
      liabilityCat[cat] = (liabilityCat[cat] || 0) + value;
    });

    setAssetTotal(assetSum);
    setLiabilityTotal(liabilitySum);
    setAssetByCategory(assetCat);
    setLiabilityByCategory(liabilityCat);
  };

  useEffect(() => {
    calculate();
    window.addEventListener("finance-updated", calculate);
    return () => window.removeEventListener("finance-updated", calculate);
  }, []);

  const netWorth = assetTotal - liabilityTotal;

  const donutData = (data: CategorySummary) => ({
    labels: Object.keys(data),
    datasets: [
      {
        data: Object.values(data),
        backgroundColor: [
          "#3b82f6",
          "#22c55e",
          "#f97316",
          "#a855f7",
          "#ef4444",
          "#06b6d4",
          "#64748b"
        ]
      }
    ]
  });

  return (
    <section style={{ background: "#f8fafc" }}>
      <h2>📊 Net Worth Summary</h2>

      {/* TOP SUMMARY */}
      <div className="summary-grid">
        <div className="summary-card">
          <h4>Total Assets</h4>
          <p>₹{assetTotal.toLocaleString()}</p>
        </div>

        <div className="summary-card">
          <h4>Total Liabilities</h4>
          <p>₹{liabilityTotal.toLocaleString()}</p>
        </div>

        <div className="summary-card highlight">
          <h4>Net Worth</h4>
          <p style={{ color: netWorth >= 0 ? "green" : "red" }}>
            ₹{netWorth.toLocaleString()}
          </p>
        </div>
      </div>

      {/* CATEGORY TABLES */}
      <div className="two-column">
        <div>
          <h3>Assets by Category</h3>
          <table className="data-table">
            <tbody>
              {Object.entries(assetByCategory).map(([cat, val]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>₹{val.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Liabilities by Category</h3>
          <table className="data-table">
            <tbody>
              {Object.entries(liabilityByCategory).map(([cat, val]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>₹{val.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHARTS */}
      <div className="two-column">
        <div className="chart-card">
          <h3>Asset Allocation</h3>
          <Doughnut data={donutData(assetByCategory)} />
        </div>

        <div className="chart-card">
          <h3>Liability Composition</h3>
          <Doughnut data={donutData(liabilityByCategory)} />
        </div>
      </div>
    </section>
  );
}
