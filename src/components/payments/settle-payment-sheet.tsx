"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { PaymentWithDetails } from "@/lib/database/payments";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { toast } from "sonner";
import { Banknote, FileText, Smartphone, CheckCircle2 } from "lucide-react";

interface SettlePaymentSheetProps {
  payment: PaymentWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentSettled?: () => void;
}

type ManualPaymentMethod = "cash" | "check" | "zelle";

export function SettlePaymentSheet({
  payment,
  open,
  onOpenChange,
  onPaymentSettled,
}: SettlePaymentSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [zelleTransactionId, setZelleTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when sheet opens
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

      toast.success(`Payment of ${formatCurrency(payment.amount)} recorded`);
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
    ? `${payment.member.firstName} ${payment.member.lastName}`
    : "Unknown Member";

  const paymentTypeLabel =
    payment.type === "enrollment_fee"
      ? "Enrollment Fee"
      : payment.type === "back_dues"
      ? "Back Dues"
      : "Dues";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Record Payment</SheetTitle>
          <SheetDescription>
            Mark this pending payment as paid
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Payment Summary - Read Only */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member</span>
              <span className="font-medium">{memberName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{paymentTypeLabel}</span>
            </div>
            {payment.monthsCredited > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Months</span>
                <span className="font-medium">{payment.monthsCredited}</span>
              </div>
            )}
            {payment.dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">{formatDate(payment.dueDate)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Amount</span>
              <span className="text-xl font-bold text-green-600">
                {formatCurrency(payment.amount)}
              </span>
            </div>
          </div>

          <Separator />

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>How did they pay?</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as ManualPaymentMethod)}
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                <Label
                  htmlFor="cash"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Banknote className="mb-2 h-5 w-5" />
                  <span className="text-sm">Cash</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="check" id="check" className="peer sr-only" />
                <Label
                  htmlFor="check"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileText className="mb-2 h-5 w-5" />
                  <span className="text-sm">Check</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="zelle" id="zelle" className="peer sr-only" />
                <Label
                  htmlFor="zelle"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Smartphone className="mb-2 h-5 w-5" />
                  <span className="text-sm">Zelle</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Check Number */}
          {paymentMethod === "check" && (
            <div className="space-y-2">
              <Label htmlFor="checkNumber">
                Check Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="checkNumber"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Enter check number"
              />
            </div>
          )}

          {/* Zelle Transaction ID */}
          {paymentMethod === "zelle" && (
            <div className="space-y-2">
              <Label htmlFor="zelleTransactionId">
                Zelle Transaction ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="zelleTransactionId"
                value={zelleTransactionId}
                onChange={(e) => setZelleTransactionId(e.target.value)}
                placeholder="Enter Zelle transaction ID"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
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
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Paid
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
