"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Payment } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { Printer } from "lucide-react";

interface PaymentDetailsSheetProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName?: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  // For YYYY-MM-DD date-only strings, parse as local date to avoid UTC timezone shift
  const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const getPaymentMethodLabel = (method: string, stripePaymentMethodType?: string | null) => {
  if (method === "stripe") {
    if (stripePaymentMethodType === "us_bank_account") return "Bank Transfer (ACH)";
    if (stripePaymentMethodType === "card") return "Credit/Debit Card";
    if (stripePaymentMethodType === "link") return "Stripe Link";
    return "Credit/Debit Card";
  }
  const labels: Record<string, string> = {
    card: "Credit/Debit Card",
    ach: "Bank Transfer (ACH)",
    cash: "Cash",
    check: "Check",
    zelle: "Zelle",
  };
  return labels[method] || method;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    case "processing":
      return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-purple-100 text-purple-800">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case "enrollment_fee":
      return <Badge variant="outline">Enrollment Fee</Badge>;
    case "dues":
      return <Badge className="bg-blue-100 text-blue-800">Dues</Badge>;
    case "back_dues":
      return <Badge className="bg-purple-100 text-purple-800">Back Dues</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

export function PaymentDetailsSheet({
  payment,
  open,
  onOpenChange,
  organizationName,
}: PaymentDetailsSheetProps) {
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Payment Receipt</SheetTitle>
          <SheetDescription>
            {formatDate(payment.paidAt || payment.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status & Type */}
          <div className="flex items-center gap-3">
            {getStatusBadge(payment.status)}
            {getTypeBadge(payment.type)}
          </div>

          {/* Amount */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Amount Paid</div>
            <div className="text-3xl font-bold">{formatCurrency(payment.totalCharged || payment.amount)}</div>
            {payment.monthsCredited > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                {payment.monthsCredited} month{payment.monthsCredited > 1 ? "s" : ""} credited
              </div>
            )}
          </div>

          {/* Invoice Number */}
          {payment.invoiceNumber && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Invoice Number
                </div>
                <div className="font-mono">{payment.invoiceNumber}</div>
              </div>
            </>
          )}

          {/* Period */}
          {payment.periodLabel && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Period
              </div>
              <div>{payment.periodLabel}</div>
            </div>
          )}

          <Separator />

          {/* Payment Method */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Payment Method
            </div>
            <div className="font-medium">{getPaymentMethodLabel(payment.method, payment.stripePaymentMethodType)}</div>
            {payment.checkNumber && (
              <div className="text-sm text-muted-foreground">
                Check #{payment.checkNumber}
              </div>
            )}
          </div>

          {/* Organization */}
          {organizationName && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Paid To
                </div>
                <div className="font-medium">{organizationName}</div>
              </div>
            </>
          )}

          {/* Dates */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            {payment.paidAt && (
              <div>
                <div className="text-muted-foreground mb-1">Date Paid</div>
                <div>{formatDate(payment.paidAt)}</div>
              </div>
            )}
            {payment.periodStart && payment.periodEnd && (
              <div>
                <div className="text-muted-foreground mb-1">Coverage Period</div>
                <div>
                  {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
                </div>
              </div>
            )}
          </div>

          {/* Print Button */}
          <Separator />
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePrint}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>

          {/* Transaction ID */}
          <div className="text-xs text-muted-foreground text-center font-mono">
            Transaction ID: {payment.id.slice(0, 8)}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
