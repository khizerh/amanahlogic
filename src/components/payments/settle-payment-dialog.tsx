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
import { PaymentWithDetails } from "@/lib/database/payments";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { Banknote, FileText, Smartphone, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettlePaymentDialogProps {
  payment: PaymentWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentSettled?: () => void;
}

type ManualPaymentMethod = "cash" | "check" | "zelle";

export function SettlePaymentDialog({
  payment,
  open,
  onOpenChange,
  onPaymentSettled,
}: SettlePaymentDialogProps) {
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
      const response = await fetch("/api/payments/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: payment.organizationId,
          membershipId: payment.membershipId,
          memberId: payment.memberId,
          pendingPaymentId: payment.id,
          type: payment.type,
          method: paymentMethod,
          amount: payment.amount,
          monthsCredited: payment.monthsCredited,
          checkNumber: checkNumber || undefined,
          zelleTransactionId: zelleTransactionId || undefined,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to settle payment");
      }

      toast.success(`Payment of ${formatCurrency(payment.amount)} marked as paid`);
      onOpenChange(false);
      onPaymentSettled?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to settle payment";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const memberName = payment.member
    ? `${payment.member.firstName} ${payment.member.middleName ? `${payment.member.middleName} ` : ''}${payment.member.lastName}`
    : "Unknown Member";

  const paymentTypeLabel =
    payment.type === "enrollment_fee"
      ? "Enrollment Fee"
      : payment.type === "back_dues"
      ? "Back Dues"
      : "Dues";

  const methods: { value: ManualPaymentMethod; label: string; icon: typeof Banknote }[] = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "check", label: "Check", icon: FileText },
    { value: "zelle", label: "Zelle", icon: Smartphone },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
          <DialogDescription>
            Confirm payment received for this pending charge
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Compact Payment Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <p className="font-medium text-sm">{memberName}</p>
              <p className="text-xs text-muted-foreground">
                {paymentTypeLabel}
                {payment.monthsCredited > 0 && ` • ${payment.monthsCredited} mo`}
                {payment.dueDate && ` • Due ${formatDate(payment.dueDate)}`}
              </p>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(payment.amount)}
            </p>
          </div>

          <Separator />

          {/* Payment Method - Compact Button Group */}
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

          {/* Notes - Collapsed by default feel */}
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
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Mark as Paid
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
