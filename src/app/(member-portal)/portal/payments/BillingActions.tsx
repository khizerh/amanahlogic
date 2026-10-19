"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getStripePortalUrl, getAutopaySetupUrl } from "../actions";

interface BillingActionsProps {
  organizationName: string;
  /** Live Stripe subscription → card changes go through the Stripe portal. */
  autoPayEnabled: boolean;
  /** Has a Stripe customer but no live subscription (cancelled after failed payments). */
  canRestartAutoPay: boolean;
  /** Dues paid by another member — nothing to do here. */
  isPayerManaged: boolean;
  /** Whole months behind, and a label like "Sep 2026" or "Feb – Aug 2026". */
  pastDue: { months: number; period: string } | null;
}

/**
 * The "Update Payment Method" email lands on this page. It has to offer the
 * right next step for the state the member is actually in:
 *   - subscription alive (Stripe still retrying, or past_due): Stripe portal
 *   - subscription cancelled: a fresh setup link that restarts auto-pay and
 *     collects what is owed
 *   - cash/check member: nothing to click, contact the organization
 */
export function BillingActions({
  organizationName,
  autoPayEnabled,
  canRestartAutoPay,
  isPayerManaged,
  pastDue,
}: BillingActionsProps) {
  const [loading, setLoading] = useState<"portal" | "restart" | null>(null);

  const openPortal = async () => {
    setLoading("portal");
    try {
      const result = await getStripePortalUrl();
      if (result.success && result.url) {
        window.location.assign(result.url);
      } else {
        toast.error(result.error || "Failed to open payment portal");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const restart = async () => {
    setLoading("restart");
    try {
      const result = await getAutopaySetupUrl();
      if (result.success && result.url) {
        window.location.assign(result.url);
      } else {
        toast.error(result.error || "Failed to start payment setup");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  if (isPayerManaged) return null;

  const behind = pastDue && pastDue.months > 0;

  return (
    <Card className={behind ? "border-amber-200 bg-amber-50" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {behind ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <CreditCard className="w-5 h-5" />}
          {behind ? "Payment Needed" : "Payment Method"}
        </CardTitle>
        <CardDescription className={behind ? "text-amber-800" : undefined}>
          {behind
            ? `You are ${pastDue.months} ${pastDue.months === 1 ? "month" : "months"} behind (${pastDue.period}).`
            : autoPayEnabled
              ? "Your dues are collected automatically."
              : canRestartAutoPay
                ? "Automatic payments are not active."
                : `Dues are collected by ${organizationName} directly.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {autoPayEnabled ? (
          <div className="space-y-2">
            {behind && (
              <p className="text-sm text-amber-800">
                Your last payment did not go through. Update your card and the missed payment
                will be collected automatically.
              </p>
            )}
            <Button variant={behind ? "default" : "outline"} size="sm" onClick={openPortal} disabled={loading !== null}>
              {loading === "portal" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Update Payment Method
                </>
              )}
            </Button>
          </div>
        ) : canRestartAutoPay ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {behind
                ? "Enter a card to restart automatic payments. Past dues and this period's dues will be charged together, and you'll see the full amount before you confirm."
                : "Enter a card to restart automatic payments."}
            </p>
            <Button size="sm" onClick={restart} disabled={loading !== null}>
              {loading === "restart" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {behind ? "Pay & Restart Auto-Pay" : "Set Up Auto-Pay"}
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {behind
              ? `Please contact ${organizationName} to make a payment.`
              : `Contact ${organizationName} to set up automatic payments.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
