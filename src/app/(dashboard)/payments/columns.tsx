"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Mail, CheckCircle2 } from "lucide-react";
import { PaymentWithDetails } from "@/lib/database/payments";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

const getPaymentTypeBadge = (type: string) => {
  switch (type) {
    case "enrollment_fee":
      return <Badge variant="refunded">Enrollment Fee</Badge>;
    case "dues":
      return <Badge variant="info">Dues</Badge>;
    case "back_dues":
      return <Badge variant="warning">Back Dues</Badge>;
    default:
      return <Badge variant="inactive">{type}</Badge>;
  }
};

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case "stripe":
      return "Stripe";
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "zelle":
      return "Zelle";
    default:
      return method;
  }
};

// Check if a payment is overdue (pending + past due date)
const isOverdue = (status: string, dueDate: string | null | undefined): boolean => {
  if (status !== "pending" || !dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return due < today;
};

const getStatusBadge = (status: string, dueDate?: string | null) => {
  // Check if pending payment is overdue
  if (status === "pending" && isOverdue(status, dueDate)) {
    return <Badge variant="outline" className="bg-red-50 text-red-500 border-red-200">Overdue</Badge>;
  }

  switch (status) {
    case "completed":
      return <Badge variant="success">Completed</Badge>;
    case "pending":
      return <Badge variant="warning">Pending</Badge>;
    case "failed":
      return <Badge variant="error">Failed</Badge>;
    case "refunded":
      return <Badge variant="refunded">Refunded</Badge>;
    default:
      return <Badge variant="inactive">{status}</Badge>;
  }
};

export interface PaymentColumnActions {
  onViewDetails: (payment: PaymentWithDetails) => void;
  onEmailReceipt: (payment: PaymentWithDetails) => void;
  onSettlePayment: (payment: PaymentWithDetails) => void;
}

export const createColumns = (actions: PaymentColumnActions): ColumnDef<PaymentWithDetails>[] => [
  {
    accessorFn: (row) => row.paidAt || row.createdAt,
    id: "date",
    header: "Date",
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div className="text-sm">
          {formatDate(payment.paidAt || payment.createdAt)}
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "member",
    header: "Member",
    cell: ({ row }) => {
      const member = row.original.member;
      if (!member) return <span className="text-muted-foreground">Unknown</span>;
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
      if (!member) return false;
      const searchValue = value.toLowerCase();
      return (
        member.firstName.toLowerCase().includes(searchValue) ||
        member.lastName.toLowerCase().includes(searchValue) ||
        member.email.toLowerCase().includes(searchValue)
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      return getPaymentTypeBadge(row.original.type);
    },
    filterFn: (row, id, value) => {
      return row.original.type === value;
    },
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => {
      return (
        <span className="text-sm">
          {getPaymentMethodLabel(row.original.method)}
        </span>
      );
    },
    filterFn: (row, id, value) => {
      return row.original.method === value;
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {formatCurrency(row.original.amount)}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const payment = row.original;
      return getStatusBadge(payment.status, payment.dueDate);
    },
    filterFn: (row, id, value) => {
      const payment = row.original;
      // Special handling for "overdue" filter
      if (value === "overdue") {
        return isOverdue(payment.status, payment.dueDate);
      }
      // For "pending" filter, exclude overdue payments
      if (value === "pending") {
        return payment.status === "pending" && !isOverdue(payment.status, payment.dueDate);
      }
      return payment.status === value;
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right sr-only">Actions</div>,
    cell: ({ row }) => {
      const payment = row.original;
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
              <DropdownMenuItem onClick={() => actions.onViewDetails(payment)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {payment.status === "completed" && (
                <DropdownMenuItem onClick={() => actions.onEmailReceipt(payment)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Receipt
                </DropdownMenuItem>
              )}
              {payment.status === "pending" && (
                <DropdownMenuItem onClick={() => actions.onSettlePayment(payment)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Paid
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
