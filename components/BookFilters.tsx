"use client";

import { useMemo, useState } from "react";
import { BookDoc } from "@/lib/books";
import {
  CustomFilter,
  FieldDef,
  FilterState,
  countActiveCustom,
  fieldValues,
} from "./useFilteredBooks";

const CHIP =
  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap";
const CHIP_ON = "bg-blue-600 border-blue-600 text-white";
const CHIP_OFF = "bg-white border-gray-300 text-gray-600 hover:border-blue-400";

function summarizeFilter(def: FieldDef, cf: CustomFilter): string {
  if (cf.kind === "bool") return `${def.label}: ${cf.value === "yes" ? "Yes" : "No"}`;
  if (cf.kind === "values")
    return `${def.label}: ${cf.values.length > 2 ? `${cf.values.length} selected` : cf.values.join(", ")}`;
  const parts = [];
  if (cf.min != null) parts.push(`≥ ${cf.min}`);
  if (cf.max != null) parts.push(`≤ ${cf.max}`);
  return `${def.label}: ${parts.join(" and ")}`;
}

function MultiSelect({
  def,
  books,
  value,
  onChange,
}: {
  def: FieldDef;
  books: BookDoc[];
  value: string[];
  onChange: (values: string[]) => void;
}) {
  const options = useMemo(() => fieldValues(books, def), [books, def]);
  const [query, setQuery] = useState("");
  const shown = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;
  return (
    <div className="flex flex-col gap-1">
      {options.length > 15 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${def.label.toLowerCase()}…`}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs mb-1"
        />
      )}
      <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 pr-1">
        {shown.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(opt)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, opt] : value.filter((v) => v !== opt))
              }
            />
            <span className="truncate">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RangeControl({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: { min: number | null; max: number | null };
  onChange: (v: { min: number | null; max: number | null }) => void;
}) {
  if (def.key === "myRating") {
    const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    return (
      <div className="flex items-center gap-2 text-sm">
        <select
          value={value.min ?? ""}
          onChange={(e) => onChange({ ...value, min: e.target.value ? Number(e.target.value) : null })}
          className="border border-gray-300 rounded-lg px-2 py-1"
        >
          <option value="">Min</option>
          {opts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-gray-400">to</span>
        <select
          value={value.max ?? ""}
          onChange={(e) => onChange({ ...value, max: e.target.value ? Number(e.target.value) : null })}
          className="border border-gray-300 rounded-lg px-2 py-1"
        >
          <option value="">Max</option>
          {opts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="number"
        value={value.min ?? ""}
        onChange={(e) => onChange({ ...value, min: e.target.value ? Number(e.target.value) : null })}
        placeholder="Min"
        className="border border-gray-300 rounded-lg px-2 py-1 w-24"
      />
      <span className="text-gray-400">to</span>
      <input
        type="number"
        value={value.max ?? ""}
        onChange={(e) => onChange({ ...value, max: e.target.value ? Number(e.target.value) : null })}
        placeholder="Max"
        className="border border-gray-300 rounded-lg px-2 py-1 w-24"
      />
    </div>
  );
}

function FilterPanel({
  books,
  schema,
  initial,
  onApply,
  onClose,
}: {
  books: BookDoc[];
  schema: FieldDef[];
  initial: Record<string, CustomFilter>;
  onApply: (custom: Record<string, CustomFilter>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, CustomFilter>>(initial);

  function set(key: string, cf: CustomFilter | null) {
    setDraft((d) => {
      const next = { ...d };
      if (cf === null) delete next[key];
      else next[key] = cf;
      return next;
    });
  }

  // Prune no-op filters before applying
  function apply() {
    const cleaned: Record<string, CustomFilter> = {};
    for (const [k, cf] of Object.entries(draft)) {
      if (cf.kind === "values" && cf.values.length === 0) continue;
      if (cf.kind === "range" && cf.min == null && cf.max == null) continue;
      cleaned[k] = cf;
    }
    onApply(cleaned);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl border border-gray-200 max-h-[75vh] overflow-y-auto sm:absolute sm:bottom-auto sm:left-auto sm:right-auto sm:top-full sm:mt-2 sm:w-96 sm:rounded-xl">
        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm font-bold text-gray-800">Filters</p>
          {schema.map((def) => {
            const cf = draft[def.key];
            return (
              <div key={def.key} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {def.label}
                </span>
                {def.kind === "boolean" ? (
                  <div className="flex gap-2">
                    {(["any", "yes", "no"] as const).map((opt) => {
                      const selected =
                        opt === "any" ? !cf : cf?.kind === "bool" && cf.value === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            set(def.key, opt === "any" ? null : { kind: "bool", value: opt })
                          }
                          className={`${CHIP} ${selected ? CHIP_ON : CHIP_OFF} capitalize`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : def.kind === "numeric" ? (
                  <RangeControl
                    def={def}
                    value={cf?.kind === "range" ? cf : { min: null, max: null }}
                    onChange={(v) =>
                      set(def.key, v.min == null && v.max == null ? null : { kind: "range", ...v })
                    }
                  />
                ) : (
                  <MultiSelect
                    def={def}
                    books={books}
                    value={cf?.kind === "values" ? cf.values : []}
                    onChange={(values) =>
                      set(def.key, values.length ? { kind: "values", values } : null)
                    }
                  />
                )}
              </div>
            );
          })}
          <div className="flex justify-between items-center border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setDraft({})}
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={apply}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function BookFilters({
  books,
  schema,
  filters,
  setFilters,
  resultCount,
  total,
}: {
  books: BookDoc[];
  schema: FieldDef[];
  filters: FilterState;
  setFilters: (f: FilterState | ((prev: FilterState) => FilterState)) => void;
  resultCount: number;
  total: number;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const hasType = schema.some((f) => f.key === "type");
  const activeCustom = countActiveCustom(filters);
  // Rating min/max is covered by the "Rated 8+" chip and panel; skip
  // title/author/notes (free-text search handles those).
  const panelSchema = schema;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap relative">
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, typeChip: "all" }))}
          className={`${CHIP} ${filters.typeChip === "all" ? CHIP_ON : CHIP_OFF}`}
        >
          All
        </button>
        {hasType && (
          <>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, typeChip: "fiction" }))}
              className={`${CHIP} ${filters.typeChip === "fiction" ? CHIP_ON : CHIP_OFF}`}
            >
              Fiction
            </button>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, typeChip: "nonfiction" }))}
              className={`${CHIP} ${filters.typeChip === "nonfiction" ? CHIP_ON : CHIP_OFF}`}
            >
              Non-Fiction
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, ratedEightPlus: !f.ratedEightPlus }))}
          className={`${CHIP} ${filters.ratedEightPlus ? CHIP_ON : CHIP_OFF}`}
        >
          Rated 8+
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className={`${CHIP} ${activeCustom > 0 ? CHIP_ON : CHIP_OFF}`}
          >
            Filters{activeCustom > 0 ? ` · ${activeCustom}` : "…"}
          </button>
          {panelOpen && (
            <FilterPanel
              books={books}
              schema={panelSchema}
              initial={filters.custom}
              onApply={(custom) => setFilters((f) => ({ ...f, custom }))}
              onClose={() => setPanelOpen(false)}
            />
          )}
        </div>
        <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
          {resultCount} of {total} book{total === 1 ? "" : "s"}
        </span>
      </div>

      {activeCustom > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(filters.custom).map(([key, cf]) => {
            const def = schema.find((d) => d.key === key);
            if (!def) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setFilters((f) => {
                    const custom = { ...f.custom };
                    delete custom[key];
                    return { ...f, custom };
                  })
                }
                className="px-2 py-1 rounded-full text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                {summarizeFilter(def, cf)} ×
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
