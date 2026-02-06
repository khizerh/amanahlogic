"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MemberWithMembership } from "@/lib/types";
import { formatStatus, getStatusVariant, formatDate } from "@/lib/utils/formatters";
import { formatPhoneNumber } from "@/lib/utils";
import { FileSignature, CreditCard, HelpCircle } from "lucide-react";

const getPlanTypeBadge = (type: string, name: string) => {
  // Predefined variants for common types
  const variants: Record<string, "info" | "refunded" | "warning"> = {
    single: "info",
    married: "refunded",
    widow: "warning",
  };
  // Use predefined variant or default to "info"
  const variant = variants[type.toLowerCase()] || "info";
  return (
    <Badge variant={variant}>
      {name}
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
    cell: ({ row }) => <span>{formatPhoneNumber(row.original.phone)}</span>,
  },
  {
    accessorKey: "planType",
    header: "Plan",
    accessorFn: (row) => row.plan?.name || row.plan?.type || null,
    cell: ({ row }) => {
      const plan = row.original.plan;
      if (!plan) return <span>-</span>;
      // Show plan name with type-based color
      return getPlanTypeBadge(plan.type, plan.name);
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
      const membership = row.original.membership;
      const status = membership?.status;

      if (!status) return <span>-</span>;

      // For pending status, show tooltip explaining why
      if (status === "pending") {
        const agreementSigned = !!membership.agreementSignedAt;
        // Check if payment is set up: auto-pay members need an active subscription,
        // manual members with pre-credited months are considered set up
        const paymentSetUp = membership.autoPayEnabled
          || (!membership.stripeCustomerId && (membership.paidMonths || 0) > 0);

        const pendingReasons: { icon: typeof FileSignature; text: string }[] = [];

        if (!agreementSigned) {
          pendingReasons.push({
            icon: FileSignature,
            text: "Awaiting agreement signature",
          });
        }
        if (!paymentSetUp) {
          pendingReasons.push({
            icon: CreditCard,
            text: "Awaiting payment setup",
          });
        }

        if (pendingReasons.length > 0) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-1 cursor-help">
                    <Badge variant={getStatusVariant(status)}>
                      {formatStatus(status)}
                    </Badge>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="space-y-1">
                  {pendingReasons.map((reason) => {
                    const Icon = reason.icon;
                    return (
                      <div key={reason.text} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{reason.text}</span>
                      </div>
                    );
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
      }

      return (
        <Badge variant={getStatusVariant(status)}>
          {formatStatus(status)}
        </Badge>
      );
    },
    filterFn: (row, id, filterValue) => {
      if (filterValue === "all" || !filterValue) return true;
      return row.original.membership?.status === filterValue;
    },
  },
  {
    accessorKey: "eligibility",
    header: "Eligibility",
    accessorFn: (row) => row.membership?.paidMonths || 0,
    cell: ({ row }) => {
      const paidMonths = row.original.membership?.paidMonths || 0;
      const status = row.original.membership?.status;
      const isEligible = paidMonths >= 60 && status !== "cancelled";

      if (isEligible) {
        return <Badge variant="success">Eligible</Badge>;
      }

      // Show progress toward eligibility
      return (
        <span className="text-muted-foreground text-sm">
          {paidMonths}/60 months
        </span>
      );
    },
    filterFn: (row, id, filterValue) => {
      if (filterValue === "all" || !filterValue) return true;
      const paidMonths = row.original.membership?.paidMonths || 0;
      const status = row.original.membership?.status;
      const isEligible = paidMonths >= 60 && status !== "cancelled";
      if (filterValue === "eligible") return isEligible;
      if (filterValue === "not_eligible") return !isEligible;
      return true;
    },
  },
  {
    accessorKey: "joinDate",
    header: "Joined",
    accessorFn: (row) => row.membership?.joinDate || null,
    cell: ({ row }) => {
      const joinDate = row.original.membership?.joinDate;
      return joinDate ? (
        <span className="text-muted-foreground">{formatDate(joinDate)}</span>
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
            View
          </Button>
        </Link>
      </div>
    ),
  },
];
