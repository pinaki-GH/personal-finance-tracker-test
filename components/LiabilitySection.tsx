"use client";

import { useEffect, useState } from "react";
import { getData, saveData } from "../utils/storage";

const LIABILITY_CATEGORIES = [
  "Secured Loan",
  "Unsecured Loan",
  "Credit Card / Revolving",
  "Informal / Personal",
  "Tax / Statutory",
  "Long-term Obligation",
  "Other"
];

type Liability = {
  liabilityName: string;
  category: string;
  commencementDate: Date | null;
  liabilityValue: string;
  valueRecordDate: Date | null;
  liabilityId: string;
  liabilityIdDescription: string;
  owner: string;
  institution: string;
};

type StoredLiability = Omit<Liability, "commencementDate" | "valueRecordDate"> & {
  commencementDate: string | null;
  valueRecordDate: string | null;
};

const emptyForm: Liability = {
  liabilityName: "",
  category: "",
  commencementDate: null,
  liabilityValue: "",
  valueRecordDate: null,
  liabilityId: "",
  liabilityIdDescription: "",
  owner: "",
  institution: ""
};

export default function LiabilitySection() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [form, setForm] = useState<Liability>(emptyForm);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Liability>(emptyForm);

  useEffect(() => {
    const stored: StoredLiability[] = getData("liabilities");
    setLiabilities(
      stored.map(l => ({
        ...l,
        commencementDate: l.commencementDate ? new Date(l.commencementDate) : null,
        valueRecordDate: l.valueRecordDate ? new Date(l.valueRecordDate) : null
      }))
    );
  }, []);

  const persist = (updated: Liability[]) => {
    const dehydrated: StoredLiability[] = updated.map(l => ({
      ...l,
      commencementDate: l.commencementDate?.toISOString() ?? null,
      valueRecordDate: l.valueRecordDate?.toISOString() ?? null
    }));
    setLiabilities(updated);
    saveData("liabilities", dehydrated);
  };

  const formatDate = (d: Date | null) =>
    d ? d.toISOString().split("T")[0] : "";

  const addLiability = () => {
    if (!form.liabilityName || !form.liabilityValue || !form.category) return;
    persist([...liabilities, form]);
    setForm(emptyForm);
  };

  const startEdit = (i: number) => {
    setEditIndex(i);
    setEditForm(liabilities[i]);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    const updated = [...liabilities];
    updated[editIndex] = editForm;
    persist(updated);
    setEditIndex(null);
  };

  const deleteLiability = (i: number) =>
    persist(liabilities.filter((_, idx) => idx !== i));

  return (
    <section>
      <h2>📉 Liabilities</h2>

      {/* ADD LIABILITY */}
      <div className="card">
        <h3>Add Liability</h3>

        <div className="form-grid">
          <div>
            <label>Liability Name</label>
            <input value={form.liabilityName} onChange={e => setForm({ ...form, liabilityName: e.target.value })} />
          </div>

          <div>
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">Select Category</option>
              {LIABILITY_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Date of Commencement</label>
            <input type="date" value={formatDate(form.commencementDate)} onChange={e => setForm({ ...form, commencementDate: e.target.value ? new Date(e.target.value) : null })} />
          </div>

          <div>
            <label>Liability Value</label>
            <input value={form.liabilityValue} onChange={e => setForm({ ...form, liabilityValue: e.target.value })} />
          </div>

          <div>
            <label>Date of Value Record</label>
            <input type="date" value={formatDate(form.valueRecordDate)} onChange={e => setForm({ ...form, valueRecordDate: e.target.value ? new Date(e.target.value) : null })} />
          </div>

          <div>
            <label>Liability ID</label>
            <input value={form.liabilityId} onChange={e => setForm({ ...form, liabilityId: e.target.value })} />
          </div>

          <div>
            <label>Liability ID Description</label>
            <input value={form.liabilityIdDescription} onChange={e => setForm({ ...form, liabilityIdDescription: e.target.value })} />
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
          <button className="primary" onClick={addLiability}>Add Liability</button>
        </div>
      </div>

      {/* LIABILITY TABLE */}
      {liabilities.length > 0 && (
        <div className="table-scroll-wrapper">
          <table className="data-table wide-table">
            <thead>
              <tr>
                <th>Liability Name</th>
                <th>Category</th>
                <th>Commencement Date</th>
                <th>Liability Value</th>
                <th>Value Record Date</th>
                <th>Liability ID</th>
                <th>Liability ID Description</th>
                <th>Owner</th>
                <th>Institution</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {liabilities.map((l, i) => (
                <tr key={i}>
                  {editIndex === i ? (
                    <>
                      <td><input value={editForm.liabilityName} onChange={e => setEditForm({ ...editForm, liabilityName: e.target.value })} /></td>
                      <td>
                        <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                          {LIABILITY_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="date" value={formatDate(editForm.commencementDate)} onChange={e => setEditForm({ ...editForm, commencementDate: e.target.value ? new Date(e.target.value) : null })} /></td>
                      <td><input value={editForm.liabilityValue} onChange={e => setEditForm({ ...editForm, liabilityValue: e.target.value })} /></td>
                      <td><input type="date" value={formatDate(editForm.valueRecordDate)} onChange={e => setEditForm({ ...editForm, valueRecordDate: e.target.value ? new Date(e.target.value) : null })} /></td>
                      <td><input value={editForm.liabilityId} onChange={e => setEditForm({ ...editForm, liabilityId: e.target.value })} /></td>
                      <td><input value={editForm.liabilityIdDescription} onChange={e => setEditForm({ ...editForm, liabilityIdDescription: e.target.value })} /></td>
                      <td><input value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} /></td>
                      <td><input value={editForm.institution} onChange={e => setEditForm({ ...editForm, institution: e.target.value })} /></td>
                      <td className="actions">
                        <button onClick={saveEdit}>Save</button>
                        <button onClick={() => setEditIndex(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{l.liabilityName}</td>
                      <td>{l.category}</td>
                      <td>{formatDate(l.commencementDate)}</td>
                      <td>₹{Number(l.liabilityValue).toLocaleString()}</td>
                      <td>{formatDate(l.valueRecordDate)}</td>
                      <td>{l.liabilityId}</td>
                      <td>{l.liabilityIdDescription}</td>
                      <td>{l.owner}</td>
                      <td>{l.institution}</td>
                      <td className="actions">
                        <button onClick={() => startEdit(i)}>Edit</button>
                        <button className="danger" onClick={() => deleteLiability(i)}>Delete</button>
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
