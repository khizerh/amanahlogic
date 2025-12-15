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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OnboardingInviteWithMember } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import { Banknote, FileText, Smartphone, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordOnboardingPaymentDialogProps {
  invite: OnboardingInviteWithMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded?: () => void;
}

type PaymentOption = "both" | "enrollment_only" | "dues_only";
type ManualPaymentMethod = "cash" | "check" | "zelle";

export function RecordOnboardingPaymentDialog({
  invite,
  open,
  onOpenChange,
  onPaymentRecorded,
}: RecordOnboardingPaymentDialogProps) {
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("both");
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [zelleTransactionId, setZelleTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setPaymentOption("both");
      setPaymentMethod("cash");
      setCheckNumber("");
      setZelleTransactionId("");
      setNotes("");
    }
    onOpenChange(open);
  };

  if (!invite) return null;

  const hasEnrollmentFee = invite.includesEnrollmentFee && invite.enrollmentFeeAmount > 0;
  const enrollmentFeeAlreadyPaid = !!invite.enrollmentFeePaidAt;
  const duesAlreadyPaid = !!invite.duesPaidAt;

  // Calculate what's actually owed
  const enrollmentFeeOwed = hasEnrollmentFee && !enrollmentFeeAlreadyPaid ? invite.enrollmentFeeAmount : 0;
  const duesOwed = !duesAlreadyPaid ? invite.duesAmount : 0;
  const totalOwed = enrollmentFeeOwed + duesOwed;

  // If everything is already paid, show a message
  if (enrollmentFeeAlreadyPaid && duesAlreadyPaid) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Already Complete</DialogTitle>
            <DialogDescription>
              All onboarding payments have already been recorded for this member.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate amount based on selection
  const getAmountForOption = (option: PaymentOption): number => {
    switch (option) {
      case "both":
        return enrollmentFeeOwed + duesOwed;
      case "enrollment_only":
        return enrollmentFeeOwed;
      case "dues_only":
        return duesOwed;
    }
  };

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
      const response = await fetch("/api/payments/record-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: invite.organizationId,
          membershipId: invite.membershipId,
          memberId: invite.memberId,
          inviteId: invite.id,
          paymentOption,
          enrollmentFeeAmount: enrollmentFeeOwed,
          duesAmount: duesOwed,
          method: paymentMethod,
          checkNumber: checkNumber || undefined,
          zelleTransactionId: zelleTransactionId || undefined,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to record payment");
      }

      const amount = getAmountForOption(paymentOption);
      toast.success(`Payment of ${formatCurrency(amount)} recorded for ${invite.member.firstName} ${invite.member.lastName}`);
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

  // Build payment options based on what's owed
  const paymentOptions: { value: PaymentOption; label: string; amount: number; disabled: boolean }[] = [];

  if (enrollmentFeeOwed > 0 && duesOwed > 0) {
    paymentOptions.push({
      value: "both",
      label: "Enrollment + First Dues",
      amount: enrollmentFeeOwed + duesOwed,
      disabled: false,
    });
  }

  if (enrollmentFeeOwed > 0) {
    paymentOptions.push({
      value: "enrollment_only",
      label: "Enrollment Fee Only",
      amount: enrollmentFeeOwed,
      disabled: false,
    });
  }

  if (duesOwed > 0) {
    paymentOptions.push({
      value: "dues_only",
      label: "First Dues Only",
      amount: duesOwed,
      disabled: false,
    });
  }

  // If only one option, auto-select it
  if (paymentOptions.length === 1 && paymentOption !== paymentOptions[0].value) {
    setPaymentOption(paymentOptions[0].value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Onboarding Payment</DialogTitle>
          <DialogDescription>
            Record payment for {invite.member.firstName} {invite.member.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member Summary */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {invite.member.firstName} {invite.member.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{invite.plan?.name} Plan</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(totalOwed)}
                </p>
                <p className="text-xs text-muted-foreground">total due</p>
              </div>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="text-sm space-y-1 px-1">
            {enrollmentFeeOwed > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrollment Fee</span>
                <span>{formatCurrency(enrollmentFeeOwed)}</span>
              </div>
            )}
            {enrollmentFeeAlreadyPaid && hasEnrollmentFee && (
              <div className="flex justify-between text-green-600">
                <span>Enrollment Fee</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Paid
                </span>
              </div>
            )}
            {duesOwed > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Month Dues</span>
                <span>{formatCurrency(duesOwed)}</span>
              </div>
            )}
            {duesAlreadyPaid && (
              <div className="flex justify-between text-green-600">
                <span>First Month Dues</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Paid
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* What did they pay? */}
          {paymentOptions.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm">What did they pay?</Label>
              <RadioGroup
                value={paymentOption}
                onValueChange={(v) => setPaymentOption(v as PaymentOption)}
                className="space-y-2"
              >
                {paymentOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3">
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      disabled={option.disabled}
                    />
                    <Label
                      htmlFor={option.value}
                      className={cn(
                        "flex-1 flex items-center justify-between cursor-pointer",
                        option.disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span>{option.label}</span>
                      <span className="font-medium">{formatCurrency(option.amount)}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {paymentOptions.length === 1 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">{paymentOptions[0].label}</span>
                <span className="font-medium text-blue-900">
                  {formatCurrency(paymentOptions[0].amount)}
                </span>
              </div>
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
                Record {formatCurrency(getAmountForOption(paymentOption))}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
