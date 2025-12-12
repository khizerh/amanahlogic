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
import { MoreHorizontal, Eye, Mail, CreditCard, Building2, Banknote, FileText, Smartphone } from "lucide-react";
import { PaymentWithDetails } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/mock-data";

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

const getPaymentMethodIcon = (method: string) => {
  switch (method) {
    case "card":
      return <CreditCard className="h-4 w-4" />;
    case "ach":
      return <Building2 className="h-4 w-4" />;
    case "cash":
      return <Banknote className="h-4 w-4" />;
    case "check":
      return <FileText className="h-4 w-4" />;
    case "zelle":
      return <Smartphone className="h-4 w-4" />;
    default:
      return null;
  }
};

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case "card":
      return "Card";
    case "ach":
      return "ACH";
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

const getStatusBadge = (status: string) => {
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
      const method = row.original.method;
      return (
        <div className="flex items-center gap-2">
          {getPaymentMethodIcon(method)}
          <span className="text-sm">
            {getPaymentMethodLabel(method)}
          </span>
        </div>
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
      return getStatusBadge(row.original.status);
    },
    filterFn: (row, id, value) => {
      return row.original.status === value;
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
              <DropdownMenuItem onClick={() => actions.onEmailReceipt(payment)}>
                <Mail className="mr-2 h-4 w-4" />
                Email Receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
