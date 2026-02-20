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

type Expense = {
  description: string;
  amount: string;
  category: string;
  owner: string;
  expenseDate: Date | null;
};

type StoredExpense = Omit<Expense, "expenseDate"> & {
  expenseDate: string | null;
};

const emptyForm: Expense = {
  description: "",
  amount: "",
  category: "",
  owner: "",
  expenseDate: new Date()
};

export default function ExpenseSection() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<Expense>(emptyForm);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"list" | "chart">("list");

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Expense>(emptyForm);

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
  }, []);

  const persist = (updated: Expense[]) => {
    const dehydrated: StoredExpense[] = updated.map(e => ({
      ...e,
      expenseDate: e.expenseDate?.toISOString() ?? null
    }));
    setExpenses(updated);
    saveData("expenses", dehydrated);
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

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });

    return {
      labels: Object.keys(map),
      datasets: [{ data: Object.values(map) }]
    };
  }, [filteredExpenses]);

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
              <div>
                <label>Description</label>
                <input
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Amount</label>
                <input
                  value={form.amount}
                  onChange={e =>
                    setForm({ ...form, amount: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={e =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option value="">Select Category</option>
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Owner</label>
                <input
                  value={form.owner}
                  onChange={e =>
                    setForm({ ...form, owner: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Expense Date</label>
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
              </div>
            </div>
            <div className="card-actions">
              <button className="primary" onClick={addExpense}>
                Add Expense
              </button>
            </div>
          </div>

          {filteredExpenses.length > 0 && (
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Date</th>
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
                            <td>₹{Number(e.amount).toLocaleString()}</td>
                            <td>
                              <button onClick={() => startEdit(i)}>
                                Edit
                              </button>
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
