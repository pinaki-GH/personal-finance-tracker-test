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

const ALL_FILTER = "All";
const UNASSIGNED_FILTER = "__UNASSIGNED__";
const STALE_VALUATION_DAYS = 90;

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

type StoredAsset = Omit<
  Asset,
  "purchaseDate" | "valueRecordDate"
> & {
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

  // Parse date-only values as local calendar dates to avoid timezone shifts.
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

function hydrateAsset(asset: StoredAsset): Asset {
  return {
    ...asset,
    owner: asset.owner ?? "",
    institution: asset.institution ?? "",
    assetId: asset.assetId ?? "",
    assetIdDescription: asset.assetIdDescription ?? "",
    purchaseDate: parseDate(asset.purchaseDate),
    valueRecordDate: parseDate(asset.valueRecordDate)
  };
}

function validateAsset(asset: Asset): string | null {
  if (!asset.assetName.trim()) {
    return "Please enter an asset name.";
  }

  if (!asset.category) {
    return "Please select an asset category.";
  }

  if (
    asset.assetValue.trim() === "" ||
    !Number.isFinite(Number(asset.assetValue)) ||
    Number(asset.assetValue) < 0
  ) {
    return "Please enter a valid, non-negative asset value.";
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

function needsValuationUpdate(asset: Asset): boolean {
  const age = getValuationAge(asset.valueRecordDate);

  return age === null || age < 0 || age > STALE_VALUATION_DAYS;
}

export default function AssetSection() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<Asset>({ ...emptyForm });

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Asset>({ ...emptyForm });

  const [ownerFilter, setOwnerFilter] = useState(ALL_FILTER);
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER);
  const [searchTerm, setSearchTerm] = useState("");

  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  // ================= LOAD ASSETS =================

  useEffect(() => {
    const stored = (getData("assets") || []) as StoredAsset[];

    setAssets(stored.map(hydrateAsset));
  }, []);

  // ================= PERSIST ASSETS =================

  const persist = (updated: Asset[]) => {
    const dehydrated: StoredAsset[] = updated.map(asset => ({
      ...asset,
      // These are calendar dates, not timestamps. Store date-only values so
      // UTC conversion cannot shift the date when a monthly snapshot is taken.
      purchaseDate: asset.purchaseDate ? formatDate(asset.purchaseDate) : null,
      valueRecordDate: asset.valueRecordDate ? formatDate(asset.valueRecordDate) : null
    }));

    saveData("assets", dehydrated);
    setAssets(updated);
  };

  // ================= PORTFOLIO SUMMARY =================
  // Summary cards always represent ALL assets, not just filtered assets.

  const totalAssetValue = useMemo(
    () =>
      assets.reduce((total, asset) => {
        const value = Number(asset.assetValue);

        return total + (Number.isFinite(value) ? value : 0);
      }, 0),
    [assets]
  );

  const totalCategories = useMemo(
    () => new Set(assets.map(asset => asset.category).filter(Boolean)).size,
    [assets]
  );

  // ================= CATEGORY ALLOCATION =================
  // Allocation always reflects the complete portfolio, regardless of filters.
  const categoryAllocation = useMemo(() => {
    const totals = new Map<string, number>();

    assets.forEach(asset => {
      const category = asset.category.trim() || "Uncategorised";
      const value = Number(asset.assetValue);
      totals.set(
        category,
        (totals.get(category) ?? 0) +
          (Number.isFinite(value) && value > 0 ? value : 0)
      );
    });

    return Array.from(totals.entries())
      .map(([category, value]) => ({
        category,
        value,
        percentage: totalAssetValue > 0 ? (value / totalAssetValue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [assets, totalAssetValue]);

  const assetsNeedingValuation = useMemo(
    () => assets.filter(needsValuationUpdate).length,
    [assets]
  );

  // ================= FILTER OPTIONS =================

  const uniqueOwners = useMemo(() => {
    const owners = assets
      .map(asset => asset.owner.trim())
      .filter(Boolean);

    return Array.from(new Set(owners)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [assets]);

  const uniqueCategories = useMemo(() => {
    const categories = assets
      .map(asset => asset.category)
      .filter(Boolean);

    return Array.from(new Set(categories)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [assets]);

  // ================= FILTERED ASSETS =================

  const filteredAssets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return assets.filter(asset => {
      const matchesOwner =
        ownerFilter === ALL_FILTER
          ? true
          : ownerFilter === UNASSIGNED_FILTER
            ? !asset.owner.trim()
            : asset.owner.trim() === ownerFilter;

      const matchesCategory =
        categoryFilter === ALL_FILTER ||
        asset.category === categoryFilter;

      const searchableFields = [
        asset.assetName,
        asset.category,
        asset.owner,
        asset.institution,
        asset.assetId,
        asset.assetIdDescription
      ];

      const matchesSearch =
        !query ||
        searchableFields.some(value =>
          (value ?? "").toLowerCase().includes(query)
        );

      return matchesOwner && matchesCategory && matchesSearch;
    });
  }, [assets, ownerFilter, categoryFilter, searchTerm]);

  // ================= ADD ASSET =================

  const addAsset = () => {
    const error = validateAsset(form);

    if (error) {
      setFormError(error);
      return;
    }

    persist([
      ...assets,
      {
        ...form,
        assetName: form.assetName.trim(),
        owner: form.owner.trim(),
        institution: form.institution.trim(),
        assetId: form.assetId.trim(),
        assetIdDescription: form.assetIdDescription.trim()
      }
    ]);

    setForm({ ...emptyForm });
    setFormError("");
  };

  // ================= EDIT ASSET =================

  const startEdit = (originalIndex: number) => {
    setEditIndex(originalIndex);
    setEditForm({ ...assets[originalIndex] });
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

    const error = validateAsset(editForm);

    if (error) {
      setEditError(error);
      return;
    }

    const updated = [...assets];

    updated[editIndex] = {
      ...editForm,
      assetName: editForm.assetName.trim(),
      owner: editForm.owner.trim(),
      institution: editForm.institution.trim(),
      assetId: editForm.assetId.trim(),
      assetIdDescription: editForm.assetIdDescription.trim()
    };

    persist(updated);
    cancelEdit();
  };

  // ================= DELETE ASSET =================

  const deleteAsset = (originalIndex: number) => {
    const asset = assets[originalIndex];

    if (!asset) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${asset.assetName}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    persist(assets.filter((_, index) => index !== originalIndex));

    if (editIndex === originalIndex) {
      cancelEdit();
    } else if (editIndex !== null && editIndex > originalIndex) {
      setEditIndex(editIndex - 1);
    }
  };

  // ================= EXPORT =================

  const exportData = (data: Asset[], fileName: string) => {
    if (data.length === 0) {
      window.alert("There are no assets to export.");
      return;
    }

    exportToExcel(
      data.map(asset => ({
        "Asset Name": asset.assetName,
        "Category": asset.category,
        "Purchase Date": formatDate(asset.purchaseDate),
        "Asset Value": asset.assetValue,
        "Value Record Date": formatDate(asset.valueRecordDate),
        "Asset ID": asset.assetId,
        "Asset ID Description": asset.assetIdDescription,
        "Owner": asset.owner,
        "Institution": asset.institution
      })),
      fileName
    );
  };

  const exportAllAssets = () => {
    exportData(assets, "assets");
  };

  const exportFilteredAssets = () => {
    exportData(filteredAssets, "filtered-assets");
  };

  // ================= FORM FIELD HELPERS =================

  const updateForm = <K extends keyof Asset>(
    field: K,
    value: Asset[K]
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));

    setFormError("");
  };

  const updateEditForm = <K extends keyof Asset>(
    field: K,
    value: Asset[K]
  ) => {
    setEditForm(previous => ({
      ...previous,
      [field]: value
    }));

    setEditError("");
  };

  // ================= RENDER =================

  return (
    <section className="asset-section" style={{ color: "#172b4d", fontFamily: "inherit", display: "grid", gap: 18 }}>
      <style>{`
        .asset-section { min-width: 0; }
        .asset-section > h2 {
          margin: 5px 0 0;
          font-size: 28px;
          line-height: 1.2;
          letter-spacing: -.04em;
          color: #172b4d;
        }
        .asset-section .card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 18px rgba(20, 39, 60, .04);
          min-width: 0;
        }
        .asset-section h3 {
          color: #24364b;
          font-size: 16px;
          letter-spacing: -.02em;
        }
        .asset-section p, .asset-section small { color: #718096; }
        .asset-section label {
          display: block;
          margin-bottom: 7px;
          color: #52637a;
          font-size: 12px;
          font-weight: 700;
        }
        .asset-section input, .asset-section select {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #d9e2ec;
          border-radius: 10px;
          background: #fff;
          color: #172b4d;
          font: inherit;
          font-size: 14px;
        }
        .asset-section input:focus, .asset-section select:focus {
          outline: 2px solid rgba(23, 75, 59, .18);
          border-color: #5d8b78;
        }
        .asset-section button {
          border: 1px solid #d9e2ec;
          border-radius: 10px;
          padding: 10px 14px;
          background: #fff;
          color: #24364b;
          font-weight: 700;
          cursor: pointer;
          transition: background .15s ease, border-color .15s ease;
        }
        .asset-section button:hover { border-color: #b9c9d7; background: #f8fafc; }
        .asset-section button.primary {
          background: #174b3b;
          border-color: #174b3b;
          color: #fff;
        }
        .asset-section button.primary:hover { background: #103d30; }
        .asset-section button.danger { color: #a12a2a; }
        .asset-section .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
          gap: 14px;
        }
        .asset-section .data-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
          color: #52637a;
        }
        .asset-section .data-table th {
          text-align: left;
          font-size: 11px;
          letter-spacing: .06em;
          color: #718096;
          padding: 12px 10px;
          background: #f7f9fc !important;
          border-bottom: 1px solid #e8edf2;
        }
        .asset-section .data-table td {
          padding: 13px 10px;
          border-top: 1px solid #edf1f5;
          font-size: 13px;
          vertical-align: middle;
        }
        .asset-section .data-table tbody tr:hover { background: #fbfcfd; }
        .asset-section .table-scroll-wrapper {
          border: 1px solid #e8edf2;
          border-radius: 12px;
          background: #fff;
        }
        .asset-section .card-actions { margin-top: 18px !important; }
        @media (max-width: 600px) {
          .asset-section .card { padding: 14px; }
          .asset-section > h2 { font-size: 25px; }
        }
      `}</style>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#5d8b78", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>PERSONAL FINANCE</div>
          <h2>Asset Tracker</h2>
          <p style={{ margin: "5px 0 0", color: "#718096", fontSize: 14 }}>A clear view of what you own and how your portfolio is allocated.</p>
        </div>
      </header>

      {/* PORTFOLIO SUMMARY */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24
        }}
      >
        <div className="card">
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#718096" }}>TOTAL ASSET VALUE</div>
          <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.04em", margin: "9px 0 5px", color: "#174b3b", overflowWrap: "anywhere" }}>
            {formatCurrency(totalAssetValue)}
          </p>
          <small>Across all recorded assets</small>
        </div>

        <div className="card">
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#718096" }}>TOTAL ASSETS</div>
          <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.04em", margin: "9px 0 5px" }}>
            {assets.length}
          </p>
          <small>Recorded asset entries</small>
        </div>

        <div className="card">
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#718096" }}>ASSET CATEGORIES</div>
          <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.04em", margin: "9px 0 5px" }}>
            {totalCategories}
          </p>
          <small>Categories currently represented</small>
        </div>

        <div className="card">
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#718096" }}>VALUATION UPDATES</div>
          <p
            style={{
              fontSize: 23,
              fontWeight: 800,
              letterSpacing: "-.04em",
              margin: "9px 0 5px",
              color: assetsNeedingValuation > 0 ? "#b45309" : "#286348"
            }}
          >
            {assetsNeedingValuation}
          </p>
          <small>
            Missing, future-dated, or older than {STALE_VALUATION_DAYS} days
          </small>
        </div>
      </div>

      {/* CATEGORY ALLOCATION — Phase 2 */}
      <div className="card" style={{ marginBottom: 24, minWidth: 0 }}>
        <h3 style={{ marginTop: 0 }}>Category Allocation</h3>
        <p style={{ marginTop: -4, marginBottom: 16, opacity: 0.8 }}>
          Portfolio value distribution by asset category. This chart includes all assets, regardless of active filters.
        </p>

        {assets.length === 0 ? (
          <div
            role="status"
            style={{
              border: "1px dashed var(--border-color, #d1d5db)",
              borderRadius: 8,
              padding: "20px 16px",
              textAlign: "center"
            }}
          >
            <strong>No allocation data yet</strong>
            <p style={{ marginBottom: 0 }}>
              Add an asset to see how your portfolio is distributed across categories.
            </p>
          </div>
        ) : totalAssetValue <= 0 ? (
          <p role="status">
            Category percentages will appear once at least one asset has a value greater than zero.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {categoryAllocation.map(({ category, value, percentage }) => (
              <div key={category} style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: "4px 12px",
                    marginBottom: 6
                  }}
                >
                  <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                    {category}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(value)} · {percentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${category} allocation`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(percentage.toFixed(1))}
                  style={{
                    height: 10,
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: 999,
                    background: "var(--muted, #e5e7eb)"
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, percentage))}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "var(--primary, #2563eb)",
                      transition: "width 180ms ease"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD ASSET */}

      <div className="card">
        <h3>Add Asset</h3>

        <div className="form-grid">
          <div>
            <label htmlFor="asset-name">Asset Name *</label>
            <input
              id="asset-name"
              value={form.assetName}
              onChange={e => updateForm("assetName", e.target.value)}
              placeholder="e.g. Savings Account"
            />
          </div>

          <div>
            <label htmlFor="asset-category">Category *</label>
            <select
              id="asset-category"
              value={form.category}
              onChange={e => updateForm("category", e.target.value)}
            >
              <option value="">Select Category</option>
              {ASSET_CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="asset-purchase-date">Purchase Date</label>
            <input
              id="asset-purchase-date"
              type="date"
              value={formatDate(form.purchaseDate)}
              onChange={e =>
                updateForm(
                  "purchaseDate",
                  e.target.value ? parseDate(e.target.value) : null
                )
              }
            />
          </div>

          <div>
            <label htmlFor="asset-value">Asset Value (₹) *</label>
            <input
              id="asset-value"
              type="number"
              min="0"
              step="any"
              value={form.assetValue}
              onChange={e => updateForm("assetValue", e.target.value)}
              placeholder="Enter value"
            />
          </div>

          <div>
            <label htmlFor="asset-value-date">Value Record Date</label>
            <input
              id="asset-value-date"
              type="date"
              value={formatDate(form.valueRecordDate)}
              onChange={e =>
                updateForm(
                  "valueRecordDate",
                  e.target.value ? parseDate(e.target.value) : null
                )
              }
            />
          </div>

          <div>
            <label htmlFor="asset-id">Asset ID</label>
            <input
              id="asset-id"
              value={form.assetId}
              onChange={e => updateForm("assetId", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="asset-id-description">
              Asset ID Description
            </label>
            <input
              id="asset-id-description"
              value={form.assetIdDescription}
              onChange={e =>
                updateForm("assetIdDescription", e.target.value)
              }
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="asset-owner">Owner</label>
            <input
              id="asset-owner"
              value={form.owner}
              onChange={e => updateForm("owner", e.target.value)}
              placeholder="e.g. Self, Spouse"
            />
          </div>

          <div>
            <label htmlFor="asset-institution">Institution</label>
            <input
              id="asset-institution"
              value={form.institution}
              onChange={e => updateForm("institution", e.target.value)}
              placeholder="e.g. Bank or broker"
            />
          </div>
        </div>

        {formError && (
          <p role="alert" style={{ color: "#dc2626", marginTop: 12 }}>
            {formError}
          </p>
        )}

        <div
  className="card-actions"
  style={{
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20
  }}
>
  <button className="primary" onClick={addAsset}>
    Add Asset
  </button>

<button
type="button"
onClick={() => {
setForm({ ...emptyForm });
setFormError("");
}}
          >
            Clear Form
          </button>
        </div>
      </div>

      {/* ASSET REGISTER TOOLBAR */}

<div style={{ marginTop: 24 }}>
  <h3 style={{ marginBottom: 16 }}>Asset Register</h3>

  {assets.length > 0 && (
    <>
      {/* SEARCH AND FILTERS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 20,
          marginBottom: 20,
          alignItems: "end"
        }}
      >
        {/* SEARCH */}
        <div style={{ minWidth: 0 }}>
          <label
            htmlFor="asset-search"
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600
            }}
          >
            Search Assets
          </label>

          <input
            id="asset-search"
            type="search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Name, owner, institution, ID..."
            style={{
              width: "100%",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* OWNER FILTER */}
        <div style={{ minWidth: 0 }}>
          <label
            htmlFor="asset-owner-filter"
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600
            }}
          >
            Filter by Owner
          </label>

          <select
            id="asset-owner-filter"
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            <option value={ALL_FILTER}>All Owners</option>

            {uniqueOwners.map(owner => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}

            <option value={UNASSIGNED_FILTER}>Unassigned</option>
          </select>
        </div>

        {/* CATEGORY FILTER */}
        <div style={{ minWidth: 0 }}>
          <label
            htmlFor="asset-category-filter"
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600
            }}
          >
            Filter by Category
          </label>

          <select
            id="asset-category-filter"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            <option value={ALL_FILTER}>All Categories</option>

            {uniqueCategories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* RESULTS COUNT AND EXPORT BUTTONS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20
        }}
      >
        <span>
          Showing <strong>{filteredAssets.length}</strong> of{" "}
          <strong>{assets.length}</strong> assets
        </span>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10
          }}
        >
          <button onClick={exportFilteredAssets}>
            Export Filtered Assets
          </button>

          <button onClick={exportAllAssets}>
            Export All Assets
          </button>
        </div>
      </div>
    </>
  )}
</div>
      
      {/* ASSET TABLE */}

      {assets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(20px, 4vw, 32px)" }}>
          <h3>No Assets Yet</h3>
          <p>
            Add your first asset using the form above. Your saved assets will
            appear here.
          </p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(20px, 4vw, 32px)" }}>
          <h3>No Matching Assets</h3>
          <p>
            No assets match your current search and filters. Try changing the
            search term or selecting different filters.
          </p>

          <button
            onClick={() => {
              setSearchTerm("");
              setOwnerFilter(ALL_FILTER);
              setCategoryFilter(ALL_FILTER);
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div
          className="table-scroll-wrapper"
          role="region"
          aria-label="Asset register table; scroll horizontally to view all columns"
          tabIndex={0}
          style={{ width: "100%", maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}
        >
          <table className="data-table wide-table" style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Asset Name</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Category</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Purchase Date</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Asset Value</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Value Record Date</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Asset ID</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Asset ID Description</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Owner</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Institution</th>
                <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAssets.map(asset => {
                const originalIndex = assets.indexOf(asset);
                const isEditing = editIndex === originalIndex;

                return (
                  <tr key={originalIndex}>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            aria-label="Edit asset name"
                            value={editForm.assetName}
                            onChange={e =>
                              updateEditForm("assetName", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <select
                            aria-label="Edit asset category"
                            value={editForm.category}
                            onChange={e =>
                              updateEditForm("category", e.target.value)
                            }
                          >
                            <option value="">Select Category</option>
                            {ASSET_CATEGORIES.map(category => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <input
                            aria-label="Edit purchase date"
                            type="date"
                            value={formatDate(editForm.purchaseDate)}
                            onChange={e =>
                              updateEditForm(
                                "purchaseDate",
                                e.target.value
                                  ? parseDate(e.target.value)
                                  : null
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            aria-label="Edit asset value"
                            type="number"
                            min="0"
                            step="any"
                            value={editForm.assetValue}
                            onChange={e =>
                              updateEditForm("assetValue", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            aria-label="Edit value record date"
                            type="date"
                            value={formatDate(editForm.valueRecordDate)}
                            onChange={e =>
                              updateEditForm(
                                "valueRecordDate",
                                e.target.value
                                  ? parseDate(e.target.value)
                                  : null
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            aria-label="Edit asset ID"
                            value={editForm.assetId}
                            onChange={e =>
                              updateEditForm("assetId", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            aria-label="Edit asset ID description"
                            value={editForm.assetIdDescription}
                            onChange={e =>
                              updateEditForm(
                                "assetIdDescription",
                                e.target.value
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            aria-label="Edit owner"
                            value={editForm.owner}
                            onChange={e =>
                              updateEditForm("owner", e.target.value)
                            }
                          />
                        </td>

                        <td>
                          <input
                            aria-label="Edit institution"
                            value={editForm.institution}
                            onChange={e =>
                              updateEditForm("institution", e.target.value)
                            }
                          />
                        </td>

                        <td
                          className="actions"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8
                            }}
                          >
                            <button
                              className="primary"
                              onClick={saveEdit}
                            >
                              Save
                            </button>

                            <button onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>

                          {editError && (
                            <div
                              role="alert"
                              style={{
                                color: "#dc2626",
                                minWidth: 150,
                                marginTop: 8,
                                whiteSpace: "normal"
                              }}
                            >
                              {editError}
                            </div>
                          )}
                        </td>
                        </>
                    ) : (
                      <>
                        <td>{asset.assetName}</td>

                        <td>{asset.category}</td>

                        <td>{formatDate(asset.purchaseDate) || "—"}</td>

                        <td>
                          {formatCurrency(Number(asset.assetValue) || 0)}
                        </td>

                        <td>
                          <div>
                            {formatDate(asset.valueRecordDate) || "—"}
                          </div>

                          {needsValuationUpdate(asset) && (
                            <small
                              style={{
                                display: "block",
                                color: "#b45309",
                                marginTop: 4
                              }}
                            >
                              {asset.valueRecordDate
                                ? "Update recommended"
                                : "Date missing"}
                            </small>
                          )}
                        </td>

                        <td>{asset.assetId || "—"}</td>

                        <td>{asset.assetIdDescription || "—"}</td>

                        <td>{asset.owner || "Unassigned"}</td>

                        <td>{asset.institution || "—"}</td>

                        <td className="actions">
                          <button
                            onClick={() => startEdit(originalIndex)}
                          >
                            Edit
                          </button>

                          <button
                            className="danger"
                            onClick={() => deleteAsset(originalIndex)}
                          >
                            Delete
                          </button>
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
    </section>
  );
}
