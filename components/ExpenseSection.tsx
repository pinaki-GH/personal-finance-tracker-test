"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

export default function ExpenseSection() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => {
    setExpenses(getData("expenses"));
  }, []);

  const persist = (updated: any[]) => {
    setExpenses(updated);
    saveData("expenses", updated);
  };

  const addExpense = () => {
    if (!desc || !amount) return;
    persist([...expenses, { desc, amount }]);
    setDesc("");
    setAmount("");
  };

  const deleteExpense = (index: number) => {
    persist(expenses.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditDesc(expenses[index].desc);
    setEditAmount(expenses[index].amount);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...expenses];
    updated[editIndex] = { desc: editDesc, amount: editAmount };
    persist(updated);
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditDesc("");
    setEditAmount("");
  };

  return (
    <section>
      <h2>🧾 Expenses</h2>

      <input
        placeholder="Description"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />
      <input
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button onClick={addExpense}>Add</button>

      <ul>
        {expenses.map((e, i) => (
          <li key={i}>
            {editIndex === i ? (
              <>
                <input
                  value={editDesc}
                  onChange={e2 => setEditDesc(e2.target.value)}
                />
                <input
                  value={editAmount}
                  onChange={e2 => setEditAmount(e2.target.value)}
                />
                <button onClick={saveEdit}>Save</button>
                <button onClick={cancelEdit}>Cancel</button>
              </>
            ) : (
              <>
                {e.desc} – ₹{e.amount}
                <button onClick={() => startEdit(i)}>Edit</button>
                <button onClick={() => deleteExpense(i)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
