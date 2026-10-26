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
    <section className="liability-section">
      <h2>📉 Liabilities</h2>

      <p className="section-description">
        Track outstanding balances, review liability categories, and keep
        valuation records up to date. Outstanding balances are used when
        calculating your net worth.
      </p>

      {/* SUMMARY CARDS */}

      <div className="summary-grid liability-summary-grid">
        <div className="card summary-card">
          <span className="summary-label">Total Outstanding Liabilities</span>
          <strong className="summary-value">
            {formatCurrency(totalLiabilityValue)}
          </strong>
          <span className="summary-description">
            Across all recorded liabilities
          </span>
        </div>

        <div className="card summary-card">
          <span className="summary-label">Number of Liabilities</span>
          <strong className="summary-value">{liabilities.length}</strong>
          <span className="summary-description">
            Total recorded obligations
          </span>
        </div>

        <div className="card summary-card">
          <span className="summary-label">Liability Categories</span>
          <strong className="summary-value">{totalCategories}</strong>
          <span className="summary-description">
            Categories currently in use
          </span>
        </div>

        <div className="card summary-card">
          <span className="summary-label">Valuations Needing Attention</span>
          <strong className="summary-value">
            {liabilitiesNeedingValuation}
          </strong>
          <span className="summary-description">
            Missing, future-dated, or older than 90 days
          </span>
        </div>
      </div>

      {/* CATEGORY ALLOCATION */}

      {categoryAllocation.length > 0 && (
        <div className="card liability-allocation-card">
          <h3>Outstanding Liabilities by Category</h3>

          <p className="section-description">
            Allocation is based on all liabilities, not the current search
            results or filters.
          </p>

          <div className="category-allocation-list">
            {categoryAllocation.map(item => (
              <div className="category-allocation-item" key={item.category}>
                <div className="category-allocation-heading">
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
                  role="progressbar"
                  aria-label={`${item.category} share of outstanding liabilities`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(item.percentage.toFixed(1))}
                >
                  <div
                    className="category-allocation-bar"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.percentage))}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD LIABILITY FORM */}

      <div className="card liability-form-card">
        <h3>Add Liability</h3>

        <p className="section-description">
          Enter the current outstanding balance. Optional identification and
          ownership details can be added for reference.
        </p>

        {formError && (
          <div className="form-error" role="alert">
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

      <div className="card liability-register-card">
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

        <div className="liability-filter-bar">
          <div className="filter-field search-filter">
            <label htmlFor="liability-search">Search</label>
            <input
              id="liability-search"
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Name, owner, institution, ID..."
            />
          </div>

          <div className="filter-field">
            <label htmlFor="liability-owner-filter">Owner</label>
            <select
              id="liability-owner-filter"
              value={ownerFilter}
              onChange={event => setOwnerFilter(event.target.value)}
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
            <label htmlFor="liability-category-filter">Category</label>
            <select
              id="liability-category-filter"
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
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
          <div className="form-error edit-form-error" role="alert">
            {editError}
          </div>
        )}
      </div>

      {/* COMPONENT-SCOPED STYLES */}

      <style jsx>{`
        .liability-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .section-description {
          margin: 6px 0 12px;
          line-height: 1.5;
          opacity: 0.8;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          min-width: 0;
          padding: 18px;
        }

        .summary-label {
          font-size: 0.9rem;
          line-height: 1.4;
          opacity: 0.8;
        }

        .summary-value {
          font-size: clamp(1.15rem, 2vw, 1.65rem);
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .summary-description {
          font-size: 0.8rem;
          line-height: 1.4;
          opacity: 0.7;
        }

        .liability-form-card,
        .liability-allocation-card,
        .liability-register-card {
          min-width: 0;
          padding: 18px;
        }

        .liability-form-card h3,
        .liability-allocation-card h3,
        .liability-register-card h3 {
          margin-top: 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .form-grid > div,
        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .form-grid label,
        .filter-field label {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .form-grid input,
        .form-grid select,
        .filter-field input,
        .filter-field select,
        .liability-table input,
        .liability-table select {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          padding: 9px 10px;
          font: inherit;
        }

        .card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 16px;
        }

        .card-actions button,
        .action-buttons button {
          padding: 8px 12px;
          font: inherit;
          cursor: pointer;
        }

        .card-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .form-error {
          margin: 10px 0 14px;
          padding: 10px 12px;
          border: 1px solid #dc2626;
          border-radius: 6px;
          color: #b91c1c;
          background: rgba(220, 38, 38, 0.07);
        }

        .category-allocation-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .category-allocation-item {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .category-allocation-heading {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }

        .category-allocation-name {
          font-weight: 600;
        }

        .category-allocation-value {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .category-allocation-percentage {
          opacity: 0.7;
          font-size: 0.9em;
        }

        .category-allocation-track {
          width: 100%;
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(127, 127, 127, 0.2);
        }

        .category-allocation-bar {
          height: 100%;
          border-radius: inherit;
          background: var(--accent-color, #64748b);
          transition: width 180ms ease;
        }

        .register-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }

        .register-count {
          font-size: 0.9rem;
          opacity: 0.75;
          padding-top: 4px;
        }

        .liability-filter-bar {
          display: grid;
          grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(150px, 1fr)) auto;
          align-items: end;
          gap: 12px;
          margin: 16px 0;
        }

        .filter-actions {
          display: flex;
          align-items: end;
        }

        .filter-actions button {
          min-height: 38px;
          padding: 8px 12px;
          font: inherit;
          cursor: pointer;
          white-space: nowrap;
        }

        .liability-export-actions {
          margin: 12px 0 16px;
        }

        .table-scroll-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .liability-table {
          width: 100%;
          min-width: 1500px;
          border-collapse: collapse;
        }

        .liability-table th,
        .liability-table td {
          padding: 10px;
          vertical-align: middle;
          text-align: left;
        }

        .liability-table th {
          white-space: nowrap;
        }

        .liability-table td {
          overflow-wrap: anywhere;
        }

        .liability-table .numeric-cell {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .liability-table input,
        .liability-table select {
          min-width: 105px;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .valuation-status {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 0.78rem;
          line-height: 1.4;
          font-weight: 600;
          white-space: nowrap;
        }

        .valuation-current {
          color: #166534;
          background: #dcfce7;
        }

        .valuation-stale,
        .valuation-missing {
          color: #92400e;
          background: #fef3c7;
        }

        .valuation-future {
          color: #9f1239;
          background: #ffe4e6;
        }

        .empty-state {
          padding: 28px 16px;
          text-align: center;
          border: 1px dashed rgba(127, 127, 127, 0.4);
          border-radius: 8px;
        }

        .empty-state h4 {
          margin: 0 0 8px;
        }

        .empty-state p {
          margin: 0;
          line-height: 1.5;
          opacity: 0.8;
        }

        .edit-form-error {
          margin-top: 16px;
        }

        @media (max-width: 1000px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .liability-filter-bar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filter-actions {
            align-items: stretch;
          }
        }

        @media (max-width: 600px) {
          .summary-grid,
          .form-grid,
          .liability-filter-bar {
            grid-template-columns: minmax(0, 1fr);
          }

          .liability-form-card,
          .liability-allocation-card,
          .liability-register-card {
            padding: 12px;
          }

          .summary-card {
            padding: 14px;
          }

          .category-allocation-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .category-allocation-value {
            text-align: left;
          }

          .register-heading {
            flex-direction: column;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .category-allocation-bar {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
