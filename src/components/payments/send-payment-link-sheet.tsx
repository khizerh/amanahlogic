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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { MemberWithMembership, PaymentType, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  Send,
  Mail,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link,
  Copy,
  ExternalLink,
  CreditCard,
  Clock,
} from "lucide-react";

interface SendPaymentLinkSheetProps {
  member: MemberWithMembership | null;
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendPaymentLinkSheet({
  member,
  plan,
  open,
  onOpenChange,
}: SendPaymentLinkSheetProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>("dues");
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [includeAutoPay, setIncludeAutoPay] = useState(true);
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  // Reset form when opening
  useEffect(() => {
    if (open && member?.membership) {
      setLinkSent(false);
      setGeneratedLink("");
      if (!member.membership.enrollmentFeePaid) {
        setPaymentType("enrollment_fee");
      } else {
        setPaymentType("dues");
      }
      switch (member.membership.billingFrequency) {
        case "biannual":
          setMonthsCount(6);
          break;
        case "annual":
          setMonthsCount(12);
          break;
        default:
          setMonthsCount(1);
      }
      setIncludeAutoPay(!member.membership.autoPayEnabled);
      setCustomMessage("");
    }
  }, [open, member]);

  if (!member || !plan) return null;

  const { membership } = member;
  const enrollmentFeePaid = membership?.enrollmentFeePaid ?? false;
  const enrollmentFeeAmount = plan.enrollmentFee;
  const hasAutoPay = membership?.autoPayEnabled;

  // Calculate amounts
  const baseAmount =
    paymentType === "enrollment_fee"
      ? enrollmentFeeAmount
      : plan.pricing.monthly * monthsCount;

  const monthOptions = [
    { value: 1, label: "1 month", price: plan.pricing.monthly },
    { value: 6, label: "6 months", price: plan.pricing.biannual },
    { value: 12, label: "12 months", price: plan.pricing.annual },
  ];

  const handleSendLink = async () => {
    setIsSending(true);

    try {
      // Simulate creating Stripe Checkout session and sending email
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Generate a fake payment link
      const fakeLink = `https://checkout.stripe.com/c/pay/cs_live_${Math.random().toString(36).substring(2, 15)}`;
      setGeneratedLink(fakeLink);
      setLinkSent(true);

      toast.success("Payment link sent!", {
        description: `Email sent to ${member.email}`,
      });
    } catch (error) {
      toast.error("Failed to send payment link");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard");
  };

  // Success state
  if (linkSent) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Payment Link Sent
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Success Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">
                    Email sent to {member.firstName}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {member.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Link Details */}
            <div className="space-y-3">
              <Label>Payment Link</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Link expires in 24 hours
              </p>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency(baseAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">
                  {paymentType === "enrollment_fee"
                    ? "Enrollment Fee"
                    : `${monthsCount} month${monthsCount > 1 ? "s" : ""} dues`}
                </span>
              </div>
              {includeAutoPay && !hasAutoPay && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Auto-Pay Setup</span>
                  <Badge variant="info" className="text-xs">Included</Badge>
                </div>
              )}
            </div>

            {/* What happens next */}
            <div className="space-y-2">
              <p className="text-sm font-medium">What happens next</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Member receives email with payment link
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  They click link and pay via Stripe
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Payment is automatically recorded
                </li>
                {includeAutoPay && !hasAutoPay && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Auto-pay is set up for future payments
                  </li>
                )}
              </ul>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Payment Link
          </SheetTitle>
          <SheetDescription>
            Email a secure payment link to {member.firstName} {member.lastName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Recipient Info */}
          <div className="bg-muted/50 rounded-lg p-4">
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

          {/* Enrollment Fee Alert */}
          {!enrollmentFeePaid && paymentType !== "enrollment_fee" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enrollment fee has not been paid yet.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Payment Type */}
          <div className="space-y-3">
            <Label>What to collect</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(value) => setPaymentType(value as PaymentType)}
            >
              {!enrollmentFeePaid && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enrollment_fee" id="spl_enrollment" />
                  <Label htmlFor="spl_enrollment" className="font-normal cursor-pointer">
                    Enrollment Fee ({formatCurrency(enrollmentFeeAmount)})
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dues" id="spl_dues" />
                <Label htmlFor="spl_dues" className="font-normal cursor-pointer">
                  Membership Dues
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Months Selection (for dues only) */}
          {paymentType !== "enrollment_fee" && (
            <div className="space-y-3">
              <Label>Period</Label>
              <div className="grid grid-cols-3 gap-2">
                {monthOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={monthsCount === option.value ? "default" : "outline"}
                    className="flex-col h-auto py-3"
                    onClick={() => setMonthsCount(option.value)}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs opacity-70">
                      {formatCurrency(option.price)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Auto-Pay Option */}
          {!hasAutoPay && (
            <div className="flex items-start space-x-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Checkbox
                id="includeAutoPay"
                checked={includeAutoPay}
                onCheckedChange={(checked) => setIncludeAutoPay(checked as boolean)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="includeAutoPay"
                  className="font-medium cursor-pointer"
                >
                  Include Auto-Pay Setup
                </Label>
                <p className="text-sm text-muted-foreground">
                  After payment, member will be asked to save their card for automatic
                  future payments.
                </p>
              </div>
            </div>
          )}

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="customMessage">Personal Message (Optional)</Label>
            <Textarea
              id="customMessage"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal message to include in the email..."
              rows={3}
            />
          </div>

          <Separator />

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(baseAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Link Expires</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" />
                24 hours
              </span>
            </div>
            {includeAutoPay && !hasAutoPay && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Auto-Pay</span>
                <Badge variant="info" className="text-xs">Will be set up</Badge>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How it works:</p>
            <p>1. Member receives email with secure Stripe link</p>
            <p>2. They pay using any card or bank account</p>
            <p>3. Payment is automatically recorded in the system</p>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendLink}
            disabled={isSending}
            className="bg-purple-600 hover:bg-purple-700"
          >
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
