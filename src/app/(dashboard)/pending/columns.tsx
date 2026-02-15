"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberWithMembership } from "@/lib/types";
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

const getEnrollmentFeeBadge = (status: string) => {
  const variants: Record<string, "success" | "warning" | "secondary"> = {
    paid: "success",
    waived: "secondary",
    unpaid: "warning",
  };
  const variant = variants[status] || "warning";
  const labels: Record<string, string> = {
    paid: "Paid",
    waived: "Waived",
    unpaid: "Unpaid",
  };
  return <Badge variant={variant}>{labels[status] || status}</Badge>;
};

export const columns: ColumnDef<MemberWithMembership>[] = [
  {
    accessorKey: "name",
    header: "Name",
    accessorFn: (row) =>
      `${row.firstName} ${row.middleName ? `${row.middleName} ` : ""}${row.lastName}`,
    cell: ({ row }) => (
      <Link
        href={`/members/${row.original.id}`}
        className="font-medium hover:underline text-brand-teal"
      >
        {row.original.firstName}{" "}
        {row.original.middleName ? `${row.original.middleName} ` : ""}
        {row.original.lastName}
      </Link>
    ),
    filterFn: (row, id, filterValue) => {
      const searchableText =
        `${row.original.firstName} ${row.original.middleName || ""} ${row.original.lastName} ${row.original.email || ""} ${row.original.phone}`.toLowerCase();
      return searchableText.includes(filterValue.toLowerCase());
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span>{row.original.email || "—"}</span>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => <span>{formatPhoneNumber(row.original.phone)}</span>,
  },
  {
    accessorKey: "planType",
    header: "Plan",
    accessorFn: (row) => row.plan?.name || row.plan?.type || null,
    cell: ({ row }) => {
      const plan = row.original.plan;
      if (!plan) return <span>-</span>;
      return getPlanTypeBadge(plan.type, plan.name);
    },
    filterFn: (row, id, filterValue) => {
      if (filterValue === "all" || !filterValue) return true;
      return row.original.plan?.type === filterValue;
    },
  },
  {
    accessorKey: "enrollmentFeeStatus",
    header: "Enrollment Fee",
    accessorFn: (row) => row.membership?.enrollmentFeeStatus || null,
    cell: ({ row }) => {
      const status = row.original.membership?.enrollmentFeeStatus;
      if (!status) return <span>-</span>;
      return getEnrollmentFeeBadge(status);
    },
  },
  {
    accessorKey: "paidMonths",
    header: "Paid Months",
    accessorFn: (row) => row.membership?.paidMonths || 0,
    cell: ({ row }) => {
      const paidMonths = row.original.membership?.paidMonths || 0;
      return <span className="text-muted-foreground">{paidMonths}</span>;
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link href={`/members/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      </div>
    ),
  },
];
