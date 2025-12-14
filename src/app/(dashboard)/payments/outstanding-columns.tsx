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
  Send,
  Pause,
  Play,
  DollarSign,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/mock-data";

export interface OutstandingPayment {
  id: string;
  memberId: string;
  membershipId: string;
  memberName: string;
  memberEmail: string;
  planName: string;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
  type: "overdue" | "failed";
  reminderCount: number;
  remindersPaused: boolean;
  failureReason?: string;
  lastAttempt?: string;
}

const getTypeBadge = (type: "overdue" | "failed") => {
  switch (type) {
    case "overdue":
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="error" className="gap-1">
          <CreditCard className="h-3 w-3" />
          Failed Charge
        </Badge>
      );
    default:
      return <Badge variant="inactive">{type}</Badge>;
  }
};

const getDaysOverdueBadge = (days: number) => {
  if (days <= 7) {
    return <Badge variant="warning">{days}d</Badge>;
  } else if (days <= 30) {
    return <Badge variant="error">{days}d</Badge>;
  } else if (days <= 60) {
    return <Badge variant="destructive">{days}d</Badge>;
  } else {
    return <Badge variant="destructive">{days}d+</Badge>;
  }
};

export interface OutstandingColumnActions {
  onSendReminder: (payment: OutstandingPayment) => void;
  onTogglePauseReminders: (payment: OutstandingPayment) => void;
  onRecordPayment: (payment: OutstandingPayment) => void;
  onRetryCharge?: (payment: OutstandingPayment) => void;
}

export const createOutstandingColumns = (
  actions: OutstandingColumnActions
): ColumnDef<OutstandingPayment>[] => [
  {
    accessorKey: "memberName",
    header: "Member",
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div>
          <Link
            href={`/members/${payment.memberId}`}
            className="font-medium text-brand-teal hover:underline"
          >
            {payment.memberName}
          </Link>
          <div className="text-sm text-muted-foreground">{payment.memberEmail}</div>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const searchValue = value.toLowerCase();
      return (
        row.original.memberName.toLowerCase().includes(searchValue) ||
        row.original.memberEmail.toLowerCase().includes(searchValue)
      );
    },
  },
  {
    accessorKey: "planName",
    header: "Plan",
    cell: ({ row }) => {
      return <span className="text-sm">{row.original.planName}</span>;
    },
    filterFn: (row, id, value) => {
      return row.original.planName === value;
    },
  },
  {
    accessorKey: "amountDue",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium text-red-600">
          {formatCurrency(row.original.amountDue)}
        </div>
      );
    },
  },
  {
    accessorKey: "dueDate",
    header: "Due Date",
    cell: ({ row }) => {
      return <span className="text-sm">{formatDate(row.original.dueDate)}</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: "daysOverdue",
    header: "Overdue",
    cell: ({ row }) => {
      return getDaysOverdueBadge(row.original.daysOverdue);
    },
    enableSorting: true,
    filterFn: (row, id, value) => {
      const days = row.original.daysOverdue;
      switch (value) {
        case "1-7":
          return days >= 1 && days <= 7;
        case "8-14":
          return days >= 8 && days <= 14;
        case "15-30":
          return days >= 15 && days <= 30;
        case "31-60":
          return days >= 31 && days <= 60;
        case "60+":
          return days > 60;
        default:
          return true;
      }
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      return getTypeBadge(row.original.type);
    },
    filterFn: (row, id, value) => {
      return row.original.type === value;
    },
  },
  {
    accessorKey: "reminderCount",
    header: "Reminders",
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {payment.reminderCount}/3
          </span>
          {payment.remindersPaused && (
            <Badge variant="outline" className="text-xs">
              Paused
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right sr-only">Actions</div>,
    cell: ({ row }) => {
      const payment = row.original;
      const canSendReminder = payment.reminderCount < 3 && !payment.remindersPaused;

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
              {canSendReminder && (
                <DropdownMenuItem onClick={() => actions.onSendReminder(payment)}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Reminder
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => actions.onTogglePauseReminders(payment)}>
                {payment.remindersPaused ? (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume Reminders
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause Reminders
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => actions.onRecordPayment(payment)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
              {payment.type === "failed" && actions.onRetryCharge && (
                <DropdownMenuItem onClick={() => actions.onRetryCharge?.(payment)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Retry Charge
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
