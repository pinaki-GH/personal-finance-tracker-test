import NetWorthSummary from "../components/NetWorthSummary";
import AssetSection from "../components/AssetSection";
import LiabilitySection from "../components/LiabilitySection";
import ExpenseSection from "../components/ExpenseSection";

export default function Home() {
  return (
    <main>
      <NetWorthSummary />
      <AssetSection />
      <LiabilitySection />
      <ExpenseSection />
    </main>
  );
}
