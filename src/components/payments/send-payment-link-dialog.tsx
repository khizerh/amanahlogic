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
import { formatCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import { Send, Mail, CheckCircle2, Loader2, Copy, AlertTriangle } from "lucide-react";
import type { MemberWithMembership, Plan } from "@/lib/types";

interface SendPaymentLinkDialogProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendPaymentLinkDialog({
  member,
  plan,
  open,
  onOpenChange,
}: SendPaymentLinkDialogProps) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!member || !plan) return null;

  const { membership } = member;
  if (!membership) return null;

  // Calculate what they'll be charged
  const billingFrequency = membership.billingFrequency || "monthly";
  const duesAmount = plan.pricing[billingFrequency];
  const enrollmentFeeDue = membership.enrollmentFeeStatus === "unpaid";
  const enrollmentFeeAmount = plan.enrollmentFee;
  const totalAmount = enrollmentFeeDue ? duesAmount + enrollmentFeeAmount : duesAmount;

  const getBillingLabel = (frequency: string) => {
    switch (frequency) {
      case "monthly": return "Monthly";
      case "biannual": return "Bi-Annual (6 mo)";
      case "annual": return "Annual (12 mo)";
      default: return frequency;
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setSent(false);
      setCheckoutUrl(null);
      setError(null);
    }, 200);
  };

  const handleSend = async () => {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/send-payment-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          memberId: member.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send payment link");
      }

      setCheckoutUrl(result.paymentUrl || result.checkoutUrl);
      setSent(true);

      if (result.warning) {
        toast.warning("Link created but email may not have sent", {
          description: result.emailError || result.warning,
        });
      } else {
        toast.success(`Payment link sent to ${member.email}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send payment link";
      setError(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    if (checkoutUrl) {
      navigator.clipboard.writeText(checkoutUrl);
      toast.success("Link copied to clipboard");
    }
  };

  // Success state
  if (sent) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Payment Link Sent
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">
                    Email sent to {member.firstName}
                  </p>
                  <p className="text-sm text-green-700">{member.email}</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              {enrollmentFeeDue && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Includes</span>
                  <span className="text-xs">Enrollment + First Dues</span>
                </div>
              )}
            </div>

            {checkoutUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You can also copy the link to share directly:
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Payment Link
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (error) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Failed to Send
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSend}>
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Default state - confirmation
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Payment Link
          </DialogTitle>
          <DialogDescription>
            Send a Stripe checkout link to collect payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>
          </div>

          {/* What they'll pay */}
          <div className="p-3 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{plan.name}</span>
            </div>
            {enrollmentFeeDue && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Enrollment Fee</span>
                <span>{formatCurrency(enrollmentFeeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {getBillingLabel(billingFrequency)} Dues
              </span>
              <span>{formatCurrency(duesAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-medium">
              <span>Total</span>
              <span className="text-green-600">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            Member will receive an email with a secure Stripe payment link.
            After payment, auto-pay will be set up for future billing.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
