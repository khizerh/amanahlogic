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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MemberWithMembership, PaymentType, PaymentMethod, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  Banknote,
  FileText,
  Smartphone,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface RecordPaymentSheetProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded?: () => void;
}

type ManualPaymentMethod = "cash" | "check" | "zelle";

export function RecordPaymentSheet({
  member,
  plan,
  open,
  onOpenChange,
  onPaymentRecorded,
}: RecordPaymentSheetProps) {
  // Form state
  const [paymentType, setPaymentType] = useState<PaymentType>("dues");
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [checkNumber, setCheckNumber] = useState("");
  const [zelleTransactionId, setZelleTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when sheet opens/closes or member changes
  useEffect(() => {
    if (open) {
      // Default to enrollment fee if not paid, otherwise dues
      if (member?.membership && !member.membership.enrollmentFeePaid) {
        setPaymentType("enrollment_fee");
      } else {
        setPaymentType("dues");
      }
      setPaymentMethod("cash");
      setMonthsCount(1);
      setCustomAmount("");
      setUseCustomAmount(false);
      setCheckNumber("");
      setZelleTransactionId("");
      setNotes("");
    }
  }, [open, member]);

  if (!member || !plan) return null;

  const { membership } = member;
  const enrollmentFeePaid = membership?.enrollmentFeePaid ?? false;
  const enrollmentFeeAmount = plan.enrollmentFee;

  // Calculate amount based on payment type and months
  const calculateAmount = (): number => {
    if (useCustomAmount && customAmount) {
      return parseFloat(customAmount) || 0;
    }

    if (paymentType === "enrollment_fee") {
      return enrollmentFeeAmount;
    }

    // For dues/back_dues, calculate based on plan pricing
    const monthlyRate = plan.pricing.monthly;
    return monthlyRate * monthsCount;
  };

  const amount = calculateAmount();
  const monthsCredited = paymentType === "enrollment_fee" ? 0 : monthsCount;

  // Quick select options for months
  const monthOptions = [
    { value: 1, label: "1 month", price: plan.pricing.monthly },
    { value: 3, label: "3 months", price: plan.pricing.monthly * 3 },
    { value: 6, label: "6 months", price: plan.pricing.biannual },
    { value: 12, label: "12 months", price: plan.pricing.annual },
  ];

  const handleSubmit = async () => {
    // Validation
    if (paymentMethod === "check" && !checkNumber.trim()) {
      toast.error("Please enter the check number");
      return;
    }

    if (paymentMethod === "zelle" && !zelleTransactionId.trim()) {
      toast.error("Please enter the Zelle transaction ID");
      return;
    }

    if (amount <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real app, this would call an API to create the payment
      // For now, we'll simulate success
      await new Promise((resolve) => setTimeout(resolve, 500));

      const paymentTypeLabel =
        paymentType === "enrollment_fee"
          ? "Enrollment fee"
          : paymentType === "back_dues"
          ? "Back dues"
          : "Dues";

      toast.success(
        `${paymentTypeLabel} payment of ${formatCurrency(amount)} recorded successfully`
      );

      onOpenChange(false);
      onPaymentRecorded?.();
    } catch (error) {
      toast.error("Failed to record payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Record Payment</SheetTitle>
          <SheetDescription>
            Record a manual payment for {member.firstName} {member.lastName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Member Info Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{plan.name} Plan</p>
              </div>
              <Badge variant="info">{formatCurrency(plan.pricing.monthly)}/mo</Badge>
            </div>
            {membership && (
              <div className="mt-2 text-sm text-muted-foreground">
                {membership.paidMonths} months paid
                {!enrollmentFeePaid && (
                  <span className="text-amber-600 ml-2">
                    (Enrollment fee not paid)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Enrollment Fee Alert */}
          {!enrollmentFeePaid && paymentType !== "enrollment_fee" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This member hasn&apos;t paid the {formatCurrency(enrollmentFeeAmount)}{" "}
                enrollment fee yet. Consider collecting it first.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Payment Type */}
          <div className="space-y-3">
            <Label>Payment Type</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(value) => setPaymentType(value as PaymentType)}
            >
              {!enrollmentFeePaid && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enrollment_fee" id="enrollment_fee" />
                  <Label htmlFor="enrollment_fee" className="font-normal cursor-pointer">
                    Enrollment Fee ({formatCurrency(enrollmentFeeAmount)})
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dues" id="dues" />
                <Label htmlFor="dues" className="font-normal cursor-pointer">
                  Regular Dues
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="back_dues" id="back_dues" />
                <Label htmlFor="back_dues" className="font-normal cursor-pointer">
                  Back Dues (Catch-up Payment)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Months Selection (for dues/back_dues only) */}
          {paymentType !== "enrollment_fee" && (
            <div className="space-y-3">
              <Label>Months to Credit</Label>
              <div className="grid grid-cols-2 gap-2">
                {monthOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={monthsCount === option.value ? "default" : "outline"}
                    className="justify-between"
                    onClick={() => {
                      setMonthsCount(option.value);
                      setUseCustomAmount(false);
                    }}
                  >
                    <span>{option.label}</span>
                    <span className="text-xs opacity-70">
                      {formatCurrency(option.price)}
                    </span>
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={monthsCount}
                  onChange={(e) => {
                    setMonthsCount(parseInt(e.target.value) || 1);
                    setUseCustomAmount(false);
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  months @ {formatCurrency(plan.pricing.monthly)}/mo
                </span>
              </div>
            </div>
          )}

          <Separator />

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Payment Method</Label>
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

          {/* Check Number (if check) */}
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

          {/* Zelle Transaction ID (if zelle) */}
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

          {/* Custom Amount Override */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="customAmount">Amount Override (Optional)</Label>
              {useCustomAmount && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUseCustomAmount(false);
                    setCustomAmount("");
                  }}
                >
                  Reset to calculated
                </Button>
              )}
            </div>
            <Input
              id="customAmount"
              type="number"
              min="0"
              step="0.01"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setUseCustomAmount(true);
              }}
              placeholder={`Calculated: ${formatCurrency(calculateAmount())}`}
            />
            <p className="text-xs text-muted-foreground">
              Only use this to override the calculated amount for special cases
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this payment..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Payment Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Type</span>
              <span className="font-medium">
                {paymentType === "enrollment_fee"
                  ? "Enrollment Fee"
                  : paymentType === "back_dues"
                  ? "Back Dues"
                  : "Regular Dues"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium capitalize">{paymentMethod}</span>
            </div>
            {paymentType !== "enrollment_fee" && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Months Credited</span>
                <span className="font-medium">{monthsCredited}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Total Amount</span>
              <span className="text-xl font-bold text-green-600">
                {formatCurrency(amount)}
              </span>
            </div>
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
                Record Payment
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
