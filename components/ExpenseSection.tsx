"use client";

import { useEffect, useMemo, useState } from "react";
import { getData, saveData } from "../utils/storage";

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

  const addExpense = () => {
    if (!form.description || !form.amount || !form.category) return;
    persist([...expenses, form]);
    setForm({ ...emptyForm, expenseDate: new Date() });
  };

  const deleteExpense = (i: number) =>
    persist(expenses.filter((_, idx) => idx !== i));

  // Build month list (YYYY-MM)
  const availableMonths = useMemo(() => {
    const months = expenses
      .map(e => formatDate(e.expenseDate)?.slice(0, 7))
      .filter(Boolean);
    return ["All", ...Array.from(new Set(months))];
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (monthFilter === "All") return expenses;
    return expenses.filter(e =>
      formatDate(e.expenseDate)?.startsWith(monthFilter)
    );
  }, [expenses, monthFilter]);

  const totalFilteredAmount = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

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
              onChange={e =>
                setForm({ ...form, description: e.target.value })
              }
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

      {/* FILTER BAR */}
      {expenses.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            margin: "12px 0"
          }}
        >
          <div>
            <label style={{ marginRight: 8 }}>Filter by Month:</label>
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <strong>
              Total: ₹{totalFilteredAmount.toLocaleString()}
            </strong>
          </div>
        </div>
      )}

      {/* EXPENSE TABLE */}
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
