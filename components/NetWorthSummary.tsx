"use client";

import { useEffect, useState } from "react";
import { getData } from "../utils/storage";

export default function NetWorthSummary() {
  const [assets, setAssets] = useState(0);
  const [liabilities, setLiabilities] = useState(0);

  const calculate = () => {
    const storedAssets = getData("assets");
    const storedLiabilities = getData("liabilities");

    const assetTotal = storedAssets.reduce(
      (sum: number, a: any) => sum + Number(a.assetValue || 0),
      0
    );

    const liabilityTotal = storedLiabilities.reduce(
      (sum: number, l: any) => sum + Number(l.amount || 0),
      0
    );

    setAssets(assetTotal);
    setLiabilities(liabilityTotal);
  };

  useEffect(() => {
    calculate();
    window.addEventListener("finance-updated", calculate);
    return () => window.removeEventListener("finance-updated", calculate);
  }, []);

  const netWorth = assets - liabilities;

  return (
    <section style={{ background: "#f8fafc" }}>
      <h2>📊 Net Worth Summary</h2>

      <p><strong>Total Assets:</strong> ₹{assets.toLocaleString()}</p>
      <p><strong>Total Liabilities:</strong> ₹{liabilities.toLocaleString()}</p>

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
