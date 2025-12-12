"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CreditCard, Building2, Banknote, FileText, Smartphone } from "lucide-react";
import { PaymentWithDetails } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/mock-data";

const getPaymentTypeBadge = (type: string) => {
  switch (type) {
    case "enrollment_fee":
      return <Badge className="bg-indigo-100 text-indigo-800">Enrollment Fee</Badge>;
    case "dues":
      return <Badge className="bg-blue-100 text-blue-800">Dues</Badge>;
    case "back_dues":
      return <Badge className="bg-amber-100 text-amber-800">Back Dues</Badge>;
    default:
      return <Badge>{type}</Badge>;
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
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-purple-100 text-purple-800">Refunded</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export const columns: ColumnDef<PaymentWithDetails>[] = [
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
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div className="text-right">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/payments/${payment.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
        </div>
      );
    },
  },
];
