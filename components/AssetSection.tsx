"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

type Asset = {
  assetName: string;
  purchaseDate: Date | null;
  assetValue: string;
  valueRecordDate: Date | null;
  assetId: string;
  assetIdDescription: string;
  owner: string;
  institution: string;
};

// Used only for persistence
type StoredAsset = Omit<Asset, "purchaseDate" | "valueRecordDate"> & {
  purchaseDate: string | null;
  valueRecordDate: string | null;
};

export default function AssetSection() {
  const [assets, setAssets] = useState<Asset[]>([]);

  const emptyForm: Asset = {
    assetName: "",
    purchaseDate: null,
    assetValue: "",
    valueRecordDate: null,
    assetId: "",
    assetIdDescription: "",
    owner: "",
    institution: ""
  };

  const [form, setForm] = useState<Asset>(emptyForm);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Asset>(emptyForm);

  // 🔁 Load & convert dates
  useEffect(() => {
    const stored: StoredAsset[] = getData("assets");

    const hydrated: Asset[] = stored.map(a => ({
      ...a,
      purchaseDate: a.purchaseDate ? new Date(a.purchaseDate) : null,
      valueRecordDate: a.valueRecordDate ? new Date(a.valueRecordDate) : null
    }));

    setAssets(hydrated);
  }, []);

  // 🔁 Persist & dehydrate dates
  const persist = (updated: Asset[]) => {
    const dehydrated: StoredAsset[] = updated.map(a => ({
      ...a,
      purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString() : null,
      valueRecordDate: a.valueRecordDate ? a.valueRecordDate.toISOString() : null
    }));

    setAssets(updated);
    saveData("assets", dehydrated);
  };

  const handleChange = (key: keyof Asset, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const addAsset = () => {
    if (!form.assetName || !form.assetValue) return;
    persist([...assets, form]);
    setForm(emptyForm);
  };

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditForm(assets[index]);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...assets];
    updated[editIndex] = editForm;
    persist(updated);
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditIndex(null);
  };

  const deleteAsset = (index: number) => {
    persist(assets.filter((_, i) => i !== index));
  };

  const formatDate = (d: Date | null) =>
    d ? d.toISOString().split("T")[0] : "";

  return (
    <section>
      <h2>🏦 Assets</h2>

      {/* Add Asset Form */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <input
          placeholder="Asset Name"
          value={form.assetName}
          onChange={e => handleChange("assetName", e.target.value)}
        />

        <input
          type="date"
          value={formatDate(form.purchaseDate)}
          onChange={e =>
            handleChange(
              "purchaseDate",
              e.target.value ? new Date(e.target.value) : null
            )
          }
        />

        <input
          placeholder="Asset Value"
          value={form.assetValue}
          onChange={e => handleChange("assetValue", e.target.value)}
        />

        <input
          type="date"
          value={formatDate(form.valueRecordDate)}
          onChange={e =>
            handleChange(
              "valueRecordDate",
              e.target.value ? new Date(e.target.value) : null
            )
          }
        />

        <input placeholder="Asset ID" value={form.assetId} onChange={e => handleChange("assetId", e.target.value)} />
        <input placeholder="Asset ID Description" value={form.assetIdDescription} onChange={e => handleChange("assetIdDescription", e.target.value)} />
        <input placeholder="Owner" value={form.owner} onChange={e => handleChange("owner", e.target.value)} />
        <input placeholder="Institution" value={form.institution} onChange={e => handleChange("institution", e.target.value)} />
      </div>

      <button onClick={addAsset}>Add Asset</button>

      {/* Asset Table */}
      {assets.length > 0 && (
        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Asset Name</th>
              <th>Purchase Date</th>
              <th>Asset Value</th>
              <th>Value Record Date</th>
              <th>Asset ID</th>
              <th>Asset ID Description</th>
              <th>Owner</th>
              <th>Institution</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a, i) => (
              <tr key={i}>
                {editIndex === i ? (
                  <>
                    <td><input value={editForm.assetName} onChange={e => setEditForm({ ...editForm, assetName: e.target.value })} /></td>
                    <td><input type="date" value={formatDate(editForm.purchaseDate)} onChange={e => setEditForm({ ...editForm, purchaseDate: e.target.value ? new Date(e.target.value) : null })} /></td>
                    <td><input value={editForm.assetValue} onChange={e => setEditForm({ ...editForm, assetValue: e.target.value })} /></td>
                    <td><input type="date" value={formatDate(editForm.valueRecordDate)} onChange={e => setEditForm({ ...editForm, valueRecordDate: e.target.value ? new Date(e.target.value) : null })} /></td>
                    <td><input value={editForm.assetId} onChange={e => setEditForm({ ...editForm, assetId: e.target.value })} /></td>
                    <td><input value={editForm.assetIdDescription} onChange={e => setEditForm({ ...editForm, assetIdDescription: e.target.value })} /></td>
                    <td><input value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} /></td>
                    <td><input value={editForm.institution} onChange={e => setEditForm({ ...editForm, institution: e.target.value })} /></td>
                    <td>
                      <button onClick={saveEdit}>Save</button>
                      <button onClick={cancelEdit}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{a.assetName}</td>
                    <td>{formatDate(a.purchaseDate)}</td>
                    <td>₹{a.assetValue}</td>
                    <td>{formatDate(a.valueRecordDate)}</td>
                    <td>{a.assetId}</td>
                    <td>{a.assetIdDescription}</td>
                    <td>{a.owner}</td>
                    <td>{a.institution}</td>
                    <td>
                      <button onClick={() => startEdit(i)}>Edit</button>
                      <button onClick={() => deleteAsset(i)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
