"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { Banknote, FileText, Smartphone, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// Matches the OutstandingPayment type from outstanding-columns.tsx
interface OutstandingPayment {
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
  autoPayEnabled: boolean;
}

interface RecordOutstandingPaymentDialogProps {
  payment: OutstandingPayment | null;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded?: () => void;
}

type ManualPaymentMethod = "cash" | "check" | "zelle";

export function RecordOutstandingPaymentDialog({
  payment,
  organizationId,
  open,
  onOpenChange,
  onPaymentRecorded,
}: RecordOutstandingPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [zelleTransactionId, setZelleTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setPaymentMethod("cash");
      setCheckNumber("");
      setZelleTransactionId("");
      setNotes("");
    }
    onOpenChange(open);
  };

  if (!payment) return null;

  const handleSubmit = async () => {
    if (paymentMethod === "check" && !checkNumber.trim()) {
      toast.error("Please enter the check number");
      return;
    }

    if (paymentMethod === "zelle" && !zelleTransactionId.trim()) {
      toast.error("Please enter the Zelle transaction ID");
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine months credited (default to 1 if we can't calculate)
      // In a real implementation, you'd fetch the plan's monthly rate
      const monthsCredited = 1; // Safe default for dues

      const response = await fetch("/api/payments/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          membershipId: payment.membershipId,
          memberId: payment.memberId,
          // For failed payments (actual records), pass the ID to settle it
          // For overdue (computed), we create a new payment
          pendingPaymentId: payment.type === "failed" && !payment.id.startsWith("overdue_")
            ? payment.id
            : undefined,
          type: "dues", // Outstanding payments are typically dues
          method: paymentMethod,
          amount: payment.amountDue,
          monthsCredited,
          checkNumber: checkNumber || undefined,
          zelleTransactionId: zelleTransactionId || undefined,
          notes: notes || `Recorded for outstanding payment (${payment.daysOverdue} days overdue)`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to record payment");
      }

      toast.success(`Payment of ${formatCurrency(payment.amountDue)} recorded for ${payment.memberName}`);
      onOpenChange(false);
      onPaymentRecorded?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to record payment";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods: { value: ManualPaymentMethod; label: string; icon: typeof Banknote }[] = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "check", label: "Check", icon: FileText },
    { value: "zelle", label: "Zelle", icon: Smartphone },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record payment received for this outstanding balance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{payment.memberName}</p>
                <p className="text-sm text-muted-foreground">{payment.planName}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(payment.amountDue)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <Badge
                variant={payment.type === "failed" ? "error" : "warning"}
                className="text-xs"
              >
                {payment.type === "failed" ? "Failed Charge" : "Overdue"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {payment.daysOverdue} days overdue
              </span>
            </div>
          </div>

          {/* Warning for autopay members */}
          {payment.autoPayEnabled && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                This member has auto-pay enabled. Recording a manual payment won&apos;t cancel their subscription.
              </p>
            </div>
          )}

          <Separator />

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm">How did they pay?</Label>
            <div className="grid grid-cols-3 gap-2">
              {methods.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors",
                    paymentMethod === value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/25 hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5",
                    paymentMethod === value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    paymentMethod === value ? "text-primary" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Fields */}
          {paymentMethod === "check" && (
            <div className="space-y-1.5">
              <Label htmlFor="checkNumber" className="text-sm">
                Check Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkNumber"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g. 1234"
                className="h-9"
              />
            </div>
          )}

          {paymentMethod === "zelle" && (
            <div className="space-y-1.5">
              <Label htmlFor="zelleTransactionId" className="text-sm">
                Zelle Transaction ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zelleTransactionId"
                value={zelleTransactionId}
                onChange={(e) => setZelleTransactionId(e.target.value)}
                placeholder="e.g. TXN123456"
                className="h-9"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm text-muted-foreground">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              "Recording..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Record Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
