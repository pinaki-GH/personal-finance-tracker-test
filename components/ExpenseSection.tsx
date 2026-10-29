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
type Frequency = "Weekly" | "Monthly" | "Quarterly" | "Yearly";
type RecurringSchedule = { id: string; description: string; amount: string; category: string; owner: string; frequency: Frequency; startDate: string; endDate: string; paused: boolean; paidOccurrences: string[]; legacyRecurringKey?: string };
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
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState<RecurringSchedule>({ id: "", description: "", amount: "", category: "", owner: "", frequency: "Monthly", startDate: today(), endDate: "", paused: false, paidOccurrences: [] });
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
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
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);

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
    const savedSchedules = getData<RecurringSchedule[] | null>("expenseRecurringSchedules");
    if (Array.isArray(savedSchedules)) {
      setSchedules(savedSchedules);
    } else {
      // One-time compatibility migration: preserve legacy monthly rows as transactions
      // and create independent schedules from them without generating future spend.
      const legacy = hydrated.filter((e) => e.recurring === "Monthly").map((e, i): RecurringSchedule => ({
        id: e.recurringKey || `legacy-${i}-${makeRecurringKey()}`, description: e.description, amount: e.amount,
        category: e.category, owner: e.owner, frequency: "Monthly", startDate: dateInput(e.expenseDate) || today(),
        endDate: "", paused: false, paidOccurrences: dateInput(e.expenseDate) ? [dateInput(e.expenseDate)] : [], legacyRecurringKey: e.recurringKey,
      }));
      setSchedules(legacy);
      saveData("expenseRecurringSchedules", legacy);
    }
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
  const persistSchedules = (next: RecurringSchedule[]) => { saveData("expenseRecurringSchedules", next); setSchedules(next); };
  const deleteSchedule = (scheduleId: string) => {
    // Derive the next list from the current render, persist it, and update React state.
    // Keep the editor in sync if the schedule being removed was open for editing.
    const next = schedules.filter((schedule) => schedule.id !== scheduleId);
    if (next.length === schedules.length) return;
    saveData("expenseRecurringSchedules", next);
    setSchedules(next);
    if (editingScheduleId === scheduleId) {
      setEditingScheduleId(null);
      setScheduleDraft({ id: "", description: "", amount: "", category: "", owner: "", frequency: "Monthly", startDate: today(), endDate: "", paused: false, paidOccurrences: [] });
    }
    setNotice("Recurring schedule deleted. Existing transactions were kept.");
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
  const budgetCategories = Array.from(new Set([
    ...EXPENSE_CATEGORIES,
    ...Object.keys(monthBudgets),
    ...categoryTotals.map(([category]) => category),
  ])).sort((a, b) => {
    const ai = EXPENSE_CATEGORIES.indexOf(a as (typeof EXPENSE_CATEGORIES)[number]);
    const bi = EXPENSE_CATEGORIES.indexOf(b as (typeof EXPENSE_CATEGORIES)[number]);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  useEffect(() => {
    const saved = budgets[monthFilter] || {};
    const drafts: Record<string, string> = {};
    Object.entries(saved).forEach(([category, amount]) => {
      drafts[category] = String(amount);
    });
    setBudgetDrafts(drafts);
  }, [budgets, monthFilter]);
  const previousMonth = useMemo(() => {
    const [year, month] = monthFilter.split("-").map(Number);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [monthFilter]);
  const previousTotal = expenses.filter((e) => monthKey(e.expenseDate) === previousMonth)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const owners = Array.from(new Set(expenses.map((e) => e.owner.trim()).filter(Boolean))).sort();
  const recurringExpenses = schedules;
  // Count only schedules whose active date range overlaps the selected reporting month.
  const applicableRecurringSchedules = schedules.filter((schedule) => {
    const start = parseDate(schedule.startDate);
    if (!start) return false;
    const [year, month] = monthFilter.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const end = schedule.endDate ? parseDate(schedule.endDate) : null;
    return start <= monthEnd && (!end || end >= monthStart);
  });
  const addDays = (date: Date, count: number) => { const d = new Date(date); d.setDate(d.getDate() + count); return d; };
  const occurrenceDates = (schedule: RecurringSchedule, month: string) => {
    const [yy, mm] = month.split("-").map(Number);
    const monthStart = new Date(yy, mm - 1, 1); const monthEnd = new Date(yy, mm, 0);
    const start = parseDate(schedule.startDate); if (!start) return [] as string[];
    const endLimit = schedule.endDate ? parseDate(schedule.endDate) : null;
    const results: string[] = []; let cursor = new Date(start); let guard = 0;
    while (cursor < monthStart && guard++ < 5000) {
      if (schedule.frequency === "Weekly") cursor = addDays(cursor, 7);
      else if (schedule.frequency === "Monthly") cursor.setMonth(cursor.getMonth() + 1);
      else if (schedule.frequency === "Quarterly") cursor.setMonth(cursor.getMonth() + 3);
      else cursor.setFullYear(cursor.getFullYear() + 1);
    }
    while (cursor <= monthEnd && (!endLimit || cursor <= endLimit) && guard++ < 5000) {
      if (cursor >= monthStart) results.push(dateInput(cursor));
      if (schedule.frequency === "Weekly") cursor = addDays(cursor, 7);
      else if (schedule.frequency === "Monthly") cursor.setMonth(cursor.getMonth() + 1);
      else if (schedule.frequency === "Quarterly") cursor.setMonth(cursor.getMonth() + 3);
      else cursor.setFullYear(cursor.getFullYear() + 1);
    }
    return results;
  };
  const saveSchedule = () => {
    if (!scheduleDraft.description.trim() || !scheduleDraft.category || !(Number(scheduleDraft.amount) > 0) || !parseDate(scheduleDraft.startDate)) { setNotice("Enter a description, a valid amount, category, and start date for the schedule."); return; }
    const item = { ...scheduleDraft, id: editingScheduleId || makeRecurringKey(), description: scheduleDraft.description.trim(), amount: String(Number(scheduleDraft.amount)), owner: scheduleDraft.owner.trim() };
    persistSchedules(editingScheduleId ? schedules.map((s) => s.id === editingScheduleId ? item : s) : [...schedules, item]);
    setScheduleDraft({ id: "", description: "", amount: "", category: "", owner: "", frequency: "Monthly", startDate: today(), endDate: "", paused: false, paidOccurrences: [] });
    setEditingScheduleId(null); setNotice(editingScheduleId ? "Recurring schedule updated." : "Recurring schedule saved.");
  };
  const confirmOccurrence = (schedule: RecurringSchedule, dueDate: string) => {
    if (!window.confirm(`Confirm that ${schedule.description} (${money(Number(schedule.amount) || 0)}) was paid on ${dueDate}? This adds one actual transaction.`)) return;
    const alreadyExists = expenses.some((e) => (e as Expense & { recurringOccurrence?: string }).recurringOccurrence === `${schedule.id}:${dueDate}`);
    const paid = schedule.paidOccurrences.includes(dueDate) || alreadyExists;
    if (paid) { setNotice("This scheduled payment is already recorded."); return; }
    const transaction = { description: schedule.description, amount: schedule.amount, category: schedule.category, owner: schedule.owner, expenseDate: parseDate(dueDate), recurring: "None" as RecurringType, recurringKey: undefined, recurringOccurrence: `${schedule.id}:${dueDate}` } as Expense;
    persistExpenses([...expenses, transaction]);
    persistSchedules(schedules.map((s) => s.id === schedule.id ? { ...s, paidOccurrences: [...s.paidOccurrences, dueDate] } : s));
    setNotice("Payment confirmed and added to actual spending.");
  };
  const monthlyTrend = useMemo(() => {
    const [year, month] = monthFilter.split("-").map(Number);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(year, month - 6 + index + 1, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const spend = expenses
        .filter((expense) => monthKey(expense.expenseDate) === key)
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      return { key, label: date.toLocaleDateString("en-IN", { month: "short" }), spend };
    });
  }, [expenses, monthFilter]);
  const previousMonthBudgetTotal = Object.values(budgets[previousMonth] || {})
    .reduce((sum, value) => sum + (Number(value) || 0), 0);
  const spendingChange = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;
  const budgetedCategoryCount = Object.keys(monthBudgets).length;
  const overBudgetCategories = categoryTotals.filter(([category, actual]) =>
    Object.prototype.hasOwnProperty.call(monthBudgets, category) && actual > Number(monthBudgets[category])
  );
  const approachingBudgetCategories = categoryTotals.filter(([category, actual]) => {
    if (!Object.prototype.hasOwnProperty.call(monthBudgets, category)) return false;
    const budget = Number(monthBudgets[category]);
    return budget > 0 && actual / budget >= 0.8 && actual <= budget;
  });
  const budgetRemaining = budgetTotal - total;
  const trendMax = Math.max(1, ...monthlyTrend.map((item) => item.spend));


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
  const updateBudgetDraft = (category: string, value: string) => {
    if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) return;
    setBudgetDrafts((current) => ({ ...current, [category]: value }));
  };
  const saveBudgetDrafts = () => {
    const nextMonth: Record<string, number> = { ...monthBudgets };
    for (const category of budgetCategories) {
      const raw = (budgetDrafts[category] ?? "").trim();
      if (raw === "") {
        delete nextMonth[category];
        continue;
      }
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        setNotice(`Enter a valid non-negative budget for ${category}.`);
        return;
      }
      nextMonth[category] = amount;
    }
    const nextBudgets = { ...budgets };
    if (Object.keys(nextMonth).length) nextBudgets[monthFilter] = nextMonth;
    else delete nextBudgets[monthFilter];
    persistBudgets(nextBudgets);
    setNotice("Budgets saved. Blank fields are unset; ₹0 is a valid explicit budget.");
  };
  const copyPreviousBudget = () => {
    const previous = budgets[previousMonth];
    if (!previous || Object.keys(previous).length === 0) {
      setNotice(`No budget is saved for ${monthLabel(previousMonth)}.`);
      return;
    }
    setShowCopyConfirmation(true);
  };
  const confirmCopyPreviousBudget = () => {
    const previous = budgets[previousMonth];
    if (!previous || Object.keys(previous).length === 0) {
      setShowCopyConfirmation(false);
      setNotice(`No budget is saved for ${monthLabel(previousMonth)}.`);
      return;
    }
    const nextBudgets = { ...budgets, [monthFilter]: { ...previous } };
    persistBudgets(nextBudgets);
    setBudgetDrafts(Object.fromEntries(Object.entries(previous).map(([category, amount]) => [category, String(amount)])));
    setShowCopyConfirmation(false);
    setNotice(`Copied ${monthLabel(previousMonth)}'s budget to ${monthLabel(monthFilter)}. The months remain independent.`);
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
    { id: "budget", label: "Budget vs Actual", sub: "Plan your month" },
    { id: "recurring", label: "Recurring", sub: "Upcoming payments" },
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
          <h2 style={{ margin: "5px 0", fontSize: 28, lineHeight: 1.2, letterSpacing: "-.04em" }}>Expense Tracker</h2>
          <p style={{ margin: 0, color: "#718096", fontSize: 14 }}>A clear view of where your money goes.</p>
        </div>
        <label style={{ ...labelStyle, minWidth: 190 }}>REPORTING MONTH
          <input style={fieldStyle} type="month" value={monthFilter}
            onChange={(e) => { if (e.target.value) { setMonthFilter(e.target.value); setNotice(""); } }}
            aria-label="Choose reporting month and year" />
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
          { label: "RECURRING SCHEDULES", value: String(applicableRecurringSchedules.length), note: "Active this reporting month" },
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

      {activeTab === "overview" && <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
          {[
            { label: "TOTAL SPENT", value: money(total), note: `${monthExpenses.length} saved transaction${monthExpenses.length === 1 ? "" : "s"}`, tone: "#174b3b" },
            { label: "BUDGET SET", value: money(budgetTotal), note: `${budgetedCategoryCount} categor${budgetedCategoryCount === 1 ? "y" : "ies"} budgeted`, tone: "#24364b" },
            { label: "BUDGET REMAINING", value: budgetTotal ? money(Math.abs(budgetRemaining)) : "—", note: budgetTotal ? (budgetRemaining >= 0 ? "Available against budget" : "Above total budget") : "Set budgets to track", tone: budgetTotal && budgetRemaining < 0 ? "#b42318" : "#286348" },
            { label: "VS PREVIOUS MONTH", value: spendingChange === null ? "—" : `${spendingChange > 0 ? "+" : ""}${spendingChange.toFixed(1)}%`, note: previousTotal ? `${money(previousTotal)} spent in ${monthLabel(previousMonth)}` : "No previous-month spending", tone: spendingChange !== null && spendingChange > 0 ? "#b42318" : "#286348" },
          ].map((item) => (
            <div key={item.label} style={{ ...cardStyle, padding: 17 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#718096" }}>{item.label}</div>
              <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.04em", margin: "9px 0 5px", overflowWrap: "anywhere", color: item.tone }}>{item.value}</div>
              <div style={{ fontSize: 12, color: "#718096" }}>{item.note}</div>
            </div>
          ))}
        </div>

        {(overBudgetCategories.length > 0 || approachingBudgetCategories.length > 0) && (
          <div className="expense-card" style={{ ...cardStyle, borderColor: overBudgetCategories.length ? "#f0c6c3" : "#f2dfb5", background: overBudgetCategories.length ? "#fff8f7" : "#fffcf4" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{overBudgetCategories.length ? "Budget attention needed" : "Budget watch"}</h3>
            {overBudgetCategories.length > 0 && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#a12a2a" }}>
              Over budget: {overBudgetCategories.map(([category, actual]) => `${category} (${money(actual - Number(monthBudgets[category]))} over)`).join(" · ")}.
            </p>}
            {approachingBudgetCategories.length > 0 && <p style={{ margin: 0, fontSize: 13, color: "#7c5b20" }}>
              At least 80% used: {approachingBudgetCategories.map(([category, actual]) => `${category} (${Math.round(actual / Number(monthBudgets[category]) * 100)}%)`).join(" · ")}.
            </p>}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
          <div className="expense-card" style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>Spending by category</h3>
                <p style={{ color: "#718096", fontSize: 13, margin: 0 }}>{monthLabel(monthFilter)} · saved transactions only</p>
              </div>
              <button style={buttonStyle} onClick={() => setActiveTab("reports")}>Full report →</button>
            </div>
            {categoryTotals.length ? categoryTotals.slice(0, 6).map(([category, amount]) => {
              const budget = monthBudgets[category];
              const hasBudget = Object.prototype.hasOwnProperty.call(monthBudgets, category);
              const percent = total ? amount / total * 100 : 0;
              const budgetPercent = hasBudget && Number(budget) > 0 ? amount / Number(budget) * 100 : null;
              const over = hasBudget && amount > Number(budget);
              return <div key={category} style={{ marginBottom: 15 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 6 }}>
                  <span>{category}</span><strong>{money(amount)}</strong>
                </div>
                <div style={{ height: 7, borderRadius: 20, background: "#edf1f5", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 20, background: over ? "#c45d55" : "#4e8a70", width: `${Math.min(100, percent)}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#718096", marginTop: 4 }}>
                  <span>{percent.toFixed(1)}% of spending</span>
                  <span style={{ color: over ? "#b42318" : "#718096" }}>{budgetPercent === null ? "No category budget" : `${Math.round(budgetPercent)}% of budget used`}</span>
                </div>
              </div>;
            }) : <p style={{ color: "#718096", fontSize: 13 }}>No expenses saved for this month yet.</p>}
            <button style={{ ...buttonStyle, marginTop: 3 }} onClick={() => setActiveTab("budget")}>Review budgets →</button>
          </div>

          <div className="expense-card" style={cardStyle}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>Six-month spending trend</h3>
            <p style={{ color: "#718096", fontSize: 13, margin: "0 0 20px" }}>Monthly totals through {monthLabel(monthFilter)}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, alignItems: "end", minHeight: 170 }}>
              {monthlyTrend.map((item) => {
                const height = item.spend > 0 ? Math.max(8, item.spend / trendMax * 120) : 3;
                const isSelected = item.key === monthFilter;
                return <div key={item.key} title={`${monthLabel(item.key)}: ${money(item.spend)}`} style={{ display: "grid", gridTemplateRows: "20px 120px auto", alignItems: "end", gap: 7, textAlign: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#526174", overflowWrap: "anywhere" }}>{item.spend ? money(item.spend) : "—"}</span>
                  <div style={{ height: 120, display: "flex", alignItems: "end", justifyContent: "center", borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ height, width: "min(100%, 28px)", borderRadius: "6px 6px 0 0", background: isSelected ? "#174b3b" : "#a8c5b7" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isSelected ? 800 : 600, color: isSelected ? "#174b3b" : "#718096" }}>{item.label}</span>
                </div>;
              })}
            </div>
            <p style={{ color: "#718096", fontSize: 11, margin: "14px 0 0" }}>Months without saved transactions appear as zero. Choose a different reporting month above to move this window.</p>
          </div>
        </div>

        <div className="expense-card" style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>Recent expenses</h3>
              <p style={{ color: "#718096", fontSize: 13, margin: "5px 0 0" }}>Latest saved transactions for {monthLabel(monthFilter)}.</p>
            </div>
            <button style={buttonStyle} onClick={() => setActiveTab("list")}>All transactions →</button>
          </div>
          {monthExpenses.length ? <div className="expense-scroll" style={{ marginTop: 14 }}><table className="expense-table"><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th style={{ textAlign: "right" }}>AMOUNT</th></tr></thead><tbody>
            {monthExpenses.slice().sort((a,b)=>(b.expenseDate?.getTime()??0)-(a.expenseDate?.getTime()??0)).slice(0,5).map((e, i) => <tr key={`${e.description}-${dateInput(e.expenseDate)}-${i}`}><td style={{ fontWeight: 700 }}>{e.description}</td><td>{e.category}</td><td>{dateInput(e.expenseDate)}</td><td style={{ textAlign: "right", fontWeight: 800 }}>{money(Number(e.amount)||0)}</td></tr>)}
          </tbody></table></div> : <p style={{ color: "#718096", fontSize: 13, marginTop: 18 }}>Nothing recorded yet. Add your first expense from the Expense List tab.</p>}
        </div>

        <div className="expense-card" style={{ ...cardStyle, background: "#f7faf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 5px", fontSize: 17 }}>Monthly snapshot</h3>
              <p style={{ color: "#718096", fontSize: 13, margin: 0 }}>A quick summary of spending and planning for {monthLabel(monthFilter)}.</p>
            </div>
            <span style={{ fontSize: 12, color: "#526174" }}>{recurringExpenses.length} recurring schedule{recurringExpenses.length === 1 ? "" : "s"} saved</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 16 }}>
            <div><div style={{ fontSize: 11, color: "#718096" }}>Previous month actual</div><strong style={{ display: "block", fontSize: 16, marginTop: 5 }}>{money(previousTotal)}</strong></div>
            <div><div style={{ fontSize: 11, color: "#718096" }}>Previous month budget</div><strong style={{ display: "block", fontSize: 16, marginTop: 5 }}>{money(previousMonthBudgetTotal)}</strong></div>
            <div><div style={{ fontSize: 11, color: "#718096" }}>Average monthly spend (6 months)</div><strong style={{ display: "block", fontSize: 16, marginTop: 5 }}>{money(monthlyTrend.reduce((sum, item) => sum + item.spend, 0) / monthlyTrend.length)}</strong></div>
            <div><div style={{ fontSize: 11, color: "#718096" }}>Budget status</div><strong style={{ display: "block", fontSize: 16, marginTop: 5, color: overBudgetCategories.length ? "#b42318" : budgetedCategoryCount ? "#286348" : "#718096" }}>{overBudgetCategories.length ? `${overBudgetCategories.length} over budget` : budgetedCategoryCount ? "No categories over budget" : "No budgets set"}</strong></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button style={primaryStyle} onClick={() => setActiveTab("list")}>Manage expenses</button>
            <button style={buttonStyle} onClick={() => setActiveTab("budget")}>Manage budgets</button>
            <button style={buttonStyle} onClick={exportMonth}>Export this month ↓</button>
          </div>
        </div>

        <div className="expense-card" style={cardStyle}>
          <h3 style={{ margin: "0 0 5px", fontSize: 17 }}>Quick add expense</h3>
          <p style={{ color: "#718096", fontSize: 13, margin: "0 0 16px" }}>Only saved transactions count as actual spending.</p>
          {formFields(form, setForm)}
          {formError && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{formError}</p>}
          <button style={{ ...primaryStyle, marginTop: 14 }} onClick={addExpense}>＋ Save expense</button>
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Budget vs Actual</h3>
            <p style={{ color: "#718096", fontSize: 13, margin: "5px 0 0" }}>{monthLabel(monthFilter)} · each month has its own independent budget</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={buttonStyle} onClick={copyPreviousBudget}>Copy previous month's budget</button>
            <button style={primaryStyle} onClick={saveBudgetDrafts}>Save budgets</button>
          </div>
        </div>
        <p style={{ color: "#718096", fontSize: 12, lineHeight: 1.5, margin: "12px 0 0" }}>
          Leave a field blank to mark that category as not budgeted. Enter <strong>0</strong> to set an explicit zero budget. Changes are saved when you select “Save budgets”.
        </p>
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          {budgetCategories.map((cat) => {
            const actual = categoryTotals.find(([c]) => c === cat)?.[1] || 0;
            const hasBudget = Object.prototype.hasOwnProperty.call(monthBudgets, cat);
            const rawDraft = budgetDrafts[cat] ?? (hasBudget ? String(monthBudgets[cat]) : "");
            const draftValue = rawDraft.trim() === "" ? null : Number(rawDraft);
            const draftIsValid = draftValue !== null && Number.isFinite(draftValue) && draftValue >= 0;
            const hasDraftBudget = draftIsValid;
            const budget = hasDraftBudget ? draftValue as number : 0;
            const variance = budget - actual;
            const pct = hasDraftBudget && budget > 0 ? Math.min(100, actual / budget * 100) : 0;
            const overBudget = hasDraftBudget && actual > budget;
            const status = !hasDraftBudget ? "Budget not set" : overBudget ? "Over budget" : "Within budget";
            const statusColor = !hasDraftBudget ? "#7a8999" : overBudget ? "#b42318" : "#286348";
            return <div key={cat} style={{ padding: 13, border: "1px solid #edf1f5", borderRadius: 12, display: "grid", gridTemplateColumns: "minmax(130px, 1fr) minmax(120px, 160px) minmax(120px, 1fr)", gap: 12, alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: 13 }}>{cat}</strong>
                <div style={{ fontSize: 12, color: "#718096", marginTop: 4 }}>Actual: {money(actual)}</div>
              </div>
              <label style={labelStyle}>MONTHLY BUDGET (₹)
                <input style={fieldStyle} type="number" min="0" step="0.01" inputMode="decimal"
                  value={rawDraft} placeholder="Not set"
                  aria-label={`${cat} monthly budget`}
                  onChange={(e) => updateBudgetDraft(cat, e.target.value)} />
              </label>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#718096", marginBottom: 6 }}>
                  <span>{hasDraftBudget && budget > 0 ? `${Math.round(actual / budget * 100)}% used` : hasDraftBudget && budget === 0 ? "0 budget" : "No budget set"}</span>
                  <strong style={{ color: statusColor }}>{status}</strong>
                </div>
                <div style={{ height: 7, borderRadius: 10, background: "#edf1f5", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: overBudget ? "#c45d55" : "#4e8a70" }} />
                </div>
                <div style={{ fontSize: 12, marginTop: 5, color: statusColor }}>
                  {hasDraftBudget ? `${money(Math.abs(variance))} ${variance >= 0 ? "remaining" : "over"}` : "Set a budget to track variance"}
                </div>
              </div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: 15, background: "#f7faf8", borderRadius: 12, marginTop: 16 }}>
          <span style={{ fontWeight: 700 }}>Total set budgets: {money(budgetTotal)}</span>
          <span style={{ fontWeight: 700 }}>Actual: {money(total)}</span>
          <span style={{ fontWeight: 800, color: total > budgetTotal && budgetTotal > 0 ? "#b42318" : "#286348" }}>
            {budgetTotal ? `${money(Math.abs(budgetTotal - total))} ${total <= budgetTotal ? "remaining" : "over budget"}` : "Set a budget to track variance"}
          </span>
        </div>
      </div>}

      {activeTab === "recurring" && <div className="expense-card" style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Recurring schedules</h3>
        <p style={{ color: "#718096", fontSize: 13, margin: "5px 0 16px" }}>These entries are not automatically copied into future months. Add a new transaction only after confirming that payment happened.</p>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 18 }}>
          <h4 style={{ margin: "0 0 12px" }}>{editingScheduleId ? "Edit schedule" : "Add a recurring schedule"}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <label style={labelStyle}>DESCRIPTION<input style={fieldStyle} value={scheduleDraft.description} placeholder="e.g. Internet bill" onChange={e=>setScheduleDraft({...scheduleDraft,description:e.target.value})}/></label>
            <label style={labelStyle}>AMOUNT (₹)<input style={fieldStyle} type="number" min="0.01" step="0.01" value={scheduleDraft.amount} onChange={e=>setScheduleDraft({...scheduleDraft,amount:e.target.value})}/></label>
            <label style={labelStyle}>CATEGORY<select style={fieldStyle} value={scheduleDraft.category} onChange={e=>setScheduleDraft({...scheduleDraft,category:e.target.value})}><option value="">Choose category</option>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
            <label style={labelStyle}>OWNER<input style={fieldStyle} value={scheduleDraft.owner} placeholder="Optional" onChange={e=>setScheduleDraft({...scheduleDraft,owner:e.target.value})}/></label>
            <label style={labelStyle}>FREQUENCY<select style={fieldStyle} value={scheduleDraft.frequency} onChange={e=>setScheduleDraft({...scheduleDraft,frequency:e.target.value as Frequency})}>{(["Weekly","Monthly","Quarterly","Yearly"] as Frequency[]).map(f=><option key={f}>{f}</option>)}</select></label>
            <label style={labelStyle}>FIRST DUE DATE<input style={fieldStyle} type="date" value={scheduleDraft.startDate} onChange={e=>setScheduleDraft({...scheduleDraft,startDate:e.target.value})}/></label>
            <label style={labelStyle}>LAST DUE DATE (OPTIONAL)<input style={fieldStyle} type="date" value={scheduleDraft.endDate} min={scheduleDraft.startDate} onChange={e=>setScheduleDraft({...scheduleDraft,endDate:e.target.value})}/></label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}><button style={primaryStyle} onClick={saveSchedule}>{editingScheduleId ? "Save changes" : "＋ Save schedule"}</button>{editingScheduleId && <button style={buttonStyle} onClick={()=>{setEditingScheduleId(null);setScheduleDraft({id:"",description:"",amount:"",category:"",owner:"",frequency:"Monthly",startDate:today(),endDate:"",paused:false,paidOccurrences:[]})}}>Cancel edit</button>}</div>
        </div>
        <h4 style={{ margin: "0 0 10px" }}>Scheduled payments · {monthLabel(monthFilter)}</h4>
        {schedules.filter(schedule => {
          // Show a schedule only from the month of its first due date through its optional end date.
          const start = parseDate(schedule.startDate);
          if (!start) return false;
          const [year, month] = monthFilter.split("-").map(Number);
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0);
          const end = schedule.endDate ? parseDate(schedule.endDate) : null;
          return start <= monthEnd && (!end || end >= monthStart);
        }).length ? <div style={{ display: "grid", gap: 12 }}>{schedules.filter(schedule => {
          const start = parseDate(schedule.startDate);
          if (!start) return false;
          const [year, month] = monthFilter.split("-").map(Number);
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0);
          const end = schedule.endDate ? parseDate(schedule.endDate) : null;
          return start <= monthEnd && (!end || end >= monthStart);
        }).map(schedule=>{
          const occurrences = schedule.paused ? [] : occurrenceDates(schedule, monthFilter);
          return <div key={schedule.id} style={{ border: "1px solid #edf1f5", padding: 14, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{schedule.description}</strong><div style={{ color: "#718096", fontSize: 12, marginTop: 5 }}>{schedule.category} · {schedule.owner || "No owner specified"} · {schedule.frequency}{schedule.paused ? " · Paused" : ""}</div></div><strong>{money(Number(schedule.amount)||0)}</strong></div>
            {schedule.paused ? <p style={{ fontSize: 12, color: "#718096", marginBottom: 0 }}>Schedule paused; no payment reminders shown.</p> : occurrences.length ? <div style={{ display: "grid", gap: 8, marginTop: 12 }}>{occurrences.map(due=>{const paid=schedule.paidOccurrences.includes(due)||expenses.some(e=>(e as Expense & {recurringOccurrence?:string}).recurringOccurrence===`${schedule.id}:${due}`);const overdue=!paid && due<today();return <div key={due} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: paid?"#eef8f1":overdue?"#fff1f0":"#f7f9fc", padding: 10, borderRadius: 9 }}><span style={{ fontSize: 13 }}>{due} · <strong style={{ color: paid?"#286348":overdue?"#b42318":"#526174" }}>{paid?"Confirmed":overdue?"Overdue":"Upcoming"}</strong></span>{!paid&&<button style={buttonStyle} onClick={()=>confirmOccurrence(schedule,due)}>Confirm payment</button>}</div>})}</div> : <p style={{ color: "#718096", fontSize: 12, marginBottom: 0 }}>No due dates for this month.</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button style={buttonStyle} onClick={()=>{setEditingScheduleId(schedule.id);setScheduleDraft({...schedule})}}>Edit</button><button style={buttonStyle} onClick={()=>persistSchedules(schedules.map(s=>s.id===schedule.id?{...s,paused:!s.paused}:s))}>{schedule.paused?"Resume":"Pause"}</button><button style={{...buttonStyle,color:"#b42318"}} onClick={()=>{if(window.confirm(`Delete recurring schedule “${schedule.description}”? Existing transactions will remain.`))deleteSchedule(schedule.id)}}>Delete schedule</button></div>
          </div>})}</div> : <p style={{ color: "#718096", fontSize: 13 }}>No recurring schedules yet. Add one above to track upcoming payments.</p>}
        <div style={{ marginTop: 16, background: "#fff8e8", color: "#7c5b20", padding: 12, borderRadius: 10, fontSize: 12 }}>Only confirmed payments become actual transactions and count toward spending and budgets. Scheduled amounts alone are never counted as actual spend.</div>
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
      {showCopyConfirmation && (
        <div role="presentation" onClick={() => setShowCopyConfirmation(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.45)", display: "grid", placeItems: "center", padding: 20 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="copy-budget-title" onClick={(e) => e.stopPropagation()} style={{ width: "min(100%, 440px)", background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.22)" }}>
            <h3 id="copy-budget-title" style={{ margin: "0 0 10px", fontSize: 18 }}>Replace this month's budget?</h3>
            <p style={{ color: "#526174", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              This copies {monthLabel(previousMonth)}'s saved category budgets into {monthLabel(monthFilter)} and replaces any budgets currently set for that destination month. The source month will not change.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
              <button style={buttonStyle} onClick={() => setShowCopyConfirmation(false)}>Cancel</button>
              <button style={primaryStyle} onClick={confirmCopyPreviousBudget}>Copy budget</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
