"use client";

import { useState, useEffect } from "react";
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
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { Banknote, FileText, Smartphone, CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemberWithMembership, Plan } from "@/lib/types";

interface RecordMemberDuesDialogProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded?: () => void;
  overrideActiveSubscription?: boolean;
}

type ManualPaymentMethod = "cash" | "check" | "zelle";

export function RecordMemberDuesDialog({
  member,
  plan,
  open,
  onOpenChange,
  onPaymentRecorded,
  overrideActiveSubscription,
}: RecordMemberDuesDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [zelleTransactionId, setZelleTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPaymentMethod("cash");
      setCheckNumber("");
      setZelleTransactionId("");
      setNotes("");
    }
  }, [open]);

  if (!member || !plan) return null;

  const { membership } = member;
  if (!membership) return null;

  // Check if member has active Stripe subscription
  const hasActiveSubscription =
    membership.autoPayEnabled &&
    membership.stripeSubscriptionId &&
    (membership.subscriptionStatus === "active" ||
      membership.subscriptionStatus === "past_due");

  // Calculate dues amount based on billing frequency
  const billingFrequency = membership.billingFrequency || "monthly";
  const duesAmount = plan.pricing[billingFrequency];
  const monthsCredited =
    billingFrequency === "monthly" ? 1 : billingFrequency === "biannual" ? 6 : 12;

  // Check if member actually owes anything
  const today = new Date().toISOString().split("T")[0];
  const nextPaymentDue = membership.nextPaymentDue;
  const isOverdue = nextPaymentDue && nextPaymentDue <= today;
  const isPaidAhead = nextPaymentDue && nextPaymentDue > today;

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
          organizationId: membership.organizationId,
          membershipId: membership.id,
          memberId: member.id,
          type: "dues",
          method: paymentMethod,
          amount: duesAmount,
          monthsCredited,
          checkNumber: checkNumber || undefined,
          zelleTransactionId: zelleTransactionId || undefined,
          notes: notes || undefined,
          ...(overrideActiveSubscription && { overrideActiveSubscription: true }),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to record payment");
      }

      toast.success(
        `Payment of ${formatCurrency(duesAmount)} recorded for ${member.firstName} ${member.middleName ? `${member.middleName} ` : ''}${member.lastName}`
      );
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

  const getBillingLabel = (frequency: string) => {
    switch (frequency) {
      case "monthly":
        return "Monthly";
      case "biannual":
        return "Bi-Annual (6 mo)";
      case "annual":
        return "Annual (12 mo)";
      default:
        return frequency;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a manual payment for {member.firstName} {member.middleName ? `${member.middleName} ` : ''}{member.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Block if active Stripe subscription */}
          {hasActiveSubscription ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-red-900">Cannot Record Manual Payment</p>
                  <p className="text-sm text-red-700 mt-1">
                    This member has an active Stripe subscription. Recording a manual payment
                    would cause double billing.
                  </p>
                  <p className="text-sm text-red-700 mt-2">
                    To record a manual payment, first switch them to manual payments from their
                    member profile.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* Payment Summary */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {member.firstName} {member.middleName ? `${member.middleName} ` : ''}{member.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{plan.name} Plan</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(duesAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getBillingLabel(billingFrequency)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">
                    {membership.paidMonths}/60 months
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    +{monthsCredited} month{monthsCredited > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Info if paid ahead */}
              {isPaidAhead && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-800">
                    Member is paid through{" "}
                    <span className="font-medium">{formatDate(nextPaymentDue)}</span>.
                    Recording this payment will extend their coverage.
                  </p>
                </div>
              )}

              {/* Overdue warning */}
              {isOverdue && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    Payment was due on{" "}
                    <span className="font-medium">{formatDate(nextPaymentDue)}</span>.
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
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          paymentMethod === value ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          paymentMethod === value ? "text-primary" : "text-muted-foreground"
                        )}
                      >
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
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Record Payment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
