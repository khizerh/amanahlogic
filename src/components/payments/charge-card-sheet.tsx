"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MemberWithMembership, PaymentType, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";
import { recordPayment, type RecordPaymentResult } from "@/lib/mock-data/billing-service";
import { toast } from "sonner";
import {
  CreditCard,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  TrendingUp,
  ArrowRight,
  Award,
  Zap,
} from "lucide-react";

interface ChargeCardSheetProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded?: () => void;
}

export function ChargeCardSheet({
  member,
  plan,
  open,
  onOpenChange,
  onPaymentRecorded,
}: ChargeCardSheetProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>("dues");
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open && member?.membership) {
      if (!member.membership.enrollmentFeePaid) {
        setPaymentType("enrollment_fee");
      } else {
        setPaymentType("dues");
      }
      // Default to billing frequency
      switch (member.membership.billingFrequency) {
        case "biannual":
          setMonthsCount(6);
          break;
        case "annual":
          setMonthsCount(12);
          break;
        default:
          setMonthsCount(1);
      }
    }
  }, [open, member]);

  if (!member || !plan) return null;

  const { membership } = member;
  const paymentMethod = membership?.paymentMethod;

  if (!paymentMethod) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Charge Card</SheetTitle>
          </SheetHeader>
          <div className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No payment method on file for this member.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const enrollmentFeePaid = membership?.enrollmentFeePaid ?? false;
  const enrollmentFeeAmount = plan.enrollmentFee;

  // Calculate amounts
  const baseAmount =
    paymentType === "enrollment_fee"
      ? enrollmentFeeAmount
      : plan.pricing.monthly * monthsCount;

  // Stripe fee: 2.9% + $0.30
  const stripeFee = parseFloat((baseAmount * 0.029 + 0.3).toFixed(2));
  const platformFee = 1.0;
  const totalCharged = baseAmount + stripeFee;
  const monthsCredited = paymentType === "enrollment_fee" ? 0 : monthsCount;

  // Quick select options
  const monthOptions = [
    { value: 1, label: "1 month", price: plan.pricing.monthly },
    { value: 6, label: "6 months", price: plan.pricing.biannual },
    { value: 12, label: "12 months", price: plan.pricing.annual },
  ];

  const handleCharge = async () => {
    if (!membership) return;

    setIsProcessing(true);

    try {
      // Simulate Stripe API call delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Record the payment via billing service
      const result: RecordPaymentResult = recordPayment({
        memberId: member.id,
        membershipId: membership.id,
        planId: plan.id,
        type: paymentType,
        method: paymentMethod.type === "card" ? "card" : "ach",
        amount: baseAmount,
        monthsCredited,
        notes: `Charged ${paymentMethod.type === "card" ? paymentMethod.brand?.toUpperCase() : paymentMethod.bankName} •••• ${paymentMethod.last4}`,
        recordedBy: "Admin User",
      });

      if (!result.success) {
        throw new Error(result.error || "Payment failed");
      }

      // Success message
      const paymentTypeLabel =
        paymentType === "enrollment_fee" ? "Enrollment fee" : "Dues";

      if (result.statusChanged && result.newStatus === "active") {
        toast.success(`${paymentTypeLabel} of ${formatCurrency(baseAmount)} charged successfully`, {
          duration: 5000,
          description: `${member.firstName} has reached 60 paid months and is now fully eligible for benefits!`,
        });
      } else {
        toast.success(`${paymentTypeLabel} of ${formatCurrency(baseAmount)} charged successfully`, {
          description: result.membership
            ? `Progress: ${result.membership.paidMonths}/60 months`
            : undefined,
        });
      }

      onOpenChange(false);
      onPaymentRecorded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      toast.error("Failed to process payment", {
        description: message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Charge Card
          </SheetTitle>
          <SheetDescription>
            Charge {member.firstName} {member.lastName}&apos;s payment method
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Payment Method Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-5 shadow-lg">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2">
                {paymentMethod.type === "card" ? (
                  <CreditCard className="h-6 w-6" />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
                <span className="text-sm font-medium opacity-80">
                  {paymentMethod.type === "card" ? "Credit Card" : "Bank Account"}
                </span>
              </div>
              <Lock className="h-4 w-4 opacity-50" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-mono tracking-wider">
                •••• •••• •••• {paymentMethod.last4}
              </p>
              <p className="text-sm opacity-70">
                {paymentMethod.type === "card"
                  ? `${paymentMethod.brand?.toUpperCase()} ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}`
                  : paymentMethod.bankName}
              </p>
            </div>
            <p className="mt-4 text-sm font-medium">
              {member.firstName} {member.lastName}
            </p>
          </div>

          {/* Enrollment Fee Alert */}
          {!enrollmentFeePaid && paymentType !== "enrollment_fee" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enrollment fee of {formatCurrency(enrollmentFeeAmount)} has not been paid.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Payment Type */}
          <div className="space-y-3">
            <Label>What to charge</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(value) => setPaymentType(value as PaymentType)}
            >
              {!enrollmentFeePaid && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enrollment_fee" id="cf_enrollment" />
                  <Label htmlFor="cf_enrollment" className="font-normal cursor-pointer">
                    Enrollment Fee ({formatCurrency(enrollmentFeeAmount)})
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dues" id="cf_dues" />
                <Label htmlFor="cf_dues" className="font-normal cursor-pointer">
                  Membership Dues
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Months Selection (for dues only) */}
          {paymentType !== "enrollment_fee" && (
            <div className="space-y-3">
              <Label>Period</Label>
              <div className="grid grid-cols-3 gap-2">
                {monthOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={monthsCount === option.value ? "default" : "outline"}
                    className="flex-col h-auto py-3"
                    onClick={() => setMonthsCount(option.value)}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs opacity-70">
                      {formatCurrency(option.price)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Billing Impact Preview */}
          {membership && paymentType !== "enrollment_fee" && (
            <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-medium">
                <TrendingUp className="h-4 w-4" />
                <span>Impact</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium">{membership.paidMonths}/60</span>
                <ArrowRight className="h-4 w-4 text-blue-500" />
                <span className="font-bold text-blue-700">
                  {membership.paidMonths + monthsCredited}/60
                </span>
                <span className="text-muted-foreground">
                  (+{monthsCredited} {monthsCredited === 1 ? "month" : "months"})
                </span>
              </div>
              {membership.paidMonths < 60 &&
                membership.paidMonths + monthsCredited >= 60 && (
                  <div className="flex items-center gap-2 bg-green-100 text-green-800 rounded-md px-3 py-2">
                    <Award className="h-5 w-5" />
                    <span className="font-semibold">
                      Will become ELIGIBLE!
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Charge Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {paymentType === "enrollment_fee" ? "Enrollment Fee" : "Dues Amount"}
              </span>
              <span className="font-medium">{formatCurrency(baseAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processing Fee (2.9% + $0.30)</span>
              <span className="font-medium">{formatCurrency(stripeFee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Total to Charge</span>
              <span className="text-xl font-bold">{formatCurrency(totalCharged)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Organization receives {formatCurrency(baseAmount - platformFee)} after fees
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCharge}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Charge {formatCurrency(totalCharged)}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
