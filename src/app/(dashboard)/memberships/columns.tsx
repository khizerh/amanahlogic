"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye } from "lucide-react";
import { MembershipWithDetails } from "@/lib/types";
import { formatCurrency, formatDate, formatStatus, getStatusVariant } from "@/lib/mock-data";

const getPlanBadgeVariant = (planType: string): "info" | "refunded" | "warning" | "inactive" => {
  switch (planType) {
    case "single":
      return "info";
    case "married":
      return "refunded";
    case "widow":
      return "warning";
    default:
      return "inactive";
  }
};

const getBillingLabel = (frequency: string) => {
  switch (frequency) {
    case "monthly":
      return "Monthly";
    case "biannual":
      return "Bi-Annual";
    case "annual":
      return "Annual";
    default:
      return frequency;
  }
};

export const columns: ColumnDef<MembershipWithDetails>[] = [
  {
    accessorKey: "member",
    header: "Member",
    cell: ({ row }) => {
      const member = row.original.member;
      return (
        <Link
          href={`/members/${member.id}`}
          className="font-medium text-brand-teal hover:underline"
        >
          {member.firstName} {member.lastName}
        </Link>
      );
    },
    filterFn: (row, id, value) => {
      const member = row.original.member;
      const searchValue = value.toLowerCase();
      return (
        member.firstName.toLowerCase().includes(searchValue) ||
        member.lastName.toLowerCase().includes(searchValue) ||
        member.email.toLowerCase().includes(searchValue)
      );
    },
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const plan = row.original.plan;
      return (
        <Badge variant={getPlanBadgeVariant(plan.type)}>
          {plan.name}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant={getStatusVariant(status)}>
          {formatStatus(status)}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return row.original.status === value;
    },
  },
  {
    accessorFn: (row) => row.paidMonths,
    id: "paidMonths",
    header: "Paid Months",
    cell: ({ row }) => {
      const paidMonths = row.original.paidMonths;
      const progressPercent = Math.min((paidMonths / 60) * 100, 100);
      return (
        <div className="space-y-1 min-w-[120px]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{paidMonths}/60</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      );
    },
  },
  {
    accessorKey: "billing",
    header: "Billing",
    cell: ({ row }) => {
      const membership = row.original;
      const duesAmount =
        membership.billingFrequency === "monthly"
          ? membership.plan.pricing.monthly
          : membership.billingFrequency === "biannual"
          ? membership.plan.pricing.biannual
          : membership.plan.pricing.annual;

      return (
        <div className="text-sm">
          <div className="font-medium">{getBillingLabel(membership.billingFrequency)}</div>
          <div className="text-xs text-muted-foreground">
            {formatCurrency(duesAmount)}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "nextPaymentDue",
    header: "Next Due",
    cell: ({ row }) => {
      const nextDue = row.original.nextPaymentDue;
      return (
        <div className="text-sm">
          {nextDue ? (
            <div>{formatDate(nextDue)}</div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const membership = row.original;
      return (
        <div className="text-right">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/members/${membership.member.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
        </div>
      );
    },
  },
];
