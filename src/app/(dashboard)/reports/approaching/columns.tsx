"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MembershipWithDetails } from "@/lib/types";
import { formatDate } from "@/lib/mock-data";

export const columns: ColumnDef<MembershipWithDetails>[] = [
  {
    accessorKey: "member",
    header: "Member Name",
    accessorFn: (row) => `${row.member.firstName} ${row.member.lastName}`,
    cell: ({ row }) => (
      <Link
        href={`/members/${row.original.member.id}`}
        className="font-medium hover:underline"
      >
        {row.original.member.firstName} {row.original.member.lastName}
      </Link>
    ),
    filterFn: (row, id, filterValue) => {
      const searchText = `${row.original.member.firstName} ${row.original.member.lastName} ${row.original.member.email}`.toLowerCase();
      return searchText.includes(filterValue.toLowerCase());
    },
  },
  {
    accessorKey: "plan",
    header: "Plan",
    accessorFn: (row) => row.plan.name,
    cell: ({ row }) => <span className="font-medium">{row.original.plan.name}</span>,
  },
  {
    accessorKey: "paidMonths",
    header: "Paid Months",
    cell: ({ row }) => (
      <div className="text-right">
        <span className="font-semibold text-blue-600">{row.original.paidMonths}</span>
      </div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "monthsRemaining",
    header: "Months Remaining",
    accessorFn: (row) => 60 - row.paidMonths,
    cell: ({ row }) => {
      const monthsRemaining = 60 - row.original.paidMonths;
      return (
        <div className="text-right text-muted-foreground">
          {monthsRemaining} {monthsRemaining === 1 ? "month" : "months"}
        </div>
      );
    },
  },
  {
    accessorKey: "estimatedEligibility",
    header: "Estimated Eligibility",
    accessorFn: (row) => {
      if (!row.lastPaymentDate) return null;
      const monthsRemaining = 60 - row.paidMonths;
      const lastPayment = new Date(row.lastPaymentDate);
      const estimatedDate = new Date(lastPayment);
      estimatedDate.setMonth(estimatedDate.getMonth() + monthsRemaining);
      return estimatedDate.toISOString();
    },
    cell: ({ row }) => {
      if (!row.original.lastPaymentDate) {
        return <div className="text-right text-muted-foreground">-</div>;
      }
      const monthsRemaining = 60 - row.original.paidMonths;
      const lastPayment = new Date(row.original.lastPaymentDate);
      const estimatedDate = new Date(lastPayment);
      estimatedDate.setMonth(estimatedDate.getMonth() + monthsRemaining);
      return (
        <div className="text-right text-muted-foreground">
          {formatDate(estimatedDate.toISOString())}
        </div>
      );
    },
  },
];
