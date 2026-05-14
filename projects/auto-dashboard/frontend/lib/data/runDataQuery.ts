// Pure-JS data query engine. Runs entirely in the browser.
// Pipeline: filter -> group/aggregate -> calculation -> sort -> limit.
// Designed for small/medium CSVs. Larger datasets should move this to the
// backend or DuckDB-WASM later; the function signature can stay the same.

import type { DataQuery, DataQueryFilter } from "@/types/api";

export type QueryResultRow = Record<string, unknown>;
export const COUNT_FIELD = "__count";

export interface QueryResult {
  rows: QueryResultRow[];
  /** True when the query produced zero rows (e.g. all filtered out). */
  empty: boolean;
  /** The total before limit/sort, useful for "showing N of M" footers. */
  totalBeforeLimit: number;
}

export function runDataQuery(rows: Record<string, unknown>[], query: DataQuery | undefined | null): QueryResult {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!query) return { rows: safeRows, empty: safeRows.length === 0, totalBeforeLimit: safeRows.length };

  const filtered = applyFilters(safeRows, query.filters ?? []);

  let working: QueryResultRow[];
  const aggregation = query.aggregation && query.aggregation !== "none" ? query.aggregation : null;

  if (aggregation && query.x && query.y) {
    working = aggregate(filtered, query.x, query.y, query.group_by ?? null, aggregation);
  } else if (aggregation && query.x && !query.y && aggregation === "count") {
    working = aggregate(filtered, query.x, query.x, query.group_by ?? null, "count", COUNT_FIELD);
  } else {
    working = filtered.map((row) => ({ ...row }));
  }

  // Optional derived calculations.
  if (query.calculation === "percent_of_total" && query.y) {
    const total = working.reduce((acc, row) => acc + toNumber(row[query.y as string]), 0) || 1;
    working = working.map((row) => ({
      ...row,
      [query.y as string]: toNumber(row[query.y as string]) / total,
    }));
  }

  // Sort.
  const sortKey = query.y ?? query.x;
  if (sortKey && query.sort && query.sort !== "none") {
    const direction = query.sort === "asc" ? 1 : -1;
    working.sort((a, b) => compareValues(a[sortKey], b[sortKey]) * direction);
  } else if (query.x && (aggregation === null || query.x === query.x) && isLikelyDate(working[0]?.[query.x])) {
    // Default chronological sort when x looks like a date.
    working.sort((a, b) => compareValues(a[query.x as string], b[query.x as string]));
  }

  const totalBeforeLimit = working.length;
  if (typeof query.limit === "number" && query.limit > 0) {
    working = working.slice(0, query.limit);
  }

  return { rows: working, empty: working.length === 0, totalBeforeLimit };
}

function applyFilters(rows: Record<string, unknown>[], filters: DataQueryFilter[]): Record<string, unknown>[] {
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((filter) => testFilter(row, filter)));
}

function testFilter(row: Record<string, unknown>, filter: DataQueryFilter): boolean {
  const value = row[filter.field];
  switch (filter.op) {
    case "eq":
      return looseEqual(value, filter.value);
    case "neq":
      return !looseEqual(value, filter.value);
    case "in":
      return Array.isArray(filter.value) && filter.value.some((entry) => looseEqual(value, entry));
    case "not_in":
      return Array.isArray(filter.value) && !filter.value.some((entry) => looseEqual(value, entry));
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) return true;
      const [lo, hi] = filter.value;
      const numeric = toNumber(value);
      return numeric >= toNumber(lo) && numeric <= toNumber(hi);
    }
    case "gte":
      return toNumber(value) >= toNumber(filter.value);
    case "lte":
      return toNumber(value) <= toNumber(filter.value);
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(filter.value ?? "").toLowerCase());
    default:
      return true;
  }
}

function aggregate(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  groupKey: string | null,
  aggregation: string,
  outputKey: string = yKey,
): QueryResultRow[] {
  const groups = new Map<string, { x: unknown; group: unknown; values: number[]; rawCount: number }>();
  for (const row of rows) {
    const xValue = row[xKey];
    const groupValue = groupKey ? row[groupKey] : null;
    const key = `${normalizeKey(xValue)}::${normalizeKey(groupValue)}`;
    const numeric = toNumber(row[yKey]);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { x: xValue, group: groupValue, values: [], rawCount: 0 };
      groups.set(key, bucket);
    }
    if (Number.isFinite(numeric)) bucket.values.push(numeric);
    bucket.rawCount += 1;
  }

  const out: QueryResultRow[] = [];
  for (const bucket of groups.values()) {
    let aggregated: number;
    switch (aggregation) {
      case "sum":
        aggregated = bucket.values.reduce((a, b) => a + b, 0);
        break;
      case "avg":
      case "mean":
        aggregated = bucket.values.length ? bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length : 0;
        break;
      case "median": {
        if (!bucket.values.length) {
          aggregated = 0;
        } else {
          const sorted = [...bucket.values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          aggregated = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
        break;
      }
      case "min":
        aggregated = bucket.values.length ? Math.min(...bucket.values) : 0;
        break;
      case "max":
        aggregated = bucket.values.length ? Math.max(...bucket.values) : 0;
        break;
      case "count":
        aggregated = bucket.rawCount;
        break;
      case "unique_count":
        aggregated = new Set(bucket.values).size;
        break;
      default:
        aggregated = bucket.values.reduce((a, b) => a + b, 0);
    }
    const result: QueryResultRow = { [xKey]: bucket.x, [outputKey]: aggregated };
    if (groupKey) result[groupKey] = bucket.group;
    out.push(result);
  }
  return out;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]+/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return 0;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
  return String(a).localeCompare(String(b));
}

function normalizeKey(value: unknown): string {
  if (value == null) return "__null__";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isLikelyDate(value: unknown): boolean {
  if (!value) return false;
  if (value instanceof Date) return true;
  if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}/.test(value);
  return false;
}
