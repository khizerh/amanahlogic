"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { MemberWithMembership, PlanType } from "@/lib/types";
import { formatStatus, getStatusColor } from "@/lib/mock-data";

const getPlanTypeBadge = (type: PlanType) => {
  const colors = {
    single: "bg-blue-100 text-blue-800",
    married: "bg-purple-100 text-purple-800",
    widow: "bg-amber-100 text-amber-800",
  };
  const labels = {
    single: "Single",
    married: "Married",
    widow: "Widow",
  };
  return (
    <Badge className={colors[type]} variant="secondary">
      {labels[type]}
    </Badge>
  );
};

export const columns: ColumnDef<MemberWithMembership>[] = [
  {
    accessorKey: "name",
    header: "Name",
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    cell: ({ row }) => (
      <Link
        href={`/members/${row.original.id}`}
        className="font-medium hover:underline text-brand-teal"
      >
        {row.original.firstName} {row.original.lastName}
      </Link>
    ),
    filterFn: (row, id, filterValue) => {
      const searchableText = `${row.original.firstName} ${row.original.lastName} ${row.original.email} ${row.original.phone}`.toLowerCase();
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
    cell: ({ row }) => <span>{row.original.phone}</span>,
  },
  {
    accessorKey: "planType",
    header: "Plan Type",
    accessorFn: (row) => row.plan?.type || null,
    cell: ({ row }) => {
      const planType = row.original.plan?.type;
      return planType ? getPlanTypeBadge(planType) : <span>-</span>;
    },
    filterFn: (row, id, filterValue) => {
      if (filterValue === "all" || !filterValue) return true;
      return row.original.plan?.type === filterValue;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    accessorFn: (row) => row.membership?.status || null,
    cell: ({ row }) => {
      const status = row.original.membership?.status;
      return status ? (
        <Badge className={getStatusColor(status)} variant="secondary">
          {formatStatus(status)}
        </Badge>
      ) : (
        <span>-</span>
      );
    },
    filterFn: (row, id, filterValue) => {
      if (filterValue === "all" || !filterValue) return true;
      return row.original.membership?.status === filterValue;
    },
  },
  {
    accessorKey: "paidMonths",
    header: "Paid Months",
    accessorFn: (row) => row.membership?.paidMonths || 0,
    cell: ({ row }) => {
      const paidMonths = row.original.membership?.paidMonths;
      return paidMonths !== undefined ? (
        <span className="font-mono">{paidMonths}/60</span>
      ) : (
        <span>-</span>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link href={`/members/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </Link>
      </div>
    ),
  },
];
