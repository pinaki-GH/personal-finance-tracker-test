/**
 * Browser storage helpers for the Personal Finance Tracker.
 * Monthly snapshots are stored separately from the live assets/liabilities so
 * later edits to current records cannot mutate historical values.
 */

export const getData = <T = any>(key: string): T => {
  if (typeof window === "undefined") return null as unknown as T;

  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) as T : (null as unknown as T);
};

export const saveData = <T = any>(key: string, data: T): void => {
  if (typeof window === "undefined") return;

  localStorage.setItem(key, JSON.stringify(data));
};

export const MONTHLY_SNAPSHOTS_KEY = "monthlySnapshots";
export const MONTHLY_SNAPSHOT_SCHEMA_VERSION = 1;

export type MonthlySnapshot = {
  schemaVersion: number;
  month: string; // Calendar month in YYYY-MM format.
  savedAt: string; // ISO timestamp for when the snapshot was saved.
  assets: any[];
  liabilities: any[];
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  };
};

export type SaveMonthlySnapshotResult =
  | { ok: true; snapshot: MonthlySnapshot; replaced: boolean }
  | { ok: false; reason: "invalid-month" | "already-exists" | "storage-unavailable" | "storage-error"; message: string };

const isValidMonth = (month: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

const cloneJsonValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const toFiniteAmount = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string" || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Returns all saved monthly snapshots, ordered from oldest to newest. */
export const getMonthlySnapshots = (): MonthlySnapshot[] => {
  const stored = getData<MonthlySnapshot[] | null>(MONTHLY_SNAPSHOTS_KEY);
  if (!Array.isArray(stored)) return [];

  return stored
    .filter((snapshot): snapshot is MonthlySnapshot =>
      Boolean(snapshot && typeof snapshot.month === "string" && isValidMonth(snapshot.month))
    )
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month));
};

export const getMonthlySnapshot = (month: string): MonthlySnapshot | null => {
  if (!isValidMonth(month)) return null;
  return getMonthlySnapshots().find(snapshot => snapshot.month === month) ?? null;
};

/**
 * Captures the current asset and liability records for a calendar month.
 * Existing months are protected unless replaceExisting is explicitly true.
 * This function does not write to the live "assets" or "liabilities" keys.
 */
export const saveMonthlySnapshot = (
  month: string,
  options: { replaceExisting?: boolean } = {}
): SaveMonthlySnapshotResult => {
  if (!isValidMonth(month)) {
    return { ok: false, reason: "invalid-month", message: "Choose a valid month in YYYY-MM format." };
  }

  if (typeof window === "undefined") {
    return { ok: false, reason: "storage-unavailable", message: "Monthly snapshots can only be saved in the browser." };
  }

  try {
    const existingSnapshots = getMonthlySnapshots();
    const existingIndex = existingSnapshots.findIndex(snapshot => snapshot.month === month);

    if (existingIndex >= 0 && !options.replaceExisting) {
      return {
        ok: false,
        reason: "already-exists",
        message: `A snapshot for ${month} already exists. Confirm replacement before saving again.`
      };
    }

    const liveAssets = getData<any[]>("assets") ?? [];
    const liveLiabilities = getData<any[]>("liabilities") ?? [];
    if (!Array.isArray(liveAssets) || !Array.isArray(liveLiabilities)) {
      return { ok: false, reason: "storage-error", message: "Asset or liability data is not in the expected format." };
    }

    // JSON cloning creates a detached, serializable copy and prevents future
    // edits to the live records from changing this saved snapshot.
    const assets = cloneJsonValue(liveAssets);
    const liabilities = cloneJsonValue(liveLiabilities);
    const totalAssets = assets.reduce((sum, asset) => sum + toFiniteAmount(asset?.assetValue), 0);
    const totalLiabilities = liabilities.reduce((sum, liability) => sum + toFiniteAmount(liability?.liabilityValue), 0);

    const snapshot: MonthlySnapshot = {
      schemaVersion: MONTHLY_SNAPSHOT_SCHEMA_VERSION,
      month,
      savedAt: new Date().toISOString(),
      assets,
      liabilities,
      totals: {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities
      }
    };

    const nextSnapshots = existingSnapshots.filter(item => item.month !== month);
    nextSnapshots.push(snapshot);
    nextSnapshots.sort((a, b) => a.month.localeCompare(b.month));
    saveData(MONTHLY_SNAPSHOTS_KEY, nextSnapshots);

    return { ok: true, snapshot, replaced: existingIndex >= 0 };
  } catch {
    return {
      ok: false,
      reason: "storage-error",
      message: "The snapshot could not be saved. Your current asset and liability records were not intentionally changed. Check available browser storage and try again."
    };
  }
};

/** Deletes one saved snapshot. Call this only after an explicit user action. */
export const deleteMonthlySnapshot = (month: string): boolean => {
  if (typeof window === "undefined" || !isValidMonth(month)) return false;
  try {
    const snapshots = getMonthlySnapshots();
    const nextSnapshots = snapshots.filter(snapshot => snapshot.month !== month);
    if (nextSnapshots.length === snapshots.length) return false;
    saveData(MONTHLY_SNAPSHOTS_KEY, nextSnapshots);
    return true;
  } catch {
    return false;
  }
};

/** Downloads the snapshot history as a JSON backup file. */
export const exportMonthlySnapshotsBackup = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const backup = {
      backupType: "personal-finance-tracker-monthly-snapshots",
      schemaVersion: MONTHLY_SNAPSHOT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      snapshots: getMonthlySnapshots()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `monthly-finance-snapshots-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};
