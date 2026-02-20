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
  const [monthFilter, setMonthFilter] = useState<string>("All");

  useEffect(() => {
    const stored: StoredExpense[] = getData("expenses");
    setExpenses(
      stored.map(e => ({
        ...e,
        expenseDate: e.expenseDate ? new Date(e.expenseDate) : null
      }))
    );
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

  const deleteExpense = (i: number) =>
    persist(expenses.filter((_, idx) => idx !== i));

  const availableMonths = useMemo(() => {
    const months = expenses.map(e => getMonthKey(e.expenseDate));
    return ["All", ...Array.from(new Set(months.filter(Boolean)))];
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (monthFilter === "All") return expenses;
    return expenses.filter(e => getMonthKey(e.expenseDate) === monthFilter);
  }, [expenses, monthFilter]);

  const totalFilteredAmount = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  const previousMonthTotal = useMemo(() => {
    if (monthFilter === "All") return 0;
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
      datasets: [
        {
          data: Object.values(map)
        }
      ]
    };
  }, [filteredExpenses]);

  return (
    <section>
      <h2>💸 Expenses</h2>

      {/* ADD EXPENSE */}
      <div className="card">
        <h3>Add Expense</h3>
        <div className="form-grid">
          <div>
            <label>Description</label>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label>Amount</label>
            <input
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div>
            <label>Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
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
              onChange={e => setForm({ ...form, owner: e.target.value })}
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

      {/* FILTER */}
      {expenses.length > 0 && (
        <div style={{ margin: "12px 0" }}>
          <label style={{ marginRight: 8 }}>Filter by Month:</label>
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

      {/* MONTHLY SUMMARY */}
      {monthFilter !== "All" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Monthly Summary ({monthFilter})</h3>
          <p>Total: ₹{totalFilteredAmount.toLocaleString()}</p>
          <p>Previous Month: ₹{previousMonthTotal.toLocaleString()}</p>
          <p>
            Change:{" "}
            <strong
              style={{
                color: percentChange >= 0 ? "red" : "green"
              }}
            >
              {percentChange.toFixed(1)}%
            </strong>
          </p>
        </div>
      )}

      {/* PIE CHART */}
      {filteredExpenses.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Category Breakdown</h3>
          <Pie data={categoryData} />
        </div>
      )}

      {/* TABLE */}
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
              {filteredExpenses.map((e, i) => (
                <tr key={i}>
                  <td>{e.description}</td>
                  <td>{e.category}</td>
                  <td>{e.owner}</td>
                  <td>{formatDate(e.expenseDate)}</td>
                  <td>₹{Number(e.amount).toLocaleString()}</td>
                  <td>
                    <button
                      className="danger"
                      onClick={() =>
                        deleteExpense(
                          expenses.indexOf(e)
                        )
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
