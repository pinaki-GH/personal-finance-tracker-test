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
const STALE_VALUATION_DAYS = 365;

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

  const date = new Date(value);

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
      purchaseDate: asset.purchaseDate
        ? asset.purchaseDate.toISOString()
        : null,
      valueRecordDate: asset.valueRecordDate
        ? asset.valueRecordDate.toISOString()
        : null
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
    <section>
      <h2>🏦 Assets</h2>

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
          <h3>Total Asset Value</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {formatCurrency(totalAssetValue)}
          </p>
          <small>Across all recorded assets</small>
        </div>

        <div className="card">
          <h3>Total Assets</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {assets.length}
          </p>
          <small>Recorded asset entries</small>
        </div>

        <div className="card">
          <h3>Asset Categories</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {totalCategories}
          </p>
          <small>Categories currently represented</small>
        </div>

        <div className="card">
          <h3>Valuation Updates</h3>
          <p
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: assetsNeedingValuation > 0 ? "#b45309" : "inherit"
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

        <div className="card-actions">
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
        <h3>Asset Register</h3>

        {assets.length > 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 12
              }}
            >
              <div>
                <label htmlFor="asset-search">Search Assets</label>
                <input
                  id="asset-search"
                  type="search"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Name, owner, institution, ID..."
                />
              </div>

              <div>
                <label htmlFor="asset-owner-filter">Filter by Owner</label>
                <select
                  id="asset-owner-filter"
                  value={ownerFilter}
                  onChange={e => setOwnerFilter(e.target.value)}
                >
                  <option value={ALL_FILTER}>All Owners</option>

                  {uniqueOwners.map(owner => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}

                  <option value={UNASSIGNED_FILTER}>
                    Unassigned
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="asset-category-filter">
                  Filter by Category
                </label>
                <select
                  id="asset-category-filter"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
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

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16
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
                  gap: 8
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

                        <td className="actions">
                          <button
                            className="primary"
                            onClick={saveEdit}
                          >
                            Save
                          </button>

                          <button onClick={cancelEdit}>
                            Cancel
                          </button>

                          {editError && (
                            <div
                              role="alert"
                              style={{
                                color: "#dc2626",
                                minWidth: 150,
                                marginTop: 8
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
