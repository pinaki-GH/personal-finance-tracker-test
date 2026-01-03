"use client";

import { useEffect, useState } from "react";
import { getData } from "../utils/storage";

export default function NetWorthSummary() {
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);

  const calculate = () => {
    const storedAssets = getData("assets");
    const storedLiabilities = getData("liabilities");

    const assetTotal = storedAssets.reduce(
      (sum: number, a: any) => sum + Number(a.assetValue || 0),
      0
    );

    const liabilityTotal = storedLiabilities.reduce(
      (sum: number, l: any) => sum + Number(l.liabilityValue || 0),
      0
    );

    setTotalAssets(assetTotal);
    setTotalLiabilities(liabilityTotal);
  };

  useEffect(() => {
    calculate();
    window.addEventListener("finance-updated", calculate);
    return () => window.removeEventListener("finance-updated", calculate);
  }, []);

  const netWorth = totalAssets - totalLiabilities;

  return (
    <section style={{ background: "#f8fafc" }}>
      <h2>📊 Net Worth Summary</h2>

      <p>
        <strong>Total Assets:</strong>{" "}
        ₹{totalAssets.toLocaleString()}
      </p>

      <p>
        <strong>Total Liabilities:</strong>{" "}
        ₹{totalLiabilities.toLocaleString()}
      </p>

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
