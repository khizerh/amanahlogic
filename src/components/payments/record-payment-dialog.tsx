"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getMembers } from "@/lib/mock-data";
import type { PaymentType, PaymentMethod } from "@/lib/types";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordPaymentDialog({ open, onOpenChange }: RecordPaymentDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("dues");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const members = getMembers();

  // Auto-fill amount based on payment type and selected member
  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);

    if (paymentType === "dues") {
      const member = members.find(m => m.id === memberId);
      if (member?.membership) {
        const plan = member.plan;
        if (plan) {
          const frequency = member.membership.billingFrequency;
          const duesAmount =
            frequency === "monthly"
              ? plan.pricing.monthly
              : frequency === "biannual"
              ? plan.pricing.biannual
              : plan.pricing.annual;
          setAmount(duesAmount.toString());
        }
      }
    } else if (paymentType === "enrollment_fee") {
      setAmount("500");
    }
  };

  const handlePaymentTypeChange = (type: PaymentType) => {
    setPaymentType(type);

    if (type === "enrollment_fee") {
      setAmount("500");
    } else if (type === "dues" && selectedMemberId) {
      const member = members.find(m => m.id === selectedMemberId);
      if (member?.membership) {
        const plan = member.plan;
        if (plan) {
          const frequency = member.membership.billingFrequency;
          const duesAmount =
            frequency === "monthly"
              ? plan.pricing.monthly
              : frequency === "biannual"
              ? plan.pricing.biannual
              : plan.pricing.annual;
          setAmount(duesAmount.toString());
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMemberId || !amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      toast.success("Payment recorded successfully");

      // Reset form
      setSelectedMemberId("");
      setPaymentType("dues");
      setPaymentMethod("cash");
      setAmount("");
      setNotes("");
      setIsSubmitting(false);

      // Close dialog
      onOpenChange(false);
    }, 1000);
  };

  const handleCancel = () => {
    // Reset form
    setSelectedMemberId("");
    setPaymentType("dues");
    setPaymentMethod("cash");
    setAmount("");
    setNotes("");

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a manual payment (cash, check, or Zelle)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Member Select */}
            <div className="grid gap-2">
              <Label htmlFor="member">Member *</Label>
              <Select value={selectedMemberId} onValueChange={handleMemberChange}>
                <SelectTrigger id="member">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter(m => m.membership)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Type */}
            <div className="grid gap-2">
              <Label htmlFor="payment-type">Payment Type *</Label>
              <Select value={paymentType} onValueChange={(value) => handlePaymentTypeChange(value as PaymentType)}>
                <SelectTrigger id="payment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enrollment_fee">Enrollment Fee</SelectItem>
                  <SelectItem value="dues">Dues</SelectItem>
                  <SelectItem value="back_dues">Back Dues</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="grid gap-2">
              <Label htmlFor="payment-method">Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
              {selectedMemberId && paymentType === "dues" && (
                <p className="text-xs text-muted-foreground">
                  Auto-filled based on member&apos;s plan
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes about this payment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
