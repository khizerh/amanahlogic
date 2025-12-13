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
import { formatCurrency } from "@/lib/mock-data";
import {
  Banknote,
  CreditCard,
  Send,
  ChevronRight,
  Zap,
} from "lucide-react";

interface CollectPaymentDialogProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectManual: () => void;
  onSelectChargeCard: () => void;
  onSelectSendLink: () => void;
}

export function CollectPaymentDialog({
  member,
  plan,
  open,
  onOpenChange,
  onSelectManual,
  onSelectChargeCard,
  onSelectSendLink,
}: CollectPaymentDialogProps) {
  if (!member || !plan) return null;

  const { membership } = member;
  const hasCardOnFile = membership?.autoPayEnabled && membership?.paymentMethod;
  const hasSubscription = membership?.stripeSubscriptionId;
  const subscriptionActive = membership?.subscriptionStatus === "active";

  // Calculate what's owed
  const duesAmount = plan.pricing[membership?.billingFrequency || "monthly"];
  const enrollmentFeeDue = membership && !membership.enrollmentFeePaid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Choose how to collect payment from {member.firstName} {member.lastName}
          </DialogDescription>
        </DialogHeader>

        {/* Member Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {member.firstName} {member.lastName}
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
            {hasSubscription && subscriptionActive && (
              <Badge variant="success" className="text-xs">
                Auto-pay active
              </Badge>
            )}
          </div>
        </div>

        {/* Payment Options */}
        <div className="space-y-3 pt-2">
          {/* Option 1: Record Manual Payment */}
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

          {/* Option 2: Charge Card (if has card on file) */}
          <button
            onClick={() => {
              onOpenChange(false);
              onSelectChargeCard();
            }}
            disabled={!hasCardOnFile}
            className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-muted disabled:hover:bg-transparent"
          >
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${hasCardOnFile ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <CreditCard className={`h-5 w-5 ${hasCardOnFile ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">Charge Card on File</p>
              {hasCardOnFile && membership?.paymentMethod ? (
                <p className="text-sm text-muted-foreground">
                  {membership.paymentMethod.type === "card"
                    ? `${membership.paymentMethod.brand?.toUpperCase()} •••• ${membership.paymentMethod.last4}`
                    : `${membership.paymentMethod.bankName} •••• ${membership.paymentMethod.last4}`}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No card on file
                </p>
              )}
            </div>
            {hasCardOnFile ? (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Badge variant="outline" className="text-xs">
                N/A
              </Badge>
            )}
          </button>

          {/* Option 3: Send Payment Link */}
          <button
            onClick={() => {
              onOpenChange(false);
              onSelectSendLink();
            }}
            className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Send className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">Send Payment Link</p>
              <p className="text-sm text-muted-foreground">
                Email a secure payment link to {member.email.split("@")[0]}...
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Auto-Pay Promo (if no subscription) */}
        {!hasSubscription && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Set up Auto-Pay
                </p>
                <p className="text-sm text-blue-700">
                  Member can set up automatic payments to never miss a due date.
                  You can send them a setup link from their profile.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
