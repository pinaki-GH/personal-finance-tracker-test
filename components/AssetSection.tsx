"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

export default function AssetSection() {
  const [assets, setAssets] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setAssets(getData("assets"));
  }, []);

  const persist = (updated: any[]) => {
    setAssets(updated);
    saveData("assets", updated);
  };

  const addAsset = () => {
    if (!name || !value) return;
    persist([...assets, { name, value }]);
    setName("");
    setValue("");
  };

  const deleteAsset = (index: number) => {
    persist(assets.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditName(assets[index].name);
    setEditValue(assets[index].value);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...assets];
    updated[editIndex] = { name: editName, value: editValue };
    persist(updated);
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditName("");
    setEditValue("");
  };

  return (
    <section>
      <h2>🏦 Assets</h2>

      <input placeholder="Asset Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Value" value={value} onChange={e => setValue(e.target.value)} />
      <button onClick={addAsset}>Add</button>

      <ul>
        {assets.map((a, i) => (
          <li key={i}>
            {editIndex === i ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} />
                <input value={editValue} onChange={e => setEditValue(e.target.value)} />
                <button onClick={saveEdit}>Save</button>
                <button onClick={cancelEdit}>Cancel</button>
              </>
            ) : (
              <>
                {a.name} – ₹{a.value}
                <button onClick={() => startEdit(i)}>Edit</button>
                <button onClick={() => deleteAsset(i)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
