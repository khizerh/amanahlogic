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
import { MemberWithMembership, BillingFrequency, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";
import {
  updateBillingFrequency,
  getAmountForFrequency,
  getMonthsForFrequency,
} from "@/lib/mock-data/billing-service";
import { toast } from "sonner";
import {
  Calendar,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  CreditCard,
  Banknote,
} from "lucide-react";

interface ChangeFrequencySheetProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFrequencyChanged?: () => void;
}

export function ChangeFrequencySheet({
  member,
  plan,
  open,
  onOpenChange,
  onFrequencyChanged,
}: ChangeFrequencySheetProps) {
  const [selectedFrequency, setSelectedFrequency] = useState<BillingFrequency>("monthly");
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open && member?.membership) {
      setSelectedFrequency(member.membership.billingFrequency);
    }
  }, [open, member]);

  if (!member || !plan || !member.membership) return null;

  const { membership } = member;
  const currentFrequency = membership.billingFrequency;
  const hasAutoPay = membership.autoPayEnabled;

  const frequencyOptions: { value: BillingFrequency; label: string; months: number }[] = [
    { value: "monthly", label: "Monthly", months: 1 },
    { value: "biannual", label: "Bi-Annual (6 months)", months: 6 },
    { value: "annual", label: "Annual (12 months)", months: 12 },
  ];

  const currentAmount = getAmountForFrequency(plan.id, currentFrequency);
  const newAmount = getAmountForFrequency(plan.id, selectedFrequency);
  const currentMonths = getMonthsForFrequency(currentFrequency);
  const newMonths = getMonthsForFrequency(selectedFrequency);

  const hasChanges = selectedFrequency !== currentFrequency;

  const getFrequencyLabel = (freq: BillingFrequency) => {
    switch (freq) {
      case "monthly":
        return "Monthly";
      case "biannual":
        return "Bi-Annual";
      case "annual":
        return "Annual";
      default:
        return freq;
    }
  };

  const handleUpdateFrequency = async () => {
    if (!hasChanges) return;

    setIsUpdating(true);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const result = updateBillingFrequency({
        membershipId: membership.id,
        newFrequency: selectedFrequency,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update frequency");
      }

      toast.success("Billing frequency updated", {
        description: `Changed from ${getFrequencyLabel(currentFrequency)} to ${getFrequencyLabel(selectedFrequency)}`,
      });

      onOpenChange(false);
      onFrequencyChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast.error("Failed to update frequency", { description: message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Change Billing Frequency
          </SheetTitle>
          <SheetDescription>
            Update how often {member.firstName} is billed for dues
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Status */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              {hasAutoPay ? (
                <CreditCard className="h-5 w-5 text-blue-600" />
              ) : (
                <Banknote className="h-5 w-5 text-green-600" />
              )}
              <div>
                <p className="font-medium">
                  {hasAutoPay ? "Auto-Pay Enabled" : "Manual Payments"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasAutoPay
                    ? "Stripe subscription will be updated"
                    : "Change takes effect on next payment"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">
                {getFrequencyLabel(currentFrequency)} @ {formatCurrency(currentAmount)}
              </span>
            </div>
          </div>

          <Separator />

          {/* Frequency Selection */}
          <div className="space-y-3">
            <Label>Select New Frequency</Label>
            <RadioGroup
              value={selectedFrequency}
              onValueChange={(value) => setSelectedFrequency(value as BillingFrequency)}
              className="space-y-3"
            >
              {frequencyOptions.map((option) => {
                const amount = getAmountForFrequency(plan.id, option.value);
                const isCurrent = option.value === currentFrequency;
                return (
                  <div
                    key={option.value}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedFrequency === option.value
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedFrequency(option.value)}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <div>
                        <Label htmlFor={option.value} className="font-medium cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          +{option.months} {option.months === 1 ? "month" : "months"} per payment
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(amount)}</p>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Change Summary */}
          {hasChanges && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label>Change Summary</Label>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">From</p>
                      <p className="font-medium">{getFrequencyLabel(currentFrequency)}</p>
                      <p className="text-sm">{formatCurrency(currentAmount)}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">To</p>
                      <p className="font-medium">{getFrequencyLabel(selectedFrequency)}</p>
                      <p className="text-sm">{formatCurrency(newAmount)}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Months per payment</span>
                    <span>
                      {currentMonths} <ArrowRight className="h-3 w-3 inline mx-1" /> {newMonths}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Effective</span>
                    <span className="font-medium">Next payment</span>
                  </div>
                </div>

                {/* Auto-pay warning */}
                {hasAutoPay && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This member has auto-pay enabled. In production, this would update their
                      Stripe subscription to the new billing interval.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateFrequency}
            disabled={isUpdating || !hasChanges}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Update Frequency
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
