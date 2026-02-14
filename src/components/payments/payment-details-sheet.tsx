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
import { PaymentWithDetails } from "@/lib/database/payments";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import Link from "next/link";
import { toast } from "sonner";

interface PaymentDetailsSheetProps {
  payment: PaymentWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getPaymentMethodLabel = (method: string, stripePaymentMethodType?: string | null) => {
  if (method === "stripe") {
    if (stripePaymentMethodType === "us_bank_account") return "Bank Transfer (ACH)";
    if (stripePaymentMethodType === "card") return "Credit/Debit Card";
    if (stripePaymentMethodType === "link") return "Stripe Link";
    return "Stripe";
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
      return <Badge variant="success">Completed</Badge>;
    case "pending":
      return <Badge variant="warning">Pending</Badge>;
    case "processing":
      return <Badge variant="info">Processing</Badge>;
    case "failed":
      return <Badge variant="error">Failed</Badge>;
    case "refunded":
      return <Badge variant="refunded">Refunded</Badge>;
    default:
      return <Badge variant="inactive">{status}</Badge>;
  }
};

const getTypeBadge = (type: string) => {
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

export function PaymentDetailsSheet({
  payment,
  open,
  onOpenChange,
}: PaymentDetailsSheetProps) {
  if (!payment) return null;

  const handleEmailReceipt = () => {
    toast.success(`Receipt emailed to ${payment.member?.email || "member"}`);
  };

  const handleRefund = () => {
    toast.info("Refund functionality coming soon");
  };

  const isManualPayment = ["cash", "check", "zelle"].includes(payment.method);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Payment Details</SheetTitle>
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
            <div className="text-sm text-muted-foreground mb-1">Amount</div>
            <div className="text-3xl font-bold">{formatCurrency(payment.amount)}</div>
            {payment.monthsCredited > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Credits {payment.monthsCredited} month{payment.monthsCredited > 1 ? "s" : ""}
              </div>
            )}
          </div>

          <Separator />

          {/* Member Info */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Member</div>
            {payment.member ? (
              <div>
                <Link
                  href={`/members/${payment.member.id}`}
                  className="font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {payment.member.firstName} {payment.member.middleName ? `${payment.member.middleName} ` : ''}{payment.member.lastName}
                </Link>
                <div className="text-sm text-muted-foreground">{payment.member.email || "No email"}</div>
              </div>
            ) : (
              <span className="text-muted-foreground">Unknown member</span>
            )}
          </div>

          <Separator />

          {/* Payment Method */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Payment Method
            </div>
            <div>
              <div className="font-medium">{getPaymentMethodLabel(payment.method, payment.stripePaymentMethodType)}</div>
              {payment.stripePaymentIntentId && (
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {payment.stripePaymentIntentId}
                </div>
              )}
              {isManualPayment && payment.recordedBy && (
                <div className="text-sm text-muted-foreground">
                  Recorded by {payment.recordedBy}
                </div>
              )}
              {payment.checkNumber && (
                <div className="text-sm text-muted-foreground">
                  Check #{payment.checkNumber}
                </div>
              )}
              {payment.zelleTransactionId && (
                <div className="text-xs text-muted-foreground font-mono">
                  Zelle: {payment.zelleTransactionId}
                </div>
              )}
            </div>
          </div>

          {/* Fee Breakdown (for non-manual payments) */}
          {!isManualPayment && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-3">
                  Fee Breakdown
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Amount</span>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Fee</span>
                    <span>{formatCurrency(payment.stripeFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee</span>
                    <span>{formatCurrency(payment.platformFee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total Charged</span>
                    <span>{formatCurrency(payment.totalCharged)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Net to Organization</span>
                    <span>{formatCurrency(payment.netAmount)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes (for manual payments) */}
          {payment.notes && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
                <div className="text-sm bg-muted/50 rounded-lg p-3">{payment.notes}</div>
              </div>
            </>
          )}

          {/* Dates */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Created</div>
              <div>{formatDate(payment.createdAt)}</div>
            </div>
            {payment.paidAt && (
              <div>
                <div className="text-muted-foreground mb-1">Paid</div>
                <div>{formatDate(payment.paidAt)}</div>
              </div>
            )}
          </div>

          {/* ID */}
          <div className="text-xs text-muted-foreground font-mono">
            {payment.id}
          </div>

          {/* Actions */}
          {payment.status === "completed" && (
            <>
              <Separator />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleEmailReceipt}
                >
                  Email Receipt
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleRefund}
                >
                  Refund
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
