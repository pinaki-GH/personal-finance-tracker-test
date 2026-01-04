"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";
import { exportToExcel } from "../utils/exportToExcel";

const ASSET_CATEGORIES = [
  "Cash & Cash Equivalents",
  "Equity",
  "Debt",
  "Real Assets",
  "Alternatives",
  "Retirement",
  "Insurance-linked",
  "Other"
];

const exportAssets = () => {
  const exportData = assets.map(a => ({
    "Asset Name": a.assetName,
    "Category": a.category,
    "Purchase Date": formatDate(a.purchaseDate),
    "Asset Value": a.assetValue,
    "Value Record Date": formatDate(a.valueRecordDate),
    "Asset ID": a.assetId,
    "Asset ID Description": a.assetIdDescription,
    "Owner": a.owner,
    "Institution": a.institution
  }));

  exportToExcel(exportData, "assets");
};

type Asset = {
  assetName: string;
  category: string;
  purchaseDate: Date | null;
  assetValue: string;
  valueRecordDate: Date | null;
  assetId: string;
  assetIdDescription: string;
  owner: string;
  institution: string;
};

type StoredAsset = Omit<Asset, "purchaseDate" | "valueRecordDate"> & {
  purchaseDate: string | null;
  valueRecordDate: string | null;
};

const emptyForm: Asset = {
  assetName: "",
  category: "",
  purchaseDate: null,
  assetValue: "",
  valueRecordDate: null,
  assetId: "",
  assetIdDescription: "",
  owner: "",
  institution: ""
};

export default function AssetSection() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<Asset>(emptyForm);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Asset>(emptyForm);

  // Load assets
  useEffect(() => {
    const stored: StoredAsset[] = getData("assets");
    setAssets(
      stored.map(a => ({
        ...a,
        purchaseDate: a.purchaseDate ? new Date(a.purchaseDate) : null,
        valueRecordDate: a.valueRecordDate ? new Date(a.valueRecordDate) : null
      }))
    );
  }, []);

  // Persist assets
  const persist = (updated: Asset[]) => {
    const dehydrated: StoredAsset[] = updated.map(a => ({
      ...a,
      purchaseDate: a.purchaseDate?.toISOString() ?? null,
      valueRecordDate: a.valueRecordDate?.toISOString() ?? null
    }));
    setAssets(updated);
    saveData("assets", dehydrated);
  };

  const formatDate = (d: Date | null) =>
    d ? d.toISOString().split("T")[0] : "";

  // Add asset
  const addAsset = () => {
    if (!form.assetName || !form.assetValue || !form.category) return;
    persist([...assets, form]);
    setForm(emptyForm);
  };

  // Edit handlers
  const startEdit = (i: number) => {
    setEditIndex(i);
    setEditForm(assets[i]);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...assets];
    updated[editIndex] = editForm;
    persist(updated);
    setEditIndex(null);
  };

  const deleteAsset = (i: number) =>
    persist(assets.filter((_, idx) => idx !== i));

  return (
    <section>
      <h2>🏦 Assets</h2>

      {/* ADD ASSET */}
      <div className="card">
        <h3>Add Asset</h3>

        <div className="form-grid">
          <div>
            <label>Asset Name</label>
            <input value={form.assetName} onChange={e => setForm({ ...form, assetName: e.target.value })} />
          </div>

          <div>
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">Select Category</option>
              {ASSET_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Purchase Date</label>
            <input type="date" value={formatDate(form.purchaseDate)} onChange={e => setForm({ ...form, purchaseDate: e.target.value ? new Date(e.target.value) : null })} />
          </div>

          <div>
            <label>Asset Value</label>
            <input value={form.assetValue} onChange={e => setForm({ ...form, assetValue: e.target.value })} />
          </div>

          <div>
            <label>Value Record Date</label>
            <input type="date" value={formatDate(form.valueRecordDate)} onChange={e => setForm({ ...form, valueRecordDate: e.target.value ? new Date(e.target.value) : null })} />
          </div>

          <div>
            <label>Asset ID</label>
            <input value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })} />
          </div>

          <div>
            <label>Asset ID Description</label>
            <input value={form.assetIdDescription} onChange={e => setForm({ ...form, assetIdDescription: e.target.value })} />
          </div>

          <div>
            <label>Owner</label>
            <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
          </div>

          <div>
            <label>Institution</label>
            <input value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} />
          </div>
        </div>

        <div className="card-actions">
          <button className="primary" onClick={addAsset}>Add Asset</button>
        </div>
      </div>

<div style={{ marginBottom: 12 }}>
  <button onClick={exportAssets}>Export Assets to Excel</button>
</div>
      
      {/* ASSET TABLE */}
      {assets.length > 0 && (
        <div className="table-scroll-wrapper">
          <table className="data-table wide-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Category</th>
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
                      <td>
                        <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                          {ASSET_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="date" value={formatDate(editForm.purchaseDate)} onChange={e => setEditForm({ ...editForm, purchaseDate: e.target.value ? new Date(e.target.value) : null })} /></td>
                      <td><input value={editForm.assetValue} onChange={e => setEditForm({ ...editForm, assetValue: e.target.value })} /></td>
                      <td><input type="date" value={formatDate(editForm.valueRecordDate)} onChange={e => setEditForm({ ...editForm, valueRecordDate: e.target.value ? new Date(e.target.value) : null })} /></td>
                      <td><input value={editForm.assetId} onChange={e => setEditForm({ ...editForm, assetId: e.target.value })} /></td>
                      <td><input value={editForm.assetIdDescription} onChange={e => setEditForm({ ...editForm, assetIdDescription: e.target.value })} /></td>
                      <td><input value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} /></td>
                      <td><input value={editForm.institution} onChange={e => setEditForm({ ...editForm, institution: e.target.value })} /></td>
                      <td className="actions">
                        <button onClick={saveEdit}>Save</button>
                        <button onClick={() => setEditIndex(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{a.assetName}</td>
                      <td>{a.category}</td>
                      <td>{formatDate(a.purchaseDate)}</td>
                      <td>₹{Number(a.assetValue).toLocaleString()}</td>
                      <td>{formatDate(a.valueRecordDate)}</td>
                      <td>{a.assetId}</td>
                      <td>{a.assetIdDescription}</td>
                      <td>{a.owner}</td>
                      <td>{a.institution}</td>
                      <td className="actions">
                        <button onClick={() => startEdit(i)}>Edit</button>
                        <button className="danger" onClick={() => deleteAsset(i)}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
