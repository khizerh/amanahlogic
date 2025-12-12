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
    accessorKey: "email",
    header: "Email",
    accessorFn: (row) => row.member.email,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.member.email}</span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    accessorFn: (row) => row.member.phone,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.member.phone}</span>
    ),
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
        <span className="font-semibold text-green-600">{row.original.paidMonths}</span>
      </div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "eligibleSince",
    header: "Eligible Since",
    accessorFn: (row) => row.eligibleDate,
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground">
        {formatDate(row.original.eligibleDate)}
      </div>
    ),
  },
];
