"use client";

import { useEffect, useMemo, useState } from "react";
import { getData, saveData } from "../utils/storage";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const EXPENSE_CATEGORIES = [
  "Housing",
  "Groceries",
  "Utilities",
  "Insurance",
  "Transport",
  "Healthcare",
  "Education",
  "Entertainment",
  "Dining Out",
  "Travel",
  "EMI / Loan Repayment",
  "Investments",
  "Miscellaneous"
];

type RecurringType = "None" | "Monthly" | "Yearly";

type Expense = {
  description: string;
  amount: string;
  category: string;
  owner: string;
  expenseDate: Date | null;
  recurring: RecurringType;
};

type StoredExpense = Omit<Expense, "expenseDate"> & {
  expenseDate: string | null;
};

const emptyForm: Expense = {
  description: "",
  amount: "",
  category: "",
  owner: "",
  expenseDate: new Date(),
  recurring: "None"
};

export default function ExpenseSection() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<Expense>(emptyForm);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"list" | "chart">("list");
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored: StoredExpense[] = getData("expenses");
    const hydrated = stored.map(e => ({
      ...e,
      expenseDate: e.expenseDate ? new Date(e.expenseDate) : null
    }));
    setExpenses(hydrated);

    const months = hydrated
      .map(e => e.expenseDate?.toISOString().slice(0, 7))
      .filter(Boolean)
      .sort();

    if (months.length > 0) {
      setMonthFilter(months[months.length - 1]);
    }

    const savedBudgets = getData("expenseBudgets");
    setBudgets(savedBudgets || {});
  }, []);

  const persist = (updated: Expense[]) => {
    const dehydrated: StoredExpense[] = updated.map(e => ({
      ...e,
      expenseDate: e.expenseDate?.toISOString() ?? null
    }));
    setExpenses(updated);
    saveData("expenses", dehydrated);
  };

  const saveBudgets = (updated: Record<string, number>) => {
    setBudgets(updated);
    saveData("expenseBudgets", updated);
  };

  const formatDate = (d: Date | null) =>
    d ? d.toISOString().split("T")[0] : "";

  const getMonthKey = (d: Date | null) =>
    d ? d.toISOString().slice(0, 7) : "";

  const addExpense = () => {
    if (!form.description || !form.amount || !form.category) return;
    persist([...expenses, form]);
    setForm({ ...emptyForm, expenseDate: new Date() });
  };

  const availableMonths = useMemo(() => {
    const months = expenses.map(e => getMonthKey(e.expenseDate));
    return Array.from(new Set(months.filter(Boolean))).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (!monthFilter) return [];
    return expenses.filter(e => getMonthKey(e.expenseDate) === monthFilter);
  }, [expenses, monthFilter]);

  const totalFilteredAmount = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  // ===== BUDGET VS ACTUAL =====

  const categoryActuals = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return map;
  }, [filteredExpenses]);

  // ===== RECURRING LOGIC =====
  useEffect(() => {
    if (!monthFilter) return;

    const newExpenses = [...expenses];
    const currentMonth = monthFilter;

    expenses.forEach(e => {
      if (e.recurring === "Monthly") {
        const key = getMonthKey(e.expenseDate);
        if (key !== currentMonth) {
          const exists = expenses.some(
            ex =>
              ex.description === e.description &&
              getMonthKey(ex.expenseDate) === currentMonth
          );
          if (!exists) {
            newExpenses.push({
              ...e,
              expenseDate: new Date(currentMonth + "-01")
            });
          }
        }
      }
    });

    persist(newExpenses);
  }, [monthFilter]);

  // ===== PIE CHART =====

  const categoryData = {
    labels: Object.keys(categoryActuals),
    datasets: [
      {
        data: Object.values(categoryActuals)
      }
    ]
  };

  return (
    <section>
      <h2>💸 Expenses</h2>

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <button
          className={activeTab === "list" ? "primary" : ""}
          onClick={() => setActiveTab("list")}
        >
          Expense List
        </button>

        <button
          style={{ marginLeft: 8 }}
          className={activeTab === "chart" ? "primary" : ""}
          onClick={() => setActiveTab("chart")}
        >
          Category Breakdown
        </button>
      </div>

      {/* Month Filter */}
      {availableMonths.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8 }}>Select Month:</label>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
          >
            {availableMonths.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>
      )}

      {/* Monthly Summary */}
      {monthFilter && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Monthly Summary ({monthFilter})</h3>
          <p>Total: ₹{totalFilteredAmount.toLocaleString()}</p>
        </div>
      )}

      {/* LIST TAB */}
      {activeTab === "list" && (
        <>
          <div className="card">
            <h3>Add Expense</h3>

            <div className="form-grid">
              <input
                placeholder="Description"
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <input
                placeholder="Amount"
                value={form.amount}
                onChange={e =>
                  setForm({ ...form, amount: e.target.value })
                }
              />

              <select
                value={form.category}
                onChange={e =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                <option value="">Category</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>

              <input
                placeholder="Owner"
                value={form.owner}
                onChange={e =>
                  setForm({ ...form, owner: e.target.value })
                }
              />

              <input
                type="date"
                value={formatDate(form.expenseDate)}
                onChange={e =>
                  setForm({
                    ...form,
                    expenseDate: e.target.value
                      ? new Date(e.target.value)
                      : null
                  })
                }
              />

              <select
                value={form.recurring}
                onChange={e =>
                  setForm({
                    ...form,
                    recurring: e.target.value as RecurringType
                  })
                }
              >
                <option value="None">No Recurring</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            <div className="card-actions">
              <button className="primary" onClick={addExpense}>
                Add Expense
              </button>
            </div>
          </div>

          {/* Budget vs Actual */}
          <div className="card">
            <h3>Budget vs Actual</h3>
            {Object.keys(categoryActuals).map(cat => {
              const actual = categoryActuals[cat];
              const budget = budgets[cat] || 0;
              const variance = actual - budget;

              return (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <strong>{cat}</strong> — Budget: ₹
                  <input
                    type="number"
                    value={budget}
                    onChange={e =>
                      saveBudgets({
                        ...budgets,
                        [cat]: Number(e.target.value)
                      })
                    }
                    style={{ width: 100, marginLeft: 4 }}
                  />
                  {" | "}Actual: ₹{actual.toLocaleString()}
                  {" | "}
                  <span
                    style={{
                      color: variance > 0 ? "red" : "green"
                    }}
                  >
                    Variance: ₹{variance.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* CHART TAB */}
      {activeTab === "chart" && (
        <div className="card">
          <h3>Category Breakdown ({monthFilter})</h3>
          <Pie data={categoryData} />
        </div>
      )}
    </section>
  );
}
