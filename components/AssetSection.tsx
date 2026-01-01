"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "@/utils/storage";

export default function AssetSection() {
  const [assets, setAssets] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => setAssets(getData("assets")), []);

  const addAsset = () => {
    const updated = [...assets, { name, value }];
    setAssets(updated);
    saveData("assets", updated);
    setName("");
    setValue("");
  };

  return (
    <section>
      <h2>🏦 Assets</h2>
      <input placeholder="Asset Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Value" value={value} onChange={e => setValue(e.target.value)} />
      <button onClick={addAsset}>Add</button>

      <ul>
        {assets.map((a, i) => (
          <li key={i}>{a.name} - ₹{a.value}</li>
        ))}
      </ul>
    </section>
  );
}
