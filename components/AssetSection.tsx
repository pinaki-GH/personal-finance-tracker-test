"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [ownerFilter, setOwnerFilter] = useState<string>("All");

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

  // Unique owner list for dropdown
  const uniqueOwners = useMemo(() => {
    const owners = assets
      .map(a => a.owner)
      .filter(o => o && o.trim() !== "");
    return ["All", ...Array.from(new Set(owners))];
  }, [assets]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    if (ownerFilter === "All") return assets;
    return assets.filter(a => a.owner === ownerFilter);
  }, [assets, ownerFilter]);

  const addAsset = () => {
    if (!form.assetName || !form.assetValue || !form.category) return;
    persist([...assets, form]);
    setForm(emptyForm);
  };

  const startEdit = (filteredIndex: number) => {
    const originalIndex = assets.indexOf(filteredAssets[filteredIndex]);
    setEditIndex(originalIndex);
    setEditForm(assets[originalIndex]);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...assets];
    updated[editIndex] = editForm;
    persist(updated);
    setEditIndex(null);
  };

  const deleteAsset = (filteredIndex: number) => {
    const originalIndex = assets.indexOf(filteredAssets[filteredIndex]);
    persist(assets.filter((_, idx) => idx !== originalIndex));
  };

  const exportAssets = () => {
    exportToExcel(
      filteredAssets.map(a => ({
        "Asset Name": a.assetName,
        "Category": a.category,
        "Purchase Date": formatDate(a.purchaseDate),
        "Asset Value": a.assetValue,
        "Value Record Date": formatDate(a.valueRecordDate),
        "Asset ID": a.assetId,
        "Asset ID Description": a.assetIdDescription,
        "Owner": a.owner,
        "Institution": a.institution
      })),
      "assets"
    );
  };

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

      {/* FILTER + EXPORT BAR */}
      {assets.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "12px 0"
          }}
        >
          <div>
            <label style={{ marginRight: 8 }}>Filter by Owner:</label>
            <select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
            >
              {uniqueOwners.map(owner => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>

          <button onClick={exportAssets}>
            Export Assets to Excel
          </button>
        </div>
      )}

      {/* ASSET TABLE */}
      {filteredAssets.length > 0 && (
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
              {filteredAssets.map((a, i) => (
                <tr key={i}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
