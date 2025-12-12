"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  useReactTable,
  TableMeta,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Button } from "./button";
import { Badge } from "./badge";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchColumn?: string;
  searchPlaceholder?: string;
  filterColumns?: {
    column: string;
    label: string;
    options: { label: string; value: string }[];
  }[];
  onExport?: (data: TData[]) => void;
  pageSize?: number;
  getRowClassName?: (row: TData) => string;
  meta?: TableMeta<TData>;
}

/* @react-compiler-disable */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchColumn,
  searchPlaceholder = "Search...",
  filterColumns = [],
  onExport,
  pageSize = 10,
  getRowClassName,
  meta,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable returns functions that cannot be memoized safely by React Compiler
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
    meta,
  });

  const activeFilters = columnFilters.filter((filter) => filter.value && filter.value !== "all");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3">
        {/* Search - prominent on its own line */}
        {searchColumn && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn(searchColumn)?.setFilterValue(event.target.value)}
            className="max-w-xl"
          />
        )}
        {/* Filters and Export - grouped on second line */}
        {(filterColumns.length > 0 || onExport) && (
          <div className="flex flex-wrap items-center gap-3">
            {filterColumns.map((filter) => (
              <Select
                key={filter.column}
                value={(table.getColumn(filter.column)?.getFilterValue() as string) ?? "all"}
                onValueChange={(value) =>
                  table.getColumn(filter.column)?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            {onExport && (
              <Button
                variant="outline"
                onClick={() => {
                  const filteredRows = table.getFilteredRowModel().rows;
                  const filteredData = filteredRows.map((row) => row.original);
                  onExport(filteredData);
                }}
                className="ml-auto"
              >
                Export CSV
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter) => {
            const filterColumn = filterColumns.find((f) => f.column === filter.id);
            return (
              <Badge key={filter.id} variant="secondary">
                {filterColumn?.label}: {filter.value as string}
                <button
                  onClick={() => table.getColumn(filter.id)?.setFilterValue("")}
                  className="ml-2 hover:text-foreground"
                >
                  ×
                </button>
              </Badge>
            );
          })}
          {searchColumn && !!table.getColumn(searchColumn)?.getFilterValue() && (
            <Badge variant="secondary">
              Search: {String(table.getColumn(searchColumn)?.getFilterValue())}
              <button
                onClick={() => table.getColumn(searchColumn)?.setFilterValue("")}
                className="ml-2 hover:text-foreground"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  const headerContent = header.column.columnDef.header;
                  // Check if header is a function (custom component) or a simple string
                  const isCustomHeader = typeof headerContent === "function";

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : isSortable && !isCustomHeader ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-accent"
                          onClick={() => {
                            const isDesc = sortDirection === "desc";
                            header.column.toggleSorting(!isDesc);
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === "asc" ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : sortDirection === "desc" ? (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                          )}
                        </Button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={getRowClassName ? getRowClassName(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} total row(s).
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
