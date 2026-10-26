"use client";

import { useEffect, useMemo, useState } from "react";
import { getData, saveData } from "../utils/storage";
import { exportToExcel } from "../utils/exportToExcel";

const LIABILITY_CATEGORIES = [
  "Secured Loan",
  "Unsecured Loan",
  "Credit Card / Revolving",
  "Informal / Personal",
  "Tax / Statutory",
  "Long-term Obligation",
  "Other"
];

const ALL_FILTER = "All";
const UNASSIGNED_FILTER = "__UNASSIGNED__";
const STALE_VALUATION_DAYS = 90;

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

type StoredLiability = Omit<
  Liability,
  "commencementDate" | "valueRecordDate"
> & {
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

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  // Parse date-only values as local dates to avoid timezone shifts.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      )
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function hydrateLiability(
  liability: Partial<StoredLiability>
): Liability {
  return {
    liabilityName: liability.liabilityName ?? "",
    category: liability.category ?? "",
    commencementDate: parseDate(liability.commencementDate),
    liabilityValue:
      liability.liabilityValue == null
        ? ""
        : String(liability.liabilityValue),
    valueRecordDate: parseDate(liability.valueRecordDate),
    liabilityId: liability.liabilityId ?? "",
    liabilityIdDescription: liability.liabilityIdDescription ?? "",
    owner: liability.owner ?? "",
    institution: liability.institution ?? ""
  };
}

function validateLiability(liability: Liability): string | null {
  if (!liability.liabilityName.trim()) {
    return "Please enter a liability name.";
  }

  if (!liability.category) {
    return "Please select a liability category.";
  }

  if (
    liability.liabilityValue.trim() === "" ||
    !Number.isFinite(Number(liability.liabilityValue)) ||
    Number(liability.liabilityValue) < 0
  ) {
    return "Please enter a valid, non-negative outstanding liability value.";
  }

  return null;
}

function getValuationAge(date: Date | null): number | null {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const valuationDate = new Date(date);
  valuationDate.setHours(0, 0, 0, 0);

  return Math.floor(
    (today.getTime() - valuationDate.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function needsValuationUpdate(liability: Liability): boolean {
  const age = getValuationAge(liability.valueRecordDate);

  return age === null || age < 0 || age > STALE_VALUATION_DAYS;
}

function getValuationStatus(
  date: Date | null
): { label: string; className: string; description: string } {
  const age = getValuationAge(date);

  if (age === null) {
    return {
      label: "Missing date",
      className: "valuation-status valuation-missing",
      description: "No valuation record date has been provided."
    };
  }

  if (age < 0) {
    return {
      label: "Future dated",
      className: "valuation-status valuation-future",
      description: "The valuation record date is in the future."
    };
  }

  if (age > STALE_VALUATION_DAYS) {
    return {
      label: "Outdated",
      className: "valuation-status valuation-stale",
      description: `The valuation is ${age} days old. Update it if necessary.`
    };
  }

  return {
    label: "Up to date",
    className: "valuation-status valuation-current",
    description:
      age === 0
        ? "Valuation recorded today."
        : `Valuation recorded ${age} days ago.`
  };
}

function getDateInputValue(date: Date | null): string {
  return formatDate(date);
}

function toStoredLiability(liability: Liability): StoredLiability {
  return {
    ...liability,
    commencementDate: liability.commencementDate
      ? liability.commencementDate.toISOString()
      : null,
    valueRecordDate: liability.valueRecordDate
      ? liability.valueRecordDate.toISOString()
      : null
  };
}

function getLiabilityValue(liability: Liability): number {
  const value = Number(liability.liabilityValue);

  return Number.isFinite(value) ? value : 0;
}

export default function LiabilitySection() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [form, setForm] = useState<Liability>({ ...emptyForm });

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Liability>({ ...emptyForm });

  const [ownerFilter, setOwnerFilter] = useState(ALL_FILTER);
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER);
  const [searchTerm, setSearchTerm] = useState("");

  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  // ================= LOAD LIABILITIES =================

  useEffect(() => {
    const stored = (getData("liabilities") || []) as Partial<StoredLiability>[];

    setLiabilities(stored.map(hydrateLiability));
  }, []);

  // ================= PERSIST LIABILITIES =================

  const persist = (updated: Liability[]) => {
    const dehydrated = updated.map(toStoredLiability);

    saveData("liabilities", dehydrated);
    setLiabilities(updated);

    // Notify other components, including NetWorthSummary, that data changed.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("finance-updated"));
    }
  };

  // ================= SUMMARY =================
  // Summary values always represent ALL liabilities, regardless of filters.

  const totalLiabilityValue = useMemo(
    () =>
      liabilities.reduce(
        (total, liability) => total + getLiabilityValue(liability),
        0
      ),
    [liabilities]
  );

  const totalCategories = useMemo(
    () =>
      new Set(
        liabilities
          .map(liability => liability.category.trim())
          .filter(Boolean)
      ).size,
    [liabilities]
  );

  const liabilitiesNeedingValuation = useMemo(
    () => liabilities.filter(needsValuationUpdate).length,
    [liabilities]
  );

  // ================= CATEGORY ALLOCATION =================

  const categoryAllocation = useMemo(() => {
    const totals = new Map<string, number>();

    liabilities.forEach(liability => {
      const category = liability.category.trim() || "Uncategorised";
      const value = getLiabilityValue(liability);

      totals.set(
        category,
        (totals.get(category) ?? 0) + (value > 0 ? value : 0)
      );
    });

    return Array.from(totals.entries())
      .map(([category, value]) => ({
        category,
        value,
        percentage:
          totalLiabilityValue > 0
            ? (value / totalLiabilityValue) * 100
            : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [liabilities, totalLiabilityValue]);

  // ================= FILTER OPTIONS =================

  const uniqueOwners = useMemo(() => {
    const owners = liabilities
      .map(liability => liability.owner.trim())
      .filter(Boolean);

    return Array.from(new Set(owners)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [liabilities]);

  const uniqueCategories = useMemo(() => {
    const categories = liabilities
      .map(liability => liability.category.trim())
      .filter(Boolean);

    return Array.from(new Set(categories)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [liabilities]);

  // ================= FILTERED LIABILITIES =================

  const filteredLiabilities = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return liabilities.filter(liability => {
      const matchesOwner =
        ownerFilter === ALL_FILTER
          ? true
          : ownerFilter === UNASSIGNED_FILTER
            ? !liability.owner.trim()
            : liability.owner.trim() === ownerFilter;

      const matchesCategory =
        categoryFilter === ALL_FILTER
          ? true
          : liability.category === categoryFilter;

      const searchableFields = [
        liability.liabilityName,
        liability.category,
        liability.owner,
        liability.institution,
        liability.liabilityId,
        liability.liabilityIdDescription
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableFields.some(field =>
          field.toLowerCase().includes(normalizedSearch)
        );

      return matchesOwner && matchesCategory && matchesSearch;
    });
  }, [liabilities, ownerFilter, categoryFilter, searchTerm]);

  // ================= FORM HANDLERS =================

  const updateFormField = <K extends keyof Liability>(
    field: K,
    value: Liability[K]
  ) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setFormError("");
  };

  const updateEditField = <K extends keyof Liability>(
    field: K,
    value: Liability[K]
  ) => {
    setEditForm(previous => ({ ...previous, [field]: value }));
    setEditError("");
  };

  // ================= ADD LIABILITY =================

  const addLiability = () => {
    const error = validateLiability(form);

    if (error) {
      setFormError(error);
      return;
    }

    const cleanedLiability: Liability = {
      ...form,
      liabilityName: form.liabilityName.trim(),
      category: form.category.trim(),
      liabilityValue: String(Number(form.liabilityValue)),
      liabilityId: form.liabilityId.trim(),
      liabilityIdDescription: form.liabilityIdDescription.trim(),
      owner: form.owner.trim(),
      institution: form.institution.trim()
    };

    persist([...liabilities, cleanedLiability]);

    setForm({ ...emptyForm });
    setFormError("");
  };

  const clearForm = () => {
    setForm({ ...emptyForm });
    setFormError("");
  };

  // ================= EDIT LIABILITY =================

  const startEdit = (originalIndex: number) => {
    setEditIndex(originalIndex);
    setEditForm({ ...liabilities[originalIndex] });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditForm({ ...emptyForm });
    setEditError("");
  };

  const saveEdit = () => {
    if (editIndex === null) {
      return;
    }

    const error = validateLiability(editForm);

    if (error) {
      setEditError(error);
      return;
    }

    const updated = [...liabilities];

    updated[editIndex] = {
      ...editForm,
      liabilityName: editForm.liabilityName.trim(),
      category: editForm.category.trim(),
      liabilityValue: String(Number(editForm.liabilityValue)),
      liabilityId: editForm.liabilityId.trim(),
      liabilityIdDescription: editForm.liabilityIdDescription.trim(),
      owner: editForm.owner.trim(),
      institution: editForm.institution.trim()
    };

    persist(updated);
    cancelEdit();
  };

  // ================= DELETE LIABILITY =================

  const deleteLiability = (originalIndex: number) => {
    const liability = liabilities[originalIndex];

    if (!liability) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${liability.liabilityName}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    persist(
      liabilities.filter((_, index) => index !== originalIndex)
    );

    if (editIndex === originalIndex) {
      cancelEdit();
    } else if (editIndex !== null && editIndex > originalIndex) {
      setEditIndex(editIndex - 1);
    }
  };

  // ================= EXCEL EXPORT =================

  const exportLiabilities = (records: Liability[], fileName: string) => {
    const exportData = records.map(liability => ({
      "Liability Name": liability.liabilityName,
      Category: liability.category,
      "Date of Commencement": formatDate(liability.commencementDate) || "—",
      "Outstanding Liability (INR)": getLiabilityValue(liability),
      "Date of Value Record": formatDate(liability.valueRecordDate) || "—",
      "Valuation Status": getValuationStatus(liability.valueRecordDate).label,
      "Liability ID": liability.liabilityId,
      "Liability ID Description": liability.liabilityIdDescription,
      Owner: liability.owner,
      Institution: liability.institution
    }));

    exportToExcel(exportData, fileName);
  };

  const exportAll = () => {
    if (liabilities.length === 0) {
      window.alert("There are no liabilities to export.");
      return;
    }

    exportLiabilities(liabilities, "all_liabilities");
  };

  const exportFiltered = () => {
    if (filteredLiabilities.length === 0) {
      window.alert("There are no filtered liabilities to export.");
      return;
    }

    exportLiabilities(filteredLiabilities, "filtered_liabilities");
  };

  // ================= RENDER =================

  return (
    <section>
      <h2>📉 Liabilities</h2>

      <p className="section-description">
        Track outstanding balances, review liability categories, and keep
        valuation records up to date. Outstanding balances are used when
        calculating your net worth.
      </p>

      {/* SUMMARY CARDS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24
        }}
      >
        <div className="card">
          <h3>Total Outstanding Liabilities</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{formatCurrency(totalLiabilityValue)}</p>
          <small>Across all recorded liabilities</small>
        </div>

        <div className="card">
          <h3>Total Liabilities</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{liabilities.length}</p>
          <small>Recorded liability entries</small>
        </div>

        <div className="card">
          <h3>Liability Categories</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{totalCategories}</p>
          <small>Categories currently represented</small>
        </div>

        <div className="card">
          <h3>Valuation Updates</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0, color: liabilitiesNeedingValuation > 0 ? "#b45309" : "inherit" }}>{liabilitiesNeedingValuation}</p>
          <small>Missing, future-dated, or older than {STALE_VALUATION_DAYS} days</small>
        </div>
      </div>

      {/* CATEGORY ALLOCATION */}

      {categoryAllocation.length > 0 && (
        <div className="card" style={{ marginBottom: 24, minWidth: 0 }}>
          <h3 style={{ marginTop: 0 }}>Category Allocation</h3>

          <p style={{ marginTop: -4, marginBottom: 16, opacity: 0.8 }}>
            Outstanding liability distribution by category. This includes all liabilities, regardless of active filters.
          </p>

          <div className="category-allocation-list" style={{ display: "grid", gap: 16 }}>
            {categoryAllocation.map(item => (
              <div className="category-allocation-item" key={item.category}>
                <div className="category-allocation-heading" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className="category-allocation-name">
                    {item.category}
                  </span>

                  <span className="category-allocation-value">
                    {formatCurrency(item.value)}
                    <span className="category-allocation-percentage">
                      {" "}
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </span>
                </div>

                <div
                  className="category-allocation-track"
                  style={{ width: "100%", height: 9, overflow: "hidden", borderRadius: 999, background: "#e5e7eb" }}
                  role="progressbar"
                  aria-label={`${item.category} share of outstanding liabilities`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(item.percentage.toFixed(1))}
                >
                  <div
                    className="category-allocation-bar"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "#64748b",
                      transition: "width 180ms ease"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD LIABILITY FORM */}

      <div className="card">
        <h3>Add Liability</h3>

        <p className="section-description">
          Enter the current outstanding balance. Optional identification and
          ownership details can be added for reference.
        </p>

        {formError && (
          <div className="form-error" role="alert" style={{ color: "#dc2626", marginTop: 12 }}>
            {formError}
          </div>
        )}

        <div className="form-grid">
          <div>
            <label htmlFor="liability-name">
              Liability Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="liability-name"
              type="text"
              value={form.liabilityName}
              onChange={event =>
                updateFormField("liabilityName", event.target.value)
              }
              placeholder="e.g. Home Loan"
              required
            />
          </div>

          <div>
            <label htmlFor="liability-category">
              Category <span aria-hidden="true">*</span>
            </label>
            <select
              id="liability-category"
              value={form.category}
              onChange={event =>
                updateFormField("category", event.target.value)
              }
              required
            >
              <option value="">Select Category</option>
              {LIABILITY_CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="liability-value">
              Outstanding Value (INR) <span aria-hidden="true">*</span>
            </label>
            <input
              id="liability-value"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.liabilityValue}
              onChange={event =>
                updateFormField("liabilityValue", event.target.value)
              }
              placeholder="e.g. 1250000"
              required
            />
          </div>

          <div>
            <label htmlFor="liability-commencement-date">
              Date of Commencement
            </label>
            <input
              id="liability-commencement-date"
              type="date"
              value={getDateInputValue(form.commencementDate)}
              onChange={event =>
                updateFormField(
                  "commencementDate",
                  event.target.value ? parseDate(event.target.value) : null
                )
              }
            />
          </div>

          <div>
            <label htmlFor="liability-value-date">Date of Value Record</label>
            <input
              id="liability-value-date"
              type="date"
              value={getDateInputValue(form.valueRecordDate)}
              onChange={event =>
                updateFormField(
                  "valueRecordDate",
                  event.target.value ? parseDate(event.target.value) : null
                )
              }
            />
          </div>

          <div>
            <label htmlFor="liability-owner">Owner</label>
            <input
              id="liability-owner"
              type="text"
              value={form.owner}
              onChange={event =>
                updateFormField("owner", event.target.value)
              }
              placeholder="e.g. Self"
            />
          </div>

          <div>
            <label htmlFor="liability-institution">Institution</label>
            <input
              id="liability-institution"
              type="text"
              value={form.institution}
              onChange={event =>
                updateFormField("institution", event.target.value)
              }
              placeholder="e.g. Bank or lender"
            />
          </div>

          <div>
            <label htmlFor="liability-id">Liability ID</label>
            <input
              id="liability-id"
              type="text"
              value={form.liabilityId}
              onChange={event =>
                updateFormField("liabilityId", event.target.value)
              }
              placeholder="Optional reference"
            />
          </div>

          <div>
            <label htmlFor="liability-id-description">
              Liability ID Description
            </label>
            <input
              id="liability-id-description"
              type="text"
              value={form.liabilityIdDescription}
              onChange={event =>
                updateFormField("liabilityIdDescription", event.target.value)
              }
              placeholder="e.g. Loan account reference"
            />
          </div>
        </div>

        <div className="card-actions">
          <button className="primary" type="button" onClick={addLiability}>
            Add Liability
          </button>

          <button type="button" onClick={clearForm}>
            Clear Form
          </button>
        </div>
      </div>

      {/* LIABILITY REGISTER */}

      <div style={{ marginTop: 24 }}>
        <div className="register-heading">
          <div>
            <h3>Liability Register</h3>
            <p className="section-description">
              Search, filter, update, and export your recorded liabilities.
            </p>
          </div>

          <div className="register-count">
            Showing {filteredLiabilities.length} of {liabilities.length}
          </div>
        </div>

        {/* FILTERS */}

        <div
          className="liability-filter-bar"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: 20,
            marginBottom: 20,
            alignItems: "end"
          }}
        >
          <div className="filter-field search-filter">
            <label htmlFor="liability-search" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Search Liabilities</label>
            <input
              id="liability-search"
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Name, owner, institution, ID..."
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div className="filter-field">
            <label htmlFor="liability-owner-filter" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Filter by Owner</label>
            <select
              id="liability-owner-filter"
              value={ownerFilter}
              onChange={event => setOwnerFilter(event.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <option value={ALL_FILTER}>All Owners</option>

              {uniqueOwners.map(owner => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}

              {liabilities.some(liability => !liability.owner.trim()) && (
                <option value={UNASSIGNED_FILTER}>Unassigned</option>
              )}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="liability-category-filter" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Filter by Category</label>
            <select
              id="liability-category-filter"
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <option value={ALL_FILTER}>All Categories</option>

              {uniqueCategories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setOwnerFilter(ALL_FILTER);
                setCategoryFilter(ALL_FILTER);
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* EXPORT ACTIONS */}

        <div className="card-actions liability-export-actions">
          <button
            type="button"
            onClick={exportAll}
            disabled={liabilities.length === 0}
          >
            Export All to Excel
          </button>

          <button
            type="button"
            onClick={exportFiltered}
            disabled={filteredLiabilities.length === 0}
          >
            Export Filtered to Excel
          </button>
        </div>

        {/* TABLE */}

        {liabilities.length === 0 ? (
          <div className="empty-state">
            <h4>No liabilities recorded yet</h4>
            <p>
              Use the form above to add your first liability. Your outstanding
              balances will contribute to your net-worth calculation.
            </p>
          </div>
        ) : filteredLiabilities.length === 0 ? (
          <div className="empty-state">
            <h4>No matching liabilities</h4>
            <p>
              Try changing the search term or resetting the filters to see
              your other liabilities.
            </p>
          </div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="data-table wide-table liability-table">
              <thead>
                <tr>
                  <th>Liability Name</th>
                  <th>Category</th>
                  <th>Commencement Date</th>
                  <th className="numeric-cell">Outstanding Value</th>
                  <th>Value Record Date</th>
                  <th>Valuation Status</th>
                  <th>Liability ID</th>
                  <th>ID Description</th>
                  <th>Owner</th>
                  <th>Institution</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredLiabilities.map(liability => {
                  const originalIndex = liabilities.indexOf(liability);
                  const isEditing = editIndex === originalIndex;
                  const valuationStatus = getValuationStatus(
                    liability.valueRecordDate
                  );

                  return (
                    <tr key={`${liability.liabilityName}-${originalIndex}`}>
                      {isEditing ? (
                        <>
                          <td>
                            <input
                              aria-label="Liability name"
                              type="text"
                              value={editForm.liabilityName}
                              onChange={event =>
                                updateEditField(
                                  "liabilityName",
                                  event.target.value
                                )
                              }
                            />
                          </td>

                          <td>
                            <select
                              aria-label="Liability category"
                              value={editForm.category}
                              onChange={event =>
                                updateEditField("category", event.target.value)
                              }
                            >
                              <option value="">Select Category</option>
                              {LIABILITY_CATEGORIES.map(category => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              aria-label="Date of commencement"
                              type="date"
                              value={getDateInputValue(
                                editForm.commencementDate
                              )}
                              onChange={event =>
                                updateEditField(
                                  "commencementDate",
                                  event.target.value
                                    ? parseDate(event.target.value)
                                    : null
                                )
                              }
                            />
                          </td>

                          <td className="numeric-cell">
                            <input
                              aria-label="Outstanding liability value"
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              value={editForm.liabilityValue}
                              onChange={event =>
                                updateEditField(
                                  "liabilityValue",
                                  event.target.value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              aria-label="Date of value record"
                              type="date"
                              value={getDateInputValue(
                                editForm.valueRecordDate
                              )}
                              onChange={event =>
                                updateEditField(
                                  "valueRecordDate",
                                  event.target.value
                                    ? parseDate(event.target.value)
                                    : null
                                )
                              }
                            />
                          </td>

                          <td>
                            <span
                              className={
                                getValuationStatus(
                                  editForm.valueRecordDate
                                ).className
                              }
                            >
                              {
                                getValuationStatus(
                                  editForm.valueRecordDate
                                ).label
                              }
                            </span>
                          </td>

                          <td>
                            <input
                              aria-label="Liability ID"
                              type="text"
                              value={editForm.liabilityId}
                              onChange={event =>
                                updateEditField(
                                  "liabilityId",
                                  event.target.value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              aria-label="Liability ID description"
                              type="text"
                              value={editForm.liabilityIdDescription}
                              onChange={event =>
                                updateEditField(
                                  "liabilityIdDescription",
                                  event.target.value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              aria-label="Owner"
                              type="text"
                              value={editForm.owner}
                              onChange={event =>
                                updateEditField("owner", event.target.value)
                              }
                            />
                          </td>

                          <td>
                            <input
                              aria-label="Institution"
                              type="text"
                              value={editForm.institution}
                              onChange={event =>
                                updateEditField(
                                  "institution",
                                  event.target.value
                                )
                              }
                            />
                          </td>

                          <td className="actions">
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="primary"
                                onClick={saveEdit}
                              >
                                Save
                              </button>

                              <button type="button" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{liability.liabilityName || "—"}</td>

                          <td>{liability.category || "—"}</td>

                          <td>
                            {formatDate(liability.commencementDate) || "—"}
                          </td>

                          <td className="numeric-cell">
                            {liability.liabilityValue.trim() !== "" &&
                            Number.isFinite(
                              Number(liability.liabilityValue)
                            )
                              ? formatCurrency(
                                  getLiabilityValue(liability)
                                )
                              : "—"}
                          </td>

                          <td>
                            {formatDate(liability.valueRecordDate) || "—"}
                          </td>

                          <td>
                            <span
                              className={valuationStatus.className}
                              title={valuationStatus.description}
                            >
                              {valuationStatus.label}
                            </span>
                          </td>

                          <td>{liability.liabilityId || "—"}</td>

                          <td>{liability.liabilityIdDescription || "—"}</td>

                          <td>{liability.owner || "—"}</td>

                          <td>{liability.institution || "—"}</td>

                          <td className="actions">
                            <div className="action-buttons">
                              <button
                                type="button"
                                onClick={() => startEdit(originalIndex)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="danger"
                                onClick={() => deleteLiability(originalIndex)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editError && (
          <div className="form-error edit-form-error" role="alert" style={{ color: "#dc2626", marginTop: 12 }}>
            {editError}
          </div>
        )}
      </div>


    </section>
  );
}
