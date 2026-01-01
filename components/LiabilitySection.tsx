"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

export default function LiabilitySection() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => {
    setItems(getData("liabilities"));
  }, []);

  const persist = (updated: any[]) => {
    setItems(updated);
    saveData("liabilities", updated);
  };

  const addItem = () => {
    if (!name || !amount) return;
    persist([...items, { name, amount }]);
    setName("");
    setAmount("");
  };

  const deleteItem = (index: number) => {
    persist(items.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditName(items[index].name);
    setEditAmount(items[index].amount);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...items];
    updated[editIndex] = { name: editName, amount: editAmount };
    persist(updated);
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditName("");
    setEditAmount("");
  };

  return (
    <section>
      <h2>📉 Liabilities</h2>

      <input
        placeholder="Liability Name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button onClick={addItem}>Add</button>

      <ul>
        {items.map((l, i) => (
          <li key={i}>
            {editIndex === i ? (
              <>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
                <input
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                />
                <button onClick={saveEdit}>Save</button>
                <button onClick={cancelEdit}>Cancel</button>
              </>
            ) : (
              <>
                {l.name} – ₹{l.amount}
                <button onClick={() => startEdit(i)}>Edit</button>
                <button onClick={() => deleteItem(i)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
