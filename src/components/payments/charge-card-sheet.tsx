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
import { Separator } from "@/components/ui/separator";
import { MemberWithMembership, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Building2,
  AlertCircle,
  Loader2,
  Lock,
  Zap,
} from "lucide-react";

interface ChargeCardSheetProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentRecorded?: () => void;
  passFeesToMember: boolean;
}

export function ChargeCardSheet({
  member,
  plan,
  open,
  onOpenChange,
  onPaymentRecorded,
  passFeesToMember,
}: ChargeCardSheetProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
    }
  }, [open]);

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

  const parsedAmount = parseFloat(amount) || 0;
  // If fees passed to member, gross up; otherwise member pays exact amount
  const stripeFee = passFeesToMember && parsedAmount > 0
    ? parseFloat(((parsedAmount + 0.3) / (1 - 0.029) - parsedAmount).toFixed(2))
    : 0;
  const totalCharged = passFeesToMember ? parsedAmount + stripeFee : parsedAmount;

  const handleCharge = async () => {
    if (!membership) return;

    if (parsedAmount <= 0) {
      toast.error("Please enter an amount");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/stripe/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          memberId: member.id,
          amount: parsedAmount,
          description: description.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Payment failed");
      }

      toast.success(`${formatCurrency(parsedAmount)} charged successfully`);

      onOpenChange(false);
      onPaymentRecorded?.();
      router.refresh();
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

          <Separator />

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="charge-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="charge-amount"
                type="number"
                min="0.50"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="charge-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="charge-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 2025 catch-up dues, Enrollment fee..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Charge Summary */}
          {parsedAmount > 0 && (
            <>
              <Separator />
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {passFeesToMember ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{formatCurrency(parsedAmount)}</span>
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
                      Processing fees are passed to the member
                    </p>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="font-medium">Total to Charge</span>
                    <span className="text-xl font-bold">{formatCurrency(parsedAmount)}</span>
                  </div>
                )}
              </div>
            </>
          )}
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
            disabled={isProcessing || parsedAmount <= 0 || !description.trim()}
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
                {parsedAmount > 0 ? `Charge ${formatCurrency(totalCharged)}` : "Charge"}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
