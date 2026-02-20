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

type RecurringType = "None" | "Monthly";

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

type BudgetStore = Record<string, Record<string, number>>;

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
  const [activeTab, setActiveTab] = useState<"list" | "chart" | "budget">("list");

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Expense>(emptyForm);

  const [budgets, setBudgets] = useState<BudgetStore>({});

  // ================= LOAD =================
  useEffect(() => {
    const stored: StoredExpense[] = getData("expenses") || [];

    const hydrated = stored.map(e => ({
      ...e,
      recurring: e.recurring ?? "None",
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

    const savedBudgets = getData("expenseBudgets") || {};
    setBudgets(savedBudgets);
  }, []);

  // ================= PERSIST =================
  const persist = (updated: Expense[]) => {
    const dehydrated: StoredExpense[] = updated.map(e => ({
      ...e,
      expenseDate: e.expenseDate?.toISOString() ?? null
    }));

    setExpenses(updated);
    saveData("expenses", dehydrated);
  };

  const saveBudgets = (updated: BudgetStore) => {
    setBudgets(updated);
    saveData("expenseBudgets", updated);
  };

  const formatDate = (d: Date | null) =>
    d ? d.toISOString().split("T")[0] : "";

  const getMonthKey = (d: Date | null) =>
    d ? d.toISOString().slice(0, 7) : "";

  // ================= ADD =================
  const addExpense = () => {
    if (!form.description || !form.amount || !form.category) return;
    persist([...expenses, form]);
    setForm({ ...emptyForm, expenseDate: new Date() });
  };

  // ================= EDIT =================
  const startEdit = (filteredIndex: number) => {
    const originalIndex = expenses.indexOf(filteredExpenses[filteredIndex]);
    setEditIndex(originalIndex);
    setEditForm(expenses[originalIndex]);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...expenses];
    updated[editIndex] = editForm;
    persist(updated);
    setEditIndex(null);
  };

  const deleteExpense = (filteredIndex: number) => {
    const originalIndex = expenses.indexOf(filteredExpenses[filteredIndex]);
    persist(expenses.filter((_, idx) => idx !== originalIndex));
  };

  // ================= FILTER =================
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

  const previousMonthTotal = useMemo(() => {
    if (!monthFilter) return 0;
    const [year, month] = monthFilter.split("-").map(Number);
    const prev = new Date(year, month - 2);
    const prevKey = prev.toISOString().slice(0, 7);

    return expenses
      .filter(e => getMonthKey(e.expenseDate) === prevKey)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [monthFilter, expenses]);

  const percentChange =
    previousMonthTotal === 0
      ? 0
      : ((totalFilteredAmount - previousMonthTotal) /
          previousMonthTotal) *
        100;

  // ================= RECURRING =================
  useEffect(() => {
    if (!monthFilter) return;

    const newExpenses = [...expenses];
    let changed = false;

    expenses.forEach(e => {
      if (e.recurring === "Monthly") {
        const exists = expenses.some(
          ex =>
            ex.description === e.description &&
            getMonthKey(ex.expenseDate) === monthFilter
        );

        if (!exists) {
          newExpenses.push({
            ...e,
            expenseDate: new Date(monthFilter + "-01")
          });
          changed = true;
        }
      }
    });

    if (changed) persist(newExpenses);
  }, [monthFilter]);

  // ================= CATEGORY DATA =================
  const categoryActuals = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return map;
  }, [filteredExpenses]);

  const categoryData = {
    labels: Object.keys(categoryActuals),
    datasets: [{ data: Object.values(categoryActuals) }]
  };

  const monthBudgets = budgets[monthFilter] || {};

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

        <button
          style={{ marginLeft: 8 }}
          className={activeTab === "budget" ? "primary" : ""}
          onClick={() => setActiveTab("budget")}
        >
          Budget vs Actual
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
          <p>Previous Month: ₹{previousMonthTotal.toLocaleString()}</p>
          <p>
            Change:{" "}
            <strong style={{ color: percentChange >= 0 ? "red" : "green" }}>
              {percentChange.toFixed(1)}%
            </strong>
          </p>
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
              </select>
            </div>

            <div className="card-actions">
              <button className="primary" onClick={addExpense}>
                Add Expense
              </button>
            </div>
          </div>

          {/* Expense Table */}
          {filteredExpenses.length > 0 && (
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Date</th>
                    <th>Recurring</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((e, i) => {
                    const originalIndex = expenses.indexOf(e);
                    const isEditing = editIndex === originalIndex;

                    return (
                      <tr key={i}>
                        {isEditing ? (
                          <>
                            <td>
                              <input
                                value={editForm.description}
                                onChange={ev =>
                                  setEditForm({
                                    ...editForm,
                                    description: ev.target.value
                                  })
                                }
                              />
                            </td>
                            <td>
                              <select
                                value={editForm.category}
                                onChange={ev =>
                                  setEditForm({
                                    ...editForm,
                                    category: ev.target.value
                                  })
                                }
                              >
                                {EXPENSE_CATEGORIES.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                value={editForm.owner}
                                onChange={ev =>
                                  setEditForm({
                                    ...editForm,
                                    owner: ev.target.value
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                value={formatDate(editForm.expenseDate)}
                                onChange={ev =>
                                  setEditForm({
                                    ...editForm,
                                    expenseDate: ev.target.value
                                      ? new Date(ev.target.value)
                                      : null
                                  })
                                }
                              />
                            </td>
                            <td>
                              <select
                                value={editForm.recurring}
                                onChange={ev =>
                                  setEditForm({
                                    ...editForm,
                                    recurring: ev.target.value as RecurringType
                                  })
                                }
                              >
                                <option value="None">No Recurring</option>
                                <option value="Monthly">Monthly</option>
                              </select>
                            </td>
                            <td>
                              <input
                                value={editForm.amount}
                                onChange={ev =>
                                  setEditForm({
                                    ...editForm,
                                    amount: ev.target.value
                                  })
                                }
                              />
                            </td>
                            <td>
                              <button onClick={saveEdit}>Save</button>
                              <button onClick={() => setEditIndex(null)}>
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{e.description}</td>
                            <td>{e.category}</td>
                            <td>{e.owner}</td>
                            <td>{formatDate(e.expenseDate)}</td>
                            <td>{e.recurring}</td>
                            <td>₹{Number(e.amount).toLocaleString()}</td>
                            <td>
                              <button onClick={() => startEdit(i)}>Edit</button>
                              <button
                                className="danger"
                                onClick={() => deleteExpense(i)}
                              >
                                Delete
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* BUDGET TAB */}
      {activeTab === "budget" && monthFilter && (
        <div className="card">
          <h3>Budget vs Actual ({monthFilter})</h3>

          {EXPENSE_CATEGORIES.map(cat => {
            const actual = categoryActuals[cat] || 0;
            const budget = monthBudgets[cat] || 0;
            const variance = actual - budget;

            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <strong>{cat}</strong> — Budget: ₹
                <input
                  type="number"
                  value={budget}
                  onChange={e =>
                    saveBudgets({
                      ...budgets,
                      [monthFilter]: {
                        ...monthBudgets,
                        [cat]: Number(e.target.value)
                      }
                    })
                  }
                  style={{ width: 100, marginLeft: 6 }}
                />
                {" | "}Actual: ₹{actual.toLocaleString()}
                {" | "}
                <span style={{ color: variance > 0 ? "red" : "green" }}>
                  Variance: ₹{variance.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* CHART TAB */}
      {activeTab === "chart" && filteredExpenses.length > 0 && (
        <div className="card">
          <h3>Category Breakdown ({monthFilter})</h3>
          <Pie data={categoryData} />
        </div>
      )}
    </section>
  );
}
