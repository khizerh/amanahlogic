"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function returningColumns(
  onReview: (app: ReturningApplicationWithPlan) => void
): ColumnDef<ReturningApplicationWithPlan>[] {
  return [
    {
      accessorKey: "name",
      header: "Name",
      accessorFn: (row) =>
        `${row.firstName} ${row.middleName ? `${row.middleName} ` : ""}${row.lastName}`,
      cell: ({ row }) => (
        <button
          onClick={() => onReview(row.original)}
          className="font-medium hover:underline text-brand-teal text-left"
        >
          {row.original.firstName}{" "}
          {row.original.middleName ? `${row.original.middleName} ` : ""}
          {row.original.lastName}
        </button>
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
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReview(row.original)}
          >
            Review
          </Button>
        </div>
      ),
    },
  ];
}
