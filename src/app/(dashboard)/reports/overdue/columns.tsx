"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MembershipWithDetails } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/mock-data";

// Helper function to calculate days overdue
function getDaysOverdue(nextPaymentDue: string | null): number {
  if (!nextPaymentDue) return 0;
  const dueDate = new Date(nextPaymentDue);
  const today = new Date();
  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Helper function to calculate amount due based on plan
function getAmountDue(membership: MembershipWithDetails): number {
  const plan = membership.plan;
  switch (membership.billingFrequency) {
    case "annual":
      return plan.pricing.annual;
    case "biannual":
      return plan.pricing.biannual;
    default:
      return plan.pricing.monthly;
  }
}

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
    accessorKey: "lastPayment",
    header: "Last Payment",
    accessorFn: (row) => row.lastPaymentDate,
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground">
        {formatDate(row.original.lastPaymentDate)}
      </div>
    ),
  },
  {
    accessorKey: "amountDue",
    header: "Amount Due",
    accessorFn: (row) => getAmountDue(row),
    cell: ({ row }) => {
      const amountDue = getAmountDue(row.original);
      return (
        <div className="text-right font-semibold">
          {formatCurrency(amountDue)}
        </div>
      );
    },
  },
  {
    accessorKey: "daysOverdue",
    header: "Days Overdue",
    accessorFn: (row) => getDaysOverdue(row.nextPaymentDue),
    cell: ({ row }) => {
      const daysOverdue = getDaysOverdue(row.original.nextPaymentDue);
      return (
        <div className="text-right">
          <span className={daysOverdue > 30 ? "text-red-600 font-semibold" : "text-orange-600"}>
            {daysOverdue} {daysOverdue === 1 ? "day" : "days"}
          </span>
        </div>
      );
    },
  },
];
