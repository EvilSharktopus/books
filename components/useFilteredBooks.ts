"use client";

import { useEffect, useMemo, useState } from "react";
import { BookDoc } from "@/lib/books";

// ---------- Schema detection ----------
// Different users' forms carry different fields, so filterable fields are
// derived from the data itself rather than a hardcoded form definition.

export type FieldKind = "boolean" | "enum" | "numeric" | "text";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  get: (b: BookDoc) => string | number | boolean | null;
}

const CANDIDATE_FIELDS: FieldDef[] = [
  { key: "myRating", label: "Rating", kind: "numeric", get: (b) => (b.myRating > 0 ? b.myRating : null) },
  { key: "type", label: "Type", kind: "enum", get: (b) => b.type || null },
  { key: "language", label: "Language", kind: "enum", get: (b) => b.language || null },
  { key: "originalLanguage", label: "Original language", kind: "enum", get: (b) => b.originalLanguage || null },
  { key: "season", label: "Season", kind: "enum", get: (b) => b.season || null },
  { key: "source", label: "Where'd you hear about it", kind: "enum", get: (b) => b.source || null },
  { key: "authorCountry", label: "Author country", kind: "text", get: (b) => b.authorCountry || null },
  { key: "year", label: "Year", kind: "numeric", get: (b) => parseInt(b.year, 10) || null },
  { key: "pages", label: "Pages", kind: "numeric", get: (b) => parseInt(b.pages, 10) || null },
  { key: "cried", label: "Cried while reading", kind: "boolean", get: (b) => b.cried },
];

/** Fields that actually occur in this user's data. */
export function detectSchema(books: BookDoc[]): FieldDef[] {
  return CANDIDATE_FIELDS.filter((f) => {
    if (f.key === "myRating") return true; // rating always exists
    if (f.kind === "boolean") return books.some((b) => f.get(b) === true);
    return books.some((b) => f.get(b) != null);
  });
}

