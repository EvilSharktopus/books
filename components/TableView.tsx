"use client";

import { BookDoc } from "@/lib/books";
import { FieldDef, SortState } from "./useFilteredBooks";

interface Column {
  key: string;
  label: string;
  numeric: boolean;
  render: (b: BookDoc) => React.ReactNode;
}

function formatDate(book: BookDoc): string {
  if (!book.dateAdded) return "";
  const date = book.dateAdded.toDate();
  if (date.getFullYear() < 2025) return "Pre-2025";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function TableView({
  books,
  schema,
  sort,
  onSort,
  onOpen,
}: {
  books: BookDoc[];
  schema: FieldDef[];
  sort: SortState;
  onSort: (key: string) => void;
  onOpen: (book: BookDoc) => void;
}) {
  const has = (key: string) => schema.some((f) => f.key === key);

  const columns: Column[] = [
    {
      key: "title",
      label: "Title",
      numeric: false,
      render: (b) => (
        <span className="flex items-center gap-2 min-w-0">
          {b.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover} alt="" className="w-6 h-9 object-cover rounded-sm shrink-0" loading="lazy" />
          ) : (
            <span className="w-6 h-9 rounded-sm bg-gray-100 border border-dashed border-gray-200 shrink-0" />
          )}
          <span className="truncate font-medium text-gray-800 max-w-56">{b.title}</span>
        </span>
      ),
    },
    { key: "authors", label: "Author", numeric: false, render: (b) => <span className="truncate block max-w-40">{b.authors}</span> },
    {
      key: "myRating",
      label: "Rating",
      numeric: true,
      render: (b) => (b.myRating > 0 ? <span className="text-amber-500 font-semibold">{b.myRating}</span> : ""),
    },
    { key: "dateAdded", label: "Date added", numeric: false, render: (b) => <span className="whitespace-nowrap">{formatDate(b)}</span> },
    ...(has("type") ? [{ key: "type", label: "Type", numeric: false, render: (b: BookDoc) => b.type } as Column] : []),
    ...(has("language")
      ? [{
          key: "language", label: "Language", numeric: false,
          render: (b: BookDoc) =>
            b.language && b.language !== "English"
              ? `${b.language}${b.originalLanguage ? ` (${b.originalLanguage})` : ""}`
              : b.language,
        } as Column]
      : []),
    ...(has("season") ? [{ key: "season", label: "Season", numeric: false, render: (b: BookDoc) => b.season } as Column] : []),
    ...(has("authorCountry") ? [{ key: "authorCountry", label: "Author country", numeric: false, render: (b: BookDoc) => b.authorCountry } as Column] : []),
    ...(has("year") ? [{ key: "year", label: "Year", numeric: true, render: (b: BookDoc) => b.year } as Column] : []),
    ...(has("pages") ? [{ key: "pages", label: "Pages", numeric: true, render: (b: BookDoc) => b.pages } as Column] : []),
    ...(has("cried")
      ? [{ key: "cried", label: "Cried", numeric: false, render: (b: BookDoc) => (b.cried ? "💧" : "") } as Column]
      : []),
    ...(has("source") ? [{ key: "source", label: "Heard from", numeric: false, render: (b: BookDoc) => b.source } as Column] : []),
  ];

  return (
    // Break out of the centered page column so the table can use the full
    // window width, like a spreadsheet
    <div className="relative left-1/2 -translate-x-1/2 w-screen px-4 sm:px-8">
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 text-xs text-gray-500">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`px-2 py-2 font-semibold cursor-pointer select-none whitespace-nowrap border-b border-gray-200 hover:text-gray-800 ${
                  col.numeric ? "text-right" : "text-left"
                }`}
              >
                {col.label}
                {sort.key === col.key && (
                  <span className="ml-1">{sort.dir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
            <th className="px-2 py-2 border-b border-gray-200" aria-label="Notes" />
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr
              key={b.id}
              onClick={() => onOpen(b)}
              className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-1.5 text-gray-600 ${col.numeric ? "text-right tabular-nums" : "text-left"}`}
                >
                  {col.render(b)}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center">
                {b.notes && <span title="Has notes">📝</span>}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
