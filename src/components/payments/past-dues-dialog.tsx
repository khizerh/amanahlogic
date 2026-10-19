"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/currency";
import { arrearsPeriodLabel } from "@/lib/billing/arrears";

interface PastDuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whole months owed before the current period, as computed from next_payment_due. */
  owedMonths: number;
  nextPaymentDue: string | null;
  /** One month of dues as the member is charged, fees included (dollars). */
  monthlyCharge: number;
  /** Label for the confirm button, e.g. "Send Link" or "Copy Link". */
  confirmLabel: string;
  isSubmitting?: boolean;
  onConfirm: (arrearsMonths: number) => void;
}

/**
 * Shown before a card-setup link goes out when the member is behind. Defaults
 * to collecting everything owed; the admin can lower it (hardship, overseas,
 * paid cash that never got recorded). Whatever is waived is written to the
 * ledger as a $0 back-dues row so the member stops showing as overdue.
 */
export function PastDuesDialog({
  open,
  onOpenChange,
  owedMonths,
  nextPaymentDue,
  monthlyCharge,
  confirmLabel,
  isSubmitting,
  onConfirm,
}: PastDuesDialogProps) {
  const [months, setMonths] = useState(owedMonths);

  useEffect(() => {
    if (open) setMonths(owedMonths);
  }, [open, owedMonths]);

  const clamped = Math.min(Math.max(0, Math.floor(months || 0)), owedMonths);
  const waived = owedMonths - clamped;
  const owedLabel = arrearsPeriodLabel(nextPaymentDue, owedMonths);
  const collectLabel = arrearsPeriodLabel(nextPaymentDue, clamped);
  const approxTotal = clamped * monthlyCharge;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect past dues?</DialogTitle>
          <DialogDescription>
            This member is {owedMonths} {owedMonths === 1 ? "month" : "months"} behind
            {owedLabel ? ` (${owedLabel})` : ""}. The link will charge past dues together with
            the first regular payment when the card is saved. Lower the number to waive months.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="past-dues-months">Months to collect</Label>
            <Input
              id="past-dues-months"
              type="number"
              min={0}
              max={owedMonths}
              step={1}
              value={Number.isNaN(months) ? "" : months}
              onChange={(e) => setMonths(e.target.value === "" ? NaN : Number(e.target.value))}
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Past dues{collectLabel ? ` (${collectLabel})` : ""}
              </span>
              <span className="font-medium">
                {clamped > 0 ? `≈ ${formatCurrency(approxTotal)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">First regular payment</span>
              <span className="font-medium">{formatCurrency(monthlyCharge)}</span>
            </div>
            {waived > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Waived</span>
                <span className="font-medium">
                  {waived} {waived === 1 ? "month" : "months"}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              The member sees this breakdown on the setup page before entering a card. Exact
              fees are computed at charge time.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(clamped)} disabled={isSubmitting || Number.isNaN(months)}>
            {isSubmitting ? "Working..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
