"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

export default function AssetSection() {
  const [assets, setAssets] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);

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

  const saveEdit = (index: number, updated: any) => {
    const updatedAssets = [...assets];
    updatedAssets[index] = updated;
    persist(updatedAssets);
    setEditIndex(null);
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
                <input
                  value={a.name}
                  onChange={e => saveEdit(i, { ...a, name: e.target.value })}
                />
                <input
                  value={a.value}
                  onChange={e => saveEdit(i, { ...a, value: e.target.value })}
                />
                <button onClick={() => setEditIndex(null)}>Done</button>
              </>
            ) : (
              <>
                {a.name} – ₹{a.value}
                <button onClick={() => setEditIndex(i)}>Edit</button>
                <button onClick={() => deleteAsset(i)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
