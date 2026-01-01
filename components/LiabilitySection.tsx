"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

export default function LiabilitySection() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => setItems(getData("liabilities")), []);

  const addItem = () => {
    const updated = [...items, { name, amount }];
    setItems(updated);
    saveData("liabilities", updated);
    setName("");
    setAmount("");
  };

  return (
    <section>
      <h2>📉 Liabilities</h2>
      <input placeholder="Liability Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
      <button onClick={addItem}>Add</button>

      <ul>
        {items.map((l, i) => (
          <li key={i}>{l.name} - ₹{l.amount}</li>
        ))}
      </ul>
    </section>
  );
}
