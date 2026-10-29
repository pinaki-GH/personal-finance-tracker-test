"use client";

import { useEffect, useMemo, useState } from "react";
import { getData, saveData } from "../utils/storage";
import { exportToExcel } from "../utils/exportToExcel";

const EXPENSE_CATEGORIES = [
  "Housing", "Groceries", "Utilities", "Insurance", "Transport",
  "Healthcare", "Education", "Entertainment", "Dining Out", "Travel",
  "EMI / Loan Repayment", "Investments", "Miscellaneous",
] as const;

type RecurringType = "None" | "Monthly";
type Expense = {
  description: string;
  amount: string;
  category: string;
  owner: string;
  expenseDate: Date | null;
  recurring: RecurringType;
  recurringKey?: string;
};
type StoredExpense = Omit<Expense, "expenseDate"> & { expenseDate: string | null };
type BudgetStore = Record<string, Record<string, number>>;
type Tab = "overview" | "list" | "budget" | "recurring" | "reports";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const emptyForm = (): Expense => ({
  description: "", amount: "", category: "", owner: "", expenseDate: new Date(), recurring: "None",
});
const monthKey = (date: Date | null) =>
  date && !Number.isNaN(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "";
const dateInput = (date: Date | null) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const parseDate = (value: string): Date | null => {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};
const money = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
const monthLabel = (key: string) => {
  if (!key) return "Choose month";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const makeRecurringKey = () => `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ExpenseSection() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<BudgetStore>({});
  const [monthFilter, setMonthFilter] = useState(today().slice(0, 7));
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [form, setForm] = useState<Expense>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Expense>(emptyForm);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [ownerFilter, setOwnerFilter] = useState("All owners");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = getData<StoredExpense[] | null>("expenses");
    const hydrated: Expense[] = (Array.isArray(stored) ? stored : []).map((e) => ({
      ...e,
      description: String(e.description ?? ""),
      amount: String(e.amount ?? ""),
      category: String(e.category ?? ""),
      owner: String(e.owner ?? ""),
      recurring: e.recurring === "Monthly" ? "Monthly" : "None",
      expenseDate: e.expenseDate && !Number.isNaN(new Date(e.expenseDate).getTime())
        ? new Date(e.expenseDate)
        : null,
    }));
    setExpenses(hydrated);
    const savedBudgets = getData<BudgetStore | null>("expenseBudgets");
    setBudgets(savedBudgets && typeof savedBudgets === "object" ? savedBudgets : {});
    const validMonths = hydrated.map((e) => monthKey(e.expenseDate)).filter(Boolean).sort();
    if (validMonths.length) setMonthFilter(validMonths[validMonths.length - 1]);
  }, []);

  const persistExpenses = (next: Expense[]) => {
    const stored: StoredExpense[] = next.map((e) => ({
      ...e,
      expenseDate: e.expenseDate?.toISOString() ?? null,
    }));
    saveData("expenses", stored);
    setExpenses(next);
  };
  const persistBudgets = (next: BudgetStore) => {
    saveData("expenseBudgets", next);
    setBudgets(next);
  };

  const validate = (item: Expense) => {
    if (!item.description.trim()) return "Enter an expense description.";
    const amount = Number(item.amount);
    if (!item.amount.trim() || !Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero.";
    if (!item.category) return "Choose a category.";
    if (!item.expenseDate || Number.isNaN(item.expenseDate.getTime())) return "Choose a valid expense date.";
    return "";
  };

  const months = useMemo(() => {
    const all = new Set(expenses.map((e) => monthKey(e.expenseDate)).filter(Boolean));
    all.add(today().slice(0, 7));
    return Array.from(all).sort().reverse();
  }, [expenses]);
  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKey(e.expenseDate) === monthFilter),
    [expenses, monthFilter],
  );
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthExpenses.filter((e) =>
      (!q || [e.description, e.category, e.owner].some((v) => v.toLowerCase().includes(q))) &&
      (categoryFilter === "All categories" || e.category === categoryFilter) &&
      (ownerFilter === "All owners" || e.owner === ownerFilter)
    ).slice().sort((a, b) => (b.expenseDate?.getTime() ?? 0) - (a.expenseDate?.getTime() ?? 0));
  }, [monthExpenses, search, categoryFilter, ownerFilter]);
  const total = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    monthExpenses.forEach((e) => { totals[e.category] = (totals[e.category] || 0) + (Number(e.amount) || 0); });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);
  const monthBudgets = budgets[monthFilter] || {};
  const budgetTotal = Object.values(monthBudgets).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const previousMonth = useMemo(() => {
    const [year, month] = monthFilter.split("-").map(Number);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [monthFilter]);
  const previousTotal = expenses.filter((e) => monthKey(e.expenseDate) === previousMonth)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const owners = Array.from(new Set(expenses.map((e) => e.owner.trim()).filter(Boolean))).sort();
  const recurringExpenses = expenses.filter((e) => e.recurring === "Monthly");

  const addExpense = () => {
    const error = validate(form);
    if (error) { setFormError(error); return; }
    const next: Expense = {
      ...form, description: form.description.trim(), amount: String(Number(form.amount)),
      owner: form.owner.trim(), recurringKey: form.recurring === "Monthly" ? makeRecurringKey() : undefined,
    };
    persistExpenses([...expenses, next]);
    setMonthFilter(monthKey(next.expenseDate));
    setForm(emptyForm());
    setFormError("");
    setNotice("Expense saved. Monthly totals now include this transaction.");
    setActiveTab("list");
  };
  const startEdit = (expense: Expense) => {
    const index = expenses.indexOf(expense);
    setEditingId(index);
    setEditForm({ ...expense });
    setEditError("");
  };
  const saveEdit = () => {
    if (editingId === null) return;
    const error = validate(editForm);
    if (error) { setEditError(error); return; }
    const next = [...expenses];
    next[editingId] = {
      ...editForm, description: editForm.description.trim(), amount: String(Number(editForm.amount)),
      owner: editForm.owner.trim(),
      recurringKey: editForm.recurring === "Monthly" ? (editForm.recurringKey || makeRecurringKey()) : undefined,
    };
    persistExpenses(next);
    setMonthFilter(monthKey(next[editingId].expenseDate));
    setEditingId(null);
    setEditError("");
    setNotice("Expense updated.");
  };
  const deleteExpense = (expense: Expense) => {
    if (!window.confirm(`Delete "${expense.description}"? This cannot be undone.`)) return;
    const index = expenses.indexOf(expense);
    if (index < 0) return;
    persistExpenses(expenses.filter((_, i) => i !== index));
    if (editingId === index) setEditingId(null);
    setNotice("Expense deleted.");
  };
  const updateBudget = (category: string, value: string) => {
    const amount = value === "" ? 0 : Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    persistBudgets({ ...budgets, [monthFilter]: { ...monthBudgets, [category]: amount } });
  };
  const copyPreviousBudget = () => {
    const previous = budgets[previousMonth];
    if (!previous) { setNotice(`No budget is saved for ${monthLabel(previousMonth)}.`); return; }
    if (!window.confirm(`Copy ${monthLabel(previousMonth)}'s budget into ${monthLabel(monthFilter)}? This replaces the current month's category budgets.`)) return;
    persistBudgets({ ...budgets, [monthFilter]: { ...previous } });
    setNotice("Previous month's budget copied. The two months are now independent.");
  };
  const exportMonth = () => {
    if (!monthExpenses.length) { setNotice("There are no transactions to export for this month."); return; }
    exportToExcel(monthExpenses.map((e) => ({
      Date: dateInput(e.expenseDate), Description: e.description, Category: e.category,
      Owner: e.owner, Recurring: e.recurring, Amount: Number(e.amount),
    })), `expenses-${monthFilter}`);
  };

  const tabs: { id: Tab; label: string; sub: string }[] = [
    { id: "overview", label: "Overview", sub: "Monthly snapshot" },
    { id: "list", label: "Expense list", sub: "Transactions" },
    { id: "budget", label: "Budget vs actual", sub: "Plan your month" },
    { id: "recurring", label: "Recurring", sub: "Monthly schedules" },
    { id: "reports", label: "Reports", sub: "Category insights" },
  ];
  const fieldStyle: React.CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 12px",
    border: "1px solid #d9e2ec", borderRadius: 10, background: "#fff", color: "#172b4d", fontSize: 14,
  };
  const labelStyle: React.CSSProperties = { display: "grid", gap: 6, color: "#52637a", fontSize: 12, fontWeight: 700 };
  const buttonStyle: React.CSSProperties = {
    border: "1px solid #d9e2ec", borderRadius: 10, padding: "10px 14px", background: "#fff",
    color: "#24364b", fontWeight: 700, cursor: "pointer",
  };
  const primaryStyle: React.CSSProperties = { ...buttonStyle, background: "#174b3b", color: "#fff", borderColor: "#174b3b" };
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20,
    boxShadow: "0 4px 18px rgba(20, 39, 60, 0.04)", minWidth: 0,
  };
  const formFields = (value: Expense, setter: (next: Expense) => void, edit = false) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
      <label style={labelStyle}>DESCRIPTION
        <input style={fieldStyle} placeholder="e.g. Monthly groceries" value={value.description}
          onChange={(e) => setter({ ...value, description: e.target.value })} />
      </label>
      <label style={labelStyle}>AMOUNT (₹)
        <input style={fieldStyle} type="number" min="0.01" step="0.01" placeholder="0.00" value={value.amount}
          onChange={(e) => setter({ ...value, amount: e.target.value })} />
      </label>
      <label style={labelStyle}>CATEGORY
        <select style={fieldStyle} value={value.category} onChange={(e) => setter({ ...value, category: e.target.value })}>
          <option value="">Choose category</option>
          {EXPENSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </label>
      <label style={labelStyle}>PAID BY / OWNER
        <input style={fieldStyle} placeholder="Optional" value={value.owner}
          onChange={(e) => setter({ ...value, owner: e.target.value })} />
      </label>
      <label style={labelStyle}>DATE
        <input style={fieldStyle} type="date" value={dateInput(value.expenseDate)}
          onChange={(e) => setter({ ...value, expenseDate: parseDate(e.target.value) })} />
      </label>
      <label style={labelStyle}>REPEAT
        <select style={fieldStyle} value={value.recurring} onChange={(e) => setter({ ...value, recurring: e.target.value as RecurringType })}>
          <option value="None">One-time expense</option>
          <option value="Monthly">Monthly schedule</option>
        </select>
      </label>
    </div>
  );

  return (
    <section style={{ color: "#172b4d", fontFamily: "inherit", display: "grid", gap: 18 }}>
      <style>{`
        .expense-table { width:100%; border-collapse:collapse; min-width:720px; }
        .expense-table th { text-align:left; font-size:11px; letter-spacing:.06em; color:#718096; padding:12px 10px; background:#f7f9fc; }
        .expense-table td { padding:13px 10px; border-top:1px solid #edf1f5; font-size:13px; vertical-align:middle; }
        .expense-scroll { width:100%; overflow-x:auto; }
        .expense-tab:hover { border-color:#b9c9d7 !important; }
        @media (max-width: 600px) { .expense-card { padding:14px !important; } }
      `}</style>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#5d8b78", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>PERSONAL FINANCE</div>
          <h2 style={{ margin: "5px 0", fontSize: 28, lineHeight: 1.2, letterSpacing: "-.04em" }}>Expense tracker</h2>
          <p style={{ margin: 0, color: "#718096", fontSize: 14 }}>A clear view of where your money goes.</p>
        </div>
        <label style={{ ...labelStyle, minWidth: 190 }}>REPORTING MONTH
          <select style={fieldStyle} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      </header>

      {notice && <div role="status" style={{ padding: "11px 14px", borderRadius: 10, background: "#edf7f1", color: "#205b43", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit" }}>×</button>
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 }}>
        {[
          { label: "SPENT THIS MONTH", value: money(total), note: `${monthExpenses.length} saved transaction${monthExpenses.length === 1 ? "" : "s"}` },
          { label: "MONTHLY BUDGET", value: money(budgetTotal), note: budgetTotal ? `${money(budgetTotal - total)} ${budgetTotal >= total ? "remaining" : "over budget"}` : "Set category budgets" },
          { label: "VS PREVIOUS MONTH", value: previousTotal ? `${total >= previousTotal ? "+" : "−"}${Math.abs(((total - previousTotal) / previousTotal) * 100).toFixed(1)}%` : "—", note: previousTotal ? `${money(previousTotal)} previous spend` : "No previous-month spend" },
          { label: "RECURRING SCHEDULES", value: String(recurringExpenses.length), note: "Not auto-counted as new spend" },
        ].map((item) => (
          <div key={item.label} style={{ ...cardStyle, padding: 17 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#718096" }}>{item.label}</div>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.04em", margin: "9px 0 5px", overflowWrap: "anywhere" }}>{item.value}</div>
            <div style={{ fontSize: 12, color: "#718096" }}>{item.note}</div>
          </div>
        ))}
      </div>

      <nav aria-label="Expense tracker sections" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 6, background: "#f2f5f7", borderRadius: 14 }}>
        {tabs.map((tab) => <button key={tab.id} className="expense-tab" onClick={() => setActiveTab(tab.id)}
          style={{ flex: "1 1 125px", textAlign: "left", padding: "10px 12px", borderRadius: 10, border: activeTab === tab.id ? "1px solid #d4e5dc" : "1px solid transparent", background: activeTab === tab.id ? "#fff" : "transparent", cursor: "pointer", color: "#24364b" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{tab.label}</span>
          <span style={{ display: "block", fontSize: 11, color: "#7a8999", marginTop: 3 }}>{tab.sub}</span>
        </button>)}
      </nav>

      {activeTab === "overview" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
        <div className="expense-card" style={cardStyle}>
          <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>Spending by category</h3>
          <p style={{ color: "#718096", fontSize: 13, margin: "0 0 16px" }}>{monthLabel(monthFilter)} · confirmed transactions only</p>
          {categoryTotals.length ? categoryTotals.slice(0, 6).map(([cat, amount]) => (
            <div key={cat} style={{ marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 6 }}><span>{cat}</span><strong>{money(amount)}</strong></div>
              <div style={{ height: 7, borderRadius: 20, background: "#edf1f5", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 20, background: "#4e8a70", width: `${total ? Math.min(100, amount / total * 100) : 0}%` }} /></div>
            </div>
          )) : <p style={{ color: "#718096", fontSize: 13 }}>No expenses saved for this month yet.</p>}
          <button style={{ ...buttonStyle, marginTop: 5 }} onClick={() => setActiveTab("reports")}>View report →</button>
        </div>
        <div className="expense-card" style={{ ...cardStyle, background: "#f7faf8" }}>
          <h3 style={{ margin: "0 0 5px", fontSize: 17 }}>Quick add</h3>
          <p style={{ color: "#718096", fontSize: 13, margin: "0 0 16px" }}>Add a saved transaction. Only saved transactions count as actual spending.</p>
          {formFields(form, setForm)}
          {formError && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{formError}</p>}
          <button style={{ ...primaryStyle, marginTop: 14 }} onClick={addExpense}>＋ Save expense</button>
        </div>
        <div className="expense-card" style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div><h3 style={{ margin: 0, fontSize: 17 }}>Recent expenses</h3><p style={{ color: "#718096", fontSize: 13, margin: "5px 0 0" }}>Latest saved transactions for {monthLabel(monthFilter)}.</p></div>
            <button style={buttonStyle} onClick={() => setActiveTab("list")}>All transactions →</button>
          </div>
          {monthExpenses.length ? <div className="expense-scroll" style={{ marginTop: 14 }}><table className="expense-table"><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th style={{ textAlign: "right" }}>AMOUNT</th></tr></thead><tbody>
            {monthExpenses.slice().sort((a,b)=>(b.expenseDate?.getTime()??0)-(a.expenseDate?.getTime()??0)).slice(0,5).map((e, i) => <tr key={`${e.description}-${dateInput(e.expenseDate)}-${i}`}><td style={{ fontWeight: 700 }}>{e.description}</td><td>{e.category}</td><td>{dateInput(e.expenseDate)}</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(Number(e.amount)||0)}</td></tr>)}
          </tbody></table></div> : <p style={{ color: "#718096", fontSize: 13, marginTop: 18 }}>Nothing recorded yet. Add your first expense above.</p>}
        </div>
      </div>}

      {activeTab === "list" && <div className="expense-card" style={cardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div><h3 style={{ margin: 0, fontSize: 18 }}>Expense list</h3><p style={{ color: "#718096", margin: "5px 0 0", fontSize: 13 }}>{filteredExpenses.length} transaction{filteredExpenses.length === 1 ? "" : "s"} · {money(filteredExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0))} shown</p></div>
          <button style={buttonStyle} onClick={exportMonth}>Export month to Excel ↓</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
          <input style={fieldStyle} placeholder="Search description, category, owner…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search expenses" />
          <select style={fieldStyle} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category"><option>All categories</option>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
          <select style={fieldStyle} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Filter by owner"><option>All owners</option>{owners.map(o=><option key={o}>{o}</option>)}</select>
        </div>
        {editingId !== null ? <div style={{ padding: 16, borderRadius: 12, background: "#f7faf8", marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 14px" }}>Edit transaction</h4>{formFields(editForm, setEditForm)}
          {editError && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{editError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button style={primaryStyle} onClick={saveEdit}>Save changes</button><button style={buttonStyle} onClick={() => { setEditingId(null); setEditError(""); }}>Cancel</button></div>
        </div> : null}
        <div className="expense-scroll"><table className="expense-table"><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>OWNER</th><th>DATE</th><th>TYPE</th><th style={{ textAlign: "right" }}>AMOUNT</th><th>ACTIONS</th></tr></thead><tbody>
          {filteredExpenses.map((e) => <tr key={expenses.indexOf(e)}>
            <td style={{ fontWeight: 700, color: "#24364b" }}>{e.description}</td><td>{e.category}</td><td>{e.owner || "—"}</td><td>{dateInput(e.expenseDate) || "—"}</td>
            <td><span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 20, background: e.recurring === "Monthly" ? "#eaf3ed" : "#f0f3f7", color: e.recurring === "Monthly" ? "#286348" : "#5d6b7c", fontSize: 11, fontWeight: 700 }}>{e.recurring === "Monthly" ? "Schedule" : "One-time"}</span></td>
            <td style={{ textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{money(Number(e.amount)||0)}</td>
            <td style={{ whiteSpace: "nowrap" }}><button style={{ ...buttonStyle, padding: "6px 9px", fontSize: 12 }} onClick={() => startEdit(e)}>Edit</button>{" "}<button style={{ ...buttonStyle, padding: "6px 9px", fontSize: 12, color: "#a12a2a" }} onClick={() => deleteExpense(e)}>Delete</button></td>
          </tr>)}
        </tbody></table></div>
        {!filteredExpenses.length && <div style={{ textAlign: "center", padding: 35, color: "#718096" }}><div style={{ fontSize: 26, marginBottom: 8 }}>⌕</div><strong style={{ color: "#24364b" }}>No matching expenses</strong><p style={{ fontSize: 13 }}>Try another search or add an expense from Overview.</p></div>}
      </div>}

      {activeTab === "budget" && <div className="expense-card" style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><h3 style={{ margin: 0, fontSize: 18 }}>Budget vs actual</h3><p style={{ color: "#718096", fontSize: 13, margin: "5px 0 0" }}>{monthLabel(monthFilter)} · budgets are independent by month</p></div><button style={buttonStyle} onClick={copyPreviousBudget}>Copy previous month's budget</button></div>
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          {EXPENSE_CATEGORIES.map((cat) => {
            const actual = categoryTotals.find(([c])=>c===cat)?.[1] || 0;
            const budget = Number(monthBudgets[cat]) || 0;
            const variance = budget - actual;
            const pct = budget > 0 ? Math.min(100, actual / budget * 100) : actual > 0 ? 100 : 0;
            return <div key={cat} style={{ padding: 13, border: "1px solid #edf1f5", borderRadius: 12, display: "grid", gridTemplateColumns: "minmax(130px, 1fr) minmax(100px, 160px) minmax(120px, 1fr)", gap: 12, alignItems: "center" }}>
              <div><strong style={{ fontSize: 13 }}>{cat}</strong><div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>Actual: {money(actual)}</div></div>
              <label style={labelStyle}>MONTHLY BUDGET (₹)<input style={fieldStyle} type="number" min="0" step="1" value={budget || ""} placeholder="0" onChange={(e)=>updateBudget(cat,e.target.value)} /></label>
              <div><div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#718096", marginBottom: 6 }}><span>{budget ? `${Math.round(actual / budget * 100)}% used` : actual ? "No budget set" : "No spend"}</span><strong style={{ color: budget && actual > budget ? "#b42318" : "#286348" }}>{budget ? `${money(Math.abs(variance))} ${variance >= 0 ? "left" : "over"}` : "—"}</strong></div><div style={{ height: 7, borderRadius: 10, background: "#edf1f5", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: budget && actual > budget ? "#c45d55" : "#4e8a70" }} /></div></div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: 15, background: "#f7faf8", borderRadius: 12, marginTop: 16 }}><span style={{ fontWeight: 700 }}>Total budget: {money(budgetTotal)}</span><span style={{ fontWeight: 700 }}>Actual: {money(total)}</span><span style={{ fontWeight: 800, color: total > budgetTotal && budgetTotal > 0 ? "#b42318" : "#286348" }}>{budgetTotal ? `${money(Math.abs(budgetTotal-total))} ${total <= budgetTotal ? "remaining" : "over budget"}` : "Set a budget to track variance"}</span></div>
      </div>}

      {activeTab === "recurring" && <div className="expense-card" style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Recurring schedules</h3><p style={{ color: "#718096", fontSize: 13, margin: "5px 0 16px" }}>These entries are not automatically copied into future months. Add a new transaction only after confirming that payment happened.</p>
        {recurringExpenses.length ? <div style={{ display: "grid", gap: 10 }}>{recurringExpenses.map((e,i)=><div key={`${e.recurringKey||e.description}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", border: "1px solid #edf1f5", padding: 14, borderRadius: 12 }}><div><strong>{e.description}</strong><div style={{ color: "#718096", fontSize: 12, marginTop: 5 }}>{e.category} · {e.owner || "No owner specified"}</div></div><div style={{ fontWeight: 800 }}>{money(Number(e.amount)||0)} <span style={{ fontSize: 11, fontWeight: 600, color: "#718096" }}>/ month</span></div></div>)}</div> : <p style={{ color: "#718096", fontSize: 13 }}>No monthly schedules yet. Choose “Monthly schedule” when adding an expense to mark it as recurring.</p>}
        <div style={{ marginTop: 16, background: "#fff8e8", color: "#7c5b20", padding: 12, borderRadius: 10, fontSize: 12 }}>Legacy note: existing monthly recurring records remain saved, but this redesign no longer auto-generates future dated expense rows.</div>
      </div>}

      {activeTab === "reports" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
        <div className="expense-card" style={cardStyle}><h3 style={{ margin: "0 0 5px", fontSize: 18 }}>Category breakdown</h3><p style={{ margin: "0 0 16px", color: "#718096", fontSize: 13 }}>{monthLabel(monthFilter)}</p>
          {categoryTotals.length ? categoryTotals.map(([cat, amount])=><div key={cat} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #edf1f5", padding: "10px 0", fontSize: 13 }}><span>{cat}<span style={{ color: "#718096", marginLeft: 7 }}>{total ? `${(amount/total*100).toFixed(1)}%` : ""}</span></span><strong>{money(amount)}</strong></div>) : <p style={{ color: "#718096", fontSize: 13 }}>No spending data for this month.</p>}
        </div>
        <div className="expense-card" style={cardStyle}><h3 style={{ margin: "0 0 5px", fontSize: 18 }}>Month summary</h3><p style={{ margin: "0 0 16px", color: "#718096", fontSize: 13 }}>Saved transaction totals</p>
          {[["Current month",total],["Previous month",previousTotal],["Budgeted",budgetTotal],["Difference vs previous",total-previousTotal]].map(([label, amount])=><div key={String(label)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid #edf1f5", fontSize: 13 }}><span style={{ color: "#718096" }}>{label}</span><strong>{money(Number(amount))}</strong></div>)}
          <button style={{ ...primaryStyle, marginTop: 16 }} onClick={exportMonth}>Export transactions to Excel</button>
        </div>
      </div>}
      <footer style={{ color: "#8a97a6", fontSize: 11, lineHeight: 1.5 }}>Expense data stays in your existing browser storage keys. Scheduled recurring expenses are not treated as actual spend unless saved as a transaction.</footer>
    </section>
  );
}
