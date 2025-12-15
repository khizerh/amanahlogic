"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Copy,
  RefreshCw,
  Send,
  DollarSign,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { OnboardingInviteWithMember } from "@/lib/types";

// Badge for payment method
const getMethodBadge = (method: "stripe" | "manual") => {
  if (method === "stripe") {
    return (
      <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
        <CreditCard className="h-3 w-3" />
        Stripe
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
      <Banknote className="h-3 w-3" />
      Manual
    </Badge>
  );
};

// Display payment amount (paid or pending)
const getPaymentStatusBadge = (amount: number, paidAt: string | null) => {
  if (paidAt) {
    return <span className="text-sm">{formatCurrency(amount)}</span>;
  }
  return <span className="text-sm">{formatCurrency(amount)}</span>;
};

// Badge for invite status
const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="inactive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    case "canceled":
      return (
        <Badge variant="error" className="gap-1">
          <XCircle className="h-3 w-3" />
          Canceled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export interface OnboardingColumnActions {
  onCopyLink: (invite: OnboardingInviteWithMember) => void;
  onResendEmail: (invite: OnboardingInviteWithMember) => void;
  onSendNewLink: (invite: OnboardingInviteWithMember) => void;
  onRecordPayment: (invite: OnboardingInviteWithMember) => void;
}

export const createOnboardingColumns = (
  actions: OnboardingColumnActions
): ColumnDef<OnboardingInviteWithMember>[] => [
  {
    accessorKey: "member",
    header: "Member",
    cell: ({ row }) => {
      const invite = row.original;
      return (
        <Link
          href={`/members/${invite.memberId}`}
          className="font-medium text-brand-teal hover:underline"
        >
          {invite.member.firstName} {invite.member.lastName}
        </Link>
      );
    },
    filterFn: (row, id, value) => {
      const searchValue = value.toLowerCase();
      const member = row.original.member;
      return (
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchValue) ||
        member.email.toLowerCase().includes(searchValue)
      );
    },
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      return <span className="text-sm">{row.original.plan?.name || "Unknown"}</span>;
    },
    filterFn: (row, id, value) => {
      return row.original.plan?.name === value;
    },
  },
  {
    accessorKey: "paymentMethod",
    header: "Method",
    cell: ({ row }) => {
      return getMethodBadge(row.original.paymentMethod);
    },
    filterFn: (row, id, value) => {
      return row.original.paymentMethod === value;
    },
  },
  {
    accessorKey: "enrollmentFee",
    header: "Enrollment Fee",
    cell: ({ row }) => {
      const invite = row.original;
      if (!invite.includesEnrollmentFee || invite.enrollmentFeeAmount === 0) {
        return <span className="text-sm text-muted-foreground">Waived</span>;
      }
      return getPaymentStatusBadge(invite.enrollmentFeeAmount, invite.enrollmentFeePaidAt);
    },
  },
  {
    accessorKey: "dues",
    header: "First Dues",
    cell: ({ row }) => {
      const invite = row.original;
      return getPaymentStatusBadge(invite.duesAmount, invite.duesPaidAt);
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return getStatusBadge(row.original.status);
    },
    filterFn: (row, id, value) => {
      return row.original.status === value;
    },
  },
  {
    accessorKey: "sentAt",
    header: "Sent",
    cell: ({ row }) => {
      return <span className="text-sm">{formatDate(row.original.sentAt)}</span>;
    },
    enableSorting: true,
  },
  {
    id: "actions",
    header: () => <div className="text-right sr-only">Actions</div>,
    cell: ({ row }) => {
      const invite = row.original;
      const isStripe = invite.paymentMethod === "stripe";
      const isPending = invite.status === "pending";
      const isExpired = invite.status === "expired";
      const isCompleted = invite.status === "completed";

      // No actions for completed invites
      if (isCompleted) {
        return null;
      }

      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Stripe + Pending: Copy link, Resend email */}
              {isStripe && isPending && (
                <>
                  <DropdownMenuItem onClick={() => actions.onCopyLink(invite)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Checkout Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => actions.onResendEmail(invite)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Email
                  </DropdownMenuItem>
                </>
              )}

              {/* Stripe + Expired: Send new link */}
              {isStripe && isExpired && (
                <DropdownMenuItem onClick={() => actions.onSendNewLink(invite)}>
                  <Send className="mr-2 h-4 w-4" />
                  Send New Link
                </DropdownMenuItem>
              )}

              {/* Manual + Pending: Record payment */}
              {!isStripe && isPending && (
                <DropdownMenuItem onClick={() => actions.onRecordPayment(invite)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Record Payment
                </DropdownMenuItem>
              )}

              {/* Manual + Expired: Can also record payment or resend instructions */}
              {!isStripe && isExpired && (
                <>
                  <DropdownMenuItem onClick={() => actions.onRecordPayment(invite)}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Record Payment
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => actions.onResendEmail(invite)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Instructions
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
