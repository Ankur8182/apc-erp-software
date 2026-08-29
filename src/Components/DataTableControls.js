import React from "react";
import "../Styles/DataTableControls.css";

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search records...",
  table,
  children,
}) {
  return (
    <div className="data-table-toolbar">
      <label className="data-table-search">
        <span className="sr-only">Search records</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>

      <div className="data-table-filter-controls">{children}</div>

      <label className="data-table-sort-control">
        <span>Sort</span>
        <select value={table.sortBy} onChange={(event) => table.setSortBy(event.target.value)}>
          {table.sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        className="data-table-direction"
        type="button"
        onClick={() => table.setSortDirection(table.sortDirection === "asc" ? "desc" : "asc")}
        aria-label={`Sort ${table.sortDirection === "asc" ? "descending" : "ascending"}`}
        title={`Sort ${table.sortDirection === "asc" ? "descending" : "ascending"}`}
      >
        {table.sortDirection === "asc" ? "↑" : "↓"}
      </button>

      <span className="data-table-count" aria-live="polite">
        {table.count} record{table.count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export function DataTablePagination({ table }) {
  if (table.count <= table.pageSize) return null;

  return (
    <nav className="data-table-pagination" aria-label="Table pages">
      <span>
        Showing {table.startIndex + 1}–{Math.min(table.startIndex + table.pageSize, table.count)} of {table.count}
      </span>
      <div>
        <button type="button" onClick={() => table.setPage(1)} disabled={table.currentPage === 1}>
          First
        </button>
        <button type="button" onClick={() => table.setPage(table.currentPage - 1)} disabled={table.currentPage === 1}>
          Previous
        </button>
        <strong>Page {table.currentPage} of {table.totalPages}</strong>
        <button type="button" onClick={() => table.setPage(table.currentPage + 1)} disabled={table.currentPage === table.totalPages}>
          Next
        </button>
        <button type="button" onClick={() => table.setPage(table.totalPages)} disabled={table.currentPage === table.totalPages}>
          Last
        </button>
      </div>
    </nav>
  );
}
