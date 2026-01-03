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
