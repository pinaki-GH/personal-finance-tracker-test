"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "@/utils/storage";

export default function ExpenseSection() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => setExpenses(getData("expenses")), []);

  const addExpense = () => {
    const updated = [...expenses, { desc, amount }];
    setExpenses(updated);
    saveData("expenses", updated);
    setDesc("");
    setAmount("");
  };

  return (
    <section>
      <h2>🧾 Expenses</h2>
      <input placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
      <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
      <button onClick={addExpense}>Add</button>

      <ul>
        {expenses.map((e, i) => (
          <li key={i}>{e.desc} - ₹{e.amount}</li>
        ))}
      </ul>
    </section>
  );
}
