"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MemberWithMembership, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  Banknote,
  CreditCard,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

interface CollectPaymentDialogProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectManual: () => void;
  onSelectChargeCard: () => void;
  payerMemberName?: string | null;
}

export function CollectPaymentDialog({
  member,
  plan,
  open,
  onOpenChange,
  onSelectManual,
  onSelectChargeCard,
  payerMemberName,
}: CollectPaymentDialogProps) {
  if (!member || !plan) return null;

  const { membership } = member;
  const hasCardOnFile = membership?.autoPayEnabled && membership?.paymentMethod;
  const hasActiveSubscription =
    membership?.autoPayEnabled &&
    membership?.stripeSubscriptionId &&
    (membership?.subscriptionStatus === "active" ||
      membership?.subscriptionStatus === "past_due");

  // Calculate what's owed
  const duesAmount = plan.pricing[membership?.billingFrequency || "monthly"];
  const enrollmentFeeDue = membership && membership.enrollmentFeeStatus === "unpaid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Choose how to collect payment from {member.firstName} {member.middleName ? `${member.middleName} ` : ''}{member.lastName}
          </DialogDescription>
        </DialogHeader>

        {/* Member Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {member.firstName} {member.middleName ? `${member.middleName} ` : ''}{member.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{plan.name} Plan</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{formatCurrency(duesAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {membership?.billingFrequency === "monthly"
                  ? "per month"
                  : membership?.billingFrequency === "biannual"
                  ? "bi-annually"
                  : "annually"}
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {membership?.paidMonths || 0}/60 months
            </span>
            {enrollmentFeeDue && (
              <Badge variant="warning" className="text-xs">
                Enrollment fee due
              </Badge>
            )}
            {hasActiveSubscription && (
              <Badge variant="success" className="text-xs">
                Auto-pay active
              </Badge>
            )}
          </div>
        </div>

        {/* Payment Options */}
        <div className="space-y-3 pt-2">
          {/* Payer-funded warning when recording manual payment on active subscription */}
          {hasActiveSubscription && payerMemberName && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800">
                This member has an active subscription paid by <span className="font-medium">{payerMemberName}</span>. Recording a manual payment is for catch-ups or corrections only.
              </p>
            </div>
          )}

          {/* Record Manual Payment - for members without active subscription, or payer-funded catch-ups */}
          {(!hasActiveSubscription || payerMemberName) && (
            <button
              onClick={() => {
                onOpenChange(false);
                onSelectManual();
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">Record Manual Payment</p>
                <p className="text-sm text-muted-foreground">
                  Cash, check, or Zelle received offline
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}

          {/* Charge Card on File - only when there's actually a card */}
          {hasCardOnFile && membership?.paymentMethod && (
            <button
              onClick={() => {
                onOpenChange(false);
                onSelectChargeCard();
              }}
              className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">Charge Card on File</p>
                <p className="text-sm text-muted-foreground">
                  {membership.paymentMethod.type === "card"
                    ? `${membership.paymentMethod.brand?.toUpperCase() || 'Card'} •••• ${membership.paymentMethod.last4}`
                    : `${membership.paymentMethod.bankName || 'Bank Account'} •••• ${membership.paymentMethod.last4}`}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