/** Distinct values for an enum/text field, sorted by frequency. */
export function fieldValues(books: BookDoc[], field: FieldDef): string[] {
  const counts = new Map<string, number>();
  for (const b of books) {
    const v = field.get(b);
    if (typeof v === "string" && v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

// ---------- Filter state ----------

export type CustomFilter =
  | { kind: "bool"; value: "yes" | "no" }
  | { kind: "values"; values: string[] }
  | { kind: "range"; min: number | null; max: number | null };

export interface FilterState {
  typeChip: "all" | "fiction" | "nonfiction";
  ratedEightPlus: boolean;
  custom: Record<string, CustomFilter>;
}

export const EMPTY_FILTERS: FilterState = {
  typeChip: "all",
  ratedEightPlus: false,
  custom: {},
};

export function countActiveCustom(f: FilterState): number {
  return Object.keys(f.custom).length;
}

export function hasAnyFilter(f: FilterState, search: string): boolean {
  return (
    f.typeChip !== "all" ||
    f.ratedEightPlus ||
    countActiveCustom(f) > 0 ||
    search.trim() !== ""
  );
}

// ---------- URL sync ----------

function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.typeChip !== "all") p.set("type", f.typeChip);
  if (f.ratedEightPlus) p.set("r8", "1");
  for (const [key, cf] of Object.entries(f.custom)) {
    if (cf.kind === "bool") p.set(`f_${key}`, cf.value);
    else if (cf.kind === "values") p.set(`f_${key}`, cf.values.join("|"));
    else p.set(`f_${key}`, `${cf.min ?? ""}..${cf.max ?? ""}`);
  }
  return p;
}

function filtersFromParams(p: URLSearchParams): FilterState {
  const f: FilterState = { ...EMPTY_FILTERS, custom: {} };
  const type = p.get("type");
  if (type === "fiction" || type === "nonfiction") f.typeChip = type;
  if (p.get("r8") === "1") f.ratedEightPlus = true;
  for (const [key, raw] of p.entries()) {
    if (!key.startsWith("f_")) continue;
    const fieldKey = key.slice(2);
    const def = CANDIDATE_FIELDS.find((d) => d.key === fieldKey);
    if (!def) continue;
    if (def.kind === "boolean") {
      if (raw === "yes" || raw === "no") f.custom[fieldKey] = { kind: "bool", value: raw };
    } else if (def.kind === "numeric") {
      const m = raw.match(/^(-?\d*)\.\.(-?\d*)$/);
      if (m) {
        f.custom[fieldKey] = {
          kind: "range",
          min: m[1] ? Number(m[1]) : null,
          max: m[2] ? Number(m[2]) : null,
        };
      }
    } else {
      const values = raw.split("|").filter(Boolean);
      if (values.length) f.custom[fieldKey] = { kind: "values", values };
    }
  }
  return f;
}

// ---------- Sorting ----------

export interface SortState {
  key: string; // field key, or "dateAdded" | "title" | "authors"
  dir: "asc" | "desc";
}

export const DEFAULT_SORT: SortState = { key: "dateAdded", dir: "desc" };

function sortValue(b: BookDoc, key: string): string | number | boolean | null {
  switch (key) {
    case "dateAdded":
      return b.dateAdded ? b.dateAdded.toMillis() : null;
    case "title":
      return b.title.toLowerCase();
    case "authors":
      return b.authors.toLowerCase();
    default: {
      const def = CANDIDATE_FIELDS.find((d) => d.key === key);
      return def ? def.get(b) : null;
    }
  }
}

function compareBooks(a: BookDoc, b: BookDoc, sort: SortState): number {
  const va = sortValue(a, sort.key);
  const vb = sortValue(b, sort.key);
  // Empty values always sort last, regardless of direction
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  let cmp: number;
  if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
  else if (typeof va === "boolean" && typeof vb === "boolean") cmp = Number(va) - Number(vb);
  else cmp = String(va).localeCompare(String(vb));
  return sort.dir === "asc" ? cmp : -cmp;
}

// ---------- The hook ----------

export function useFilteredBooks(books: BookDoc[] | null) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [filters, setFiltersRaw] = useState<FilterState>(EMPTY_FILTERS);

  // Restore filters from the URL once on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const restored = filtersFromParams(p);
    if (hasAnyFilter(restored, "")) setFiltersRaw(restored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync (without adding history entries)
  function setFilters(next: FilterState | ((prev: FilterState) => FilterState)) {
    setFiltersRaw((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      const p = filtersToParams(resolved);
      // Preserve unrelated params (e.g. ?wrapped=1)
      const existing = new URLSearchParams(window.location.search);
      for (const [k, v] of existing.entries()) {
        if (k !== "type" && k !== "r8" && !k.startsWith("f_")) p.set(k, v);
      }
      const qs = p.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
      return resolved;
    });
  }

  const schema = useMemo(() => detectSchema(books ?? []), [books]);

  const filtered = useMemo(() => {
    if (!books) return [];
    const q = search.trim().toLowerCase();
    const result = books.filter((b) => {
      if (q && !`${b.title}\n${b.authors}\n${b.notes}`.toLowerCase().includes(q)) return false;
      if (filters.typeChip === "fiction" && b.type !== "Fiction") return false;
      if (filters.typeChip === "nonfiction" && b.type !== "Non-Fiction") return false;
      if (filters.ratedEightPlus && b.myRating < 8) return false;
      for (const [key, cf] of Object.entries(filters.custom)) {
        const def = CANDIDATE_FIELDS.find((d) => d.key === key);
        if (!def) continue;
        const v = def.get(b);
        if (cf.kind === "bool") {
          if ((cf.value === "yes") !== (v === true)) return false;
        } else if (cf.kind === "values") {
          if (typeof v !== "string" || !cf.values.includes(v)) return false;
        } else {
          if (typeof v !== "number") return false; // missing values excluded
          if (cf.min != null && v < cf.min) return false;
          if (cf.max != null && v > cf.max) return false;
        }
      }
      return true;
    });
    return result.sort((a, b) => compareBooks(a, b, sort));
  }, [books, search, sort, filters]);

  return {
    search,
    setSearch,
    sort,
    setSort,
    filters,
    setFilters,
    schema,
    filtered,
    total: books?.length ?? 0,
  };
}
