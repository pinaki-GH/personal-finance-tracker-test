"use client";

import { useState } from "react";

import Tabs from "../components/Tabs";
import NetWorthSummary from "../components/NetWorthSummary";
import AssetSection from "../components/AssetSection";
import LiabilitySection from "../components/LiabilitySection";
import ExpenseSection from "../components/ExpenseSection";

export default function Home() {
  const [activeTab, setActiveTab] = useState("networth");

  const tabs = [
    { id: "networth", label: "Net Worth" },
    { id: "assets", label: "Assets" },
    { id: "liabilities", label: "Liabilities" },
    { id: "expenses", label: "Expenses" }
  ];

  return (
    <main>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "networth" && <NetWorthSummary />}
      {activeTab === "assets" && <AssetSection />}
      {activeTab === "liabilities" && <LiabilitySection />}
      {activeTab === "expenses" && <ExpenseSection />}
    </main>
  );
}
