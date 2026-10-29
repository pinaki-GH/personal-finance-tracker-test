/**
 * Phase 0 expense data contract and safe compatibility helpers.
 * This module is intentionally non-destructive: parsing/mapping never writes to
 * localStorage. Callers must explicitly save validated data after review.
 */

export const EXPENSES_STORAGE_KEY = "expenses";
export const EXPENSE_BUDGETS_STORAGE_KEY = "expenseBudgets";
export const EXPENSE_CATEGORIES_STORAGE_KEY = "expenseCategories";
export const RECURRING_SCHEDULES_STORAGE_KEY = "expenseRecurringSchedules";
export const EXPENSE_SCHEMA_VERSION = 1;

export type ExpenseTransaction = {
  id: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  description: string;
  categoryId: string;
  /** Kept for compatibility and human-readable historical reporting. */
  category: string;
  /** Positive finite amount in the application's base currency. */
  amount: number;
  owner?: string;
  paymentMethod?: string;
  merchant?: string;
  notes?: string;
  recurringScheduleId?: string;
  recurringOccurrenceKey?: string;
  createdAt: string;
  updatedAt: string;
  /** Legacy properties are retained rather than silently discarded. */
  legacyFields?: Record<string, unknown>;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyCategoryBudget = {
  id: string;
  month: string; // YYYY-MM
  categoryId: string;
  category: string;
  amount: number;
  updatedAt: string;
};

export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type RecurringStatus = "active" | "paused" | "ended";

export type RecurringExpenseSchedule = {
  id: string;
  description: string;
  categoryId: string;
  category: string;
  expectedAmount: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  nextDueDate: string;
  status: RecurringStatus;
  owner?: string;
  paymentMethod?: string;
  merchant?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyExpense = {
  description?: unknown;
  amount?: unknown;
  category?: unknown;
  owner?: unknown;
  expenseDate?: unknown;
  recurring?: unknown;
  [key: string]: unknown;
};

export type LegacyBudgetStore = Record<string, Record<string, unknown>>;

export type MigrationIssue = {
  index: number;
  message: string;
  original: unknown;
};

export type LegacyExpenseMappingResult = {
  transactions: ExpenseTransaction[];
  issues: MigrationIssue[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const LEGACY_KEYS = new Set([
  "description", "amount", "category", "owner", "expenseDate", "recurring"
]);

export const isValidMonthKey = (value: unknown): value is string =>
  typeof value === "string" && MONTH_RE.test(value);

export const isValidDateOnly = (value: unknown): boolean => {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** Build a local calendar date without converting through UTC. */
export const localDateToDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Convert a legacy stored date to YYYY-MM-DD. For ISO strings with a date
 * prefix, preserve that stored calendar prefix to avoid changing legacy dates
 * merely because the browser timezone differs. Invalid values return null.
 */
export const legacyDateToDateOnly = (value: unknown): string | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : localDateToDateOnly(value);
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  if (isValidDateOnly(trimmed)) return trimmed;
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (isoPrefix && isValidDateOnly(isoPrefix[1])) return isoPrefix[1];
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : localDateToDateOnly(parsed);
};

export const monthKeyFromDate = (date: string): string =>
  isValidDateOnly(date) ? date.slice(0, 7) : "";

export const getCurrentMonthKey = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

export const shiftMonthKey = (month: string, offset: number): string | null => {
  if (!isValidMonthKey(month) || !Number.isInteger(offset)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

export const parsePositiveAmount = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const amount = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const makeId = (prefix: string): string => {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${uuid}`;
};

/** Deterministic category ID for legacy names; does not merge the name values. */
export const legacyCategoryId = (category: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < category.length; i += 1) {
    hash ^= category.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `legacycat_${(hash >>> 0).toString(16)}`;
};

const asNonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Map legacy expenses in memory only. Invalid rows are reported and excluded
 * from the mapped view, but the caller's original stored array is untouched.
 */
export const mapLegacyExpenses = (input: unknown): LegacyExpenseMappingResult => {
  if (!Array.isArray(input)) {
    return {
      transactions: [],
      issues: [{ index: -1, message: "Expense storage is not an array; original data must be preserved for review.", original: input }],
    };
  }

  const transactions: ExpenseTransaction[] = [];
  const issues: MigrationIssue[] = [];
  const now = new Date().toISOString();

  input.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      issues.push({ index, message: "Record is not an object.", original: raw });
      return;
    }
    const legacy = raw as LegacyExpense;
    const description = asNonEmptyString(legacy.description);
    const category = asNonEmptyString(legacy.category);
    const amount = parsePositiveAmount(legacy.amount);
    const date = legacyDateToDateOnly(legacy.expenseDate);

    if (!description || !category || amount === null || !date) {
      const missing = [
        !description ? "description" : "",
        !category ? "category" : "",
        amount === null ? "positive finite amount" : "",
        !date ? "valid expense date" : "",
      ].filter(Boolean).join(", ");
      issues.push({ index, message: `Record needs review: missing or invalid ${missing}.`, original: raw });
      return;
    }

    const legacyFields = Object.fromEntries(
      Object.entries(legacy).filter(([key]) => !LEGACY_KEYS.has(key))
    );
    const owner = asNonEmptyString(legacy.owner);
    const recurring = legacy.recurring === "Monthly" ? "Monthly" : "None";

    transactions.push({
      id: makeId("expense"),
      date,
      description,
      categoryId: legacyCategoryId(category),
      category,
      amount,
      ...(owner ? { owner } : {}),
      createdAt: now,
      updatedAt: now,
      legacyFields: {
        ...legacyFields,
        legacyRecurring: recurring,
      },
    });
  });

  return { transactions, issues };
};

/** Convert a legacy YYYY-MM -> category name -> amount budget map in memory. */
export const mapLegacyBudgets = (input: unknown): {
  budgets: MonthlyCategoryBudget[];
  issues: MigrationIssue[];
} => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      budgets: [],
      issues: [{ index: -1, message: "Budget storage is not an object; original data must be preserved for review.", original: input }],
    };
  }

  const budgets: MonthlyCategoryBudget[] = [];
  const issues: MigrationIssue[] = [];
  const now = new Date().toISOString();
  Object.entries(input as Record<string, unknown>).forEach(([month, categoryMap], monthIndex) => {
    if (!isValidMonthKey(month) || !categoryMap || typeof categoryMap !== "object" || Array.isArray(categoryMap)) {
      issues.push({ index: monthIndex, message: `Invalid budget month or category map: ${month}.`, original: categoryMap });
      return;
    }
    Object.entries(categoryMap as Record<string, unknown>).forEach(([category, rawAmount], categoryIndex) => {
      const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
      if (!category.trim() || !Number.isFinite(amount) || amount < 0) {
        issues.push({ index: categoryIndex, message: `Invalid budget amount for ${month} / ${category}.`, original: rawAmount });
        return;
      }
      budgets.push({
        id: `budget_${month}_${legacyCategoryId(category)}`,
        month,
        categoryId: legacyCategoryId(category),
        category,
        amount,
        updatedAt: now,
      });
    });
  });
  return { budgets, issues };
};

export type CategoryBudgetActual = {
  category: string;
  categoryId: string;
  budget: number | null;
  actual: number;
  remaining: number | null;
  utilisationPercent: number | null;
  status: "no-budget" | "on-track" | "approaching" | "over-budget" | "zero-budget-spending";
};

/** Pure calculation helper. Scheduled expenses are excluded by design. */
export const calculateCategoryBudgetActuals = (
  month: string,
  transactions: ExpenseTransaction[],
  budgets: MonthlyCategoryBudget[],
  approachingThreshold = 75,
): CategoryBudgetActual[] => {
  if (!isValidMonthKey(month)) return [];

  const actuals = new Map<string, { categoryId: string; category: string; amount: number }>();
  transactions.forEach((expense) => {
    if (monthKeyFromDate(expense.date) !== month) return;
    const key = expense.categoryId || legacyCategoryId(expense.category);
    const current = actuals.get(key) ?? { categoryId: key, category: expense.category, amount: 0 };
    current.amount += expense.amount;
    actuals.set(key, current);
  });

  const budgetMap = new Map<string, MonthlyCategoryBudget>();
  budgets.filter((budget) => budget.month === month).forEach((budget) => {
    budgetMap.set(budget.categoryId || legacyCategoryId(budget.category), budget);
  });

  const keys = new Set([...Array.from(actuals.keys()), ...Array.from(budgetMap.keys())]);
  return Array.from(keys).map((key) => {
    const actualRow = actuals.get(key);
    const budgetRow = budgetMap.get(key);
    const category = actualRow?.category ?? budgetRow?.category ?? "Uncategorised";
    const budget = budgetRow ? budgetRow.amount : null;
    const actual = actualRow?.amount ?? 0;
    const remaining = budget === null ? null : budget - actual;
    const utilisationPercent = budget !== null && budget > 0 ? (actual / budget) * 100 : null;
    let status: CategoryBudgetActual["status"];
    if (budget === null) status = actual > 0 ? "no-budget" : "no-budget";
    else if (budget === 0 && actual > 0) status = "zero-budget-spending";
    else if (budget === 0) status = "on-track";
    else if (actual > budget) status = "over-budget";
    else if ((utilisationPercent ?? 0) >= approachingThreshold) status = "approaching";
    else status = "on-track";
    return {
      category,
      categoryId: key,
      budget,
      actual,
      remaining,
      utilisationPercent,
      status,
    };
  }).sort((a, b) => b.actual - a.actual || a.category.localeCompare(b.category));
};

export const calculateMonthlyTotals = (
  month: string,
  transactions: ExpenseTransaction[],
  budgets: MonthlyCategoryBudget[],
): { actual: number; budget: number | null; remaining: number | null; utilisationPercent: number | null } => {
  if (!isValidMonthKey(month)) return { actual: 0, budget: null, remaining: null, utilisationPercent: null };
  const actual = transactions.reduce((sum, expense) =>
    monthKeyFromDate(expense.date) === month ? sum + expense.amount : sum, 0);
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  if (monthBudgets.length === 0) return { actual, budget: null, remaining: null, utilisationPercent: null };
  const budget = monthBudgets.reduce((sum, item) => sum + item.amount, 0);
  return {
    actual,
    budget,
    remaining: budget - actual,
    utilisationPercent: budget > 0 ? (actual / budget) * 100 : null,
  };
};

/** Read JSON without swallowing parse errors or modifying the stored value. */
export const readStoredJsonSafely = <T,>(key: string):
  | { ok: true; exists: false; value: null }
  | { ok: true; exists: true; value: T }
  | { ok: false; reason: "unavailable" | "parse-error"; raw?: string; error?: unknown } => {
  if (typeof window === "undefined") return { ok: false, reason: "unavailable" };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { ok: true, exists: false, value: null };
    try {
      return { ok: true, exists: true, value: JSON.parse(raw) as T };
    } catch (error) {
      return { ok: false, reason: "parse-error", raw, error };
    }
  } catch (error) {
    return { ok: false, reason: "unavailable", error };
  }
};
