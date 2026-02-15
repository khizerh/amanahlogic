"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { ReturningApplicationWithPlan } from "@/lib/types";
import { formatPhoneNumber } from "@/lib/utils";

const getPlanTypeBadge = (type: string, name: string) => {
  const variants: Record<string, "info" | "refunded" | "warning"> = {
    single: "info",
    married: "refunded",
    widow: "warning",
  };
  const variant = variants[type.toLowerCase()] || "info";
  return <Badge variant={variant}>{name}</Badge>;
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "warning" | "success" | "error"; label: string }> = {
    pending: { variant: "warning", label: "Pending" },
    approved: { variant: "success", label: "Approved" },
    rejected: { variant: "error", label: "Deleted" },
  };
  const { variant, label } = config[status] || config.pending;
  return <Badge variant={variant}>{label}</Badge>;
};

export const returningColumns: ColumnDef<ReturningApplicationWithPlan>[] = [
  {
    accessorKey: "name",
    header: "Name",
    accessorFn: (row) =>
      `${row.firstName} ${row.middleName ? `${row.middleName} ` : ""}${row.lastName}`,
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.firstName}{" "}
        {row.original.middleName ? `${row.original.middleName} ` : ""}
        {row.original.lastName}
      </span>
    ),
    filterFn: (row, _id, filterValue) => {
      const searchableText =
        `${row.original.firstName} ${row.original.middleName || ""} ${row.original.lastName} ${row.original.email || ""}`.toLowerCase();
      return searchableText.includes(filterValue.toLowerCase());
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span>{row.original.email}</span>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => <span>{formatPhoneNumber(row.original.phone)}</span>,
  },
  {
    accessorKey: "planName",
    header: "Plan",
    accessorFn: (row) => row.plan?.name || row.plan?.type || null,
    cell: ({ row }) => {
      const plan = row.original.plan;
      if (!plan) return <span>-</span>;
      return getPlanTypeBadge(plan.type, plan.name);
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original.status),
    filterFn: (row, _id, filterValue) => {
      if (filterValue === "all" || !filterValue) return true;
      return row.original.status === filterValue;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Submitted",
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return (
        <span className="text-muted-foreground">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
  },
];
