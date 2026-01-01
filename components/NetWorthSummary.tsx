"use client";

import { useEffect, useState } from "react";
import { getData } from "../utils/storage";

export default function NetWorthSummary() {
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);

  const calculate = () => {
    const assets = getData("assets");
    const liabilities = getData("liabilities");

    const assetSum = assets.reduce(
      (sum: number, a: any) => sum + Number(a.value || 0),
      0
    );

    const liabilitySum = liabilities.reduce(
      (sum: number, l: any) => sum + Number(l.amount || 0),
      0
    );

    setTotalAssets(assetSum);
    setTotalLiabilities(liabilitySum);
  };

  useEffect(() => {
    // Initial load
    calculate();

    // Listen for updates
    window.addEventListener("finance-updated", calculate);

    return () => {
      window.removeEventListener("finance-updated", calculate);
    };
  }, []);

  const netWorth = totalAssets - totalLiabilities;

  return (
    <section style={{ background: "#f5f7fa" }}>
      <h2>📊 Net Worth Summary</h2>
      <p><strong>Total Assets:</strong> ₹{totalAssets.toLocaleString()}</p>
      <p><strong>Total Liabilities:</strong> ₹{totalLiabilities.toLocaleString()}</p>
      <hr />
      <p>
        <strong>Net Worth:</strong>{" "}
        <span style={{ color: netWorth >= 0 ? "green" : "red" }}>
          ₹{netWorth.toLocaleString()}
        </span>
      </p>
    </section>
  );
}
