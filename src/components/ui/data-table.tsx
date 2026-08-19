"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function DataTable<TData>({ columns, data, onRowClick, searchPlaceholder = "Search…", showSearch = true }: {
  // Per-column cell-value type is deliberately open here — this is a
  // generic reusable table wrapper, and each call site's own `columns`
  // array literal is what's actually checked against its row type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative max-w-md" data-noswipe>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={searchPlaceholder} className="h-14 w-full rounded-pill bg-surface-soft pl-11 pr-4 text-[14px] outline-none placeholder:text-faint focus:ring-4 focus:ring-primary/10" />
        </div>
      )}
      <div className="overflow-hidden rounded-panel bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] text-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/60">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-5 py-4 font-normal">
                    {header.isPlaceholder ? null : (
                      <button className="inline-flex items-center gap-1.5 hover:text-ink" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown size={11} className="opacity-40" />}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} onClick={() => onRowClick?.(row.original)} className={cn("border-b border-border/50 last:border-0", onRowClick && "cursor-pointer transition-colors hover:bg-surface-soft")}> 
                {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-5 py-4">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>{table.getFilteredRowModel().rows.length} records</span>
        <div className="flex items-center gap-2">
          <select className="h-10 rounded-pill bg-surface px-3 text-[12px] outline-none" value={table.getState().pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <Button variant="outline" size="iconSm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button>
          <Button variant="outline" size="iconSm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}
