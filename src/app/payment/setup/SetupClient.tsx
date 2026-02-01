"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SetupClientProps {
  clientSecret: string;
  publishableKey: string;
  organizationName: string;
  planName: string;
  duesAmount: number;
  enrollmentFee?: number;
  billingFrequency: string;
  nextPaymentDue?: string;
}

export function SetupClient(props: SetupClientProps) {
  const { clientSecret, publishableKey, ...displayProps } = props;
  const stripePromise = loadStripe(publishableKey);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#16a34a",
                },
              },
            }}
          >
            <SetupForm {...displayProps} />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

interface SetupFormProps {
  organizationName: string;
  planName: string;
  duesAmount: number;
  enrollmentFee?: number;
  billingFrequency: string;
  nextPaymentDue?: string;
}

function SetupForm({
  organizationName,
  planName,
  duesAmount,
  enrollmentFee,
  billingFrequency,
  nextPaymentDue,
}: SetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCurrent = duesAmount === 0 && !!nextPaymentDue;

  const formatNextPaymentDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const returnUrl = `${window.location.origin}/payment-complete?status=success`;

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    // Only reaches here if there's an immediate error (redirect didn't happen)
    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred. Please try again.");
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{organizationName}</h1>
        <p className="text-gray-500">
          {isCurrent ? "Set Up Automatic Payments" : "Complete Your Membership Payment"}
        </p>
      </div>

      {/* Billing Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        {isCurrent ? (
          <>
            <h3 className="font-semibold text-gray-900">Save your payment method</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium">{planName}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Total Due Today</span>
              <span className="font-semibold text-gray-900">{formatCurrency(0)}</span>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-gray-900">You will be charged</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium">{planName}</span>
            </div>
            {enrollmentFee !== undefined && enrollmentFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Enrollment Fee (one-time)</span>
                <span className="font-medium">{formatCurrency(enrollmentFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">First Dues Payment ({billingFrequency})</span>
              <span className="font-medium">{formatCurrency(duesAmount)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Total Due Today</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(duesAmount + (enrollmentFee || 0))}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Stripe Payment Element */}
      <PaymentElement />

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={!stripe || !elements || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : isCurrent ? (
          "Save Card"
        ) : (
          "Pay & Start Membership"
        )}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        {isCurrent && nextPaymentDue
          ? `Your card will be saved. Automatic payments begin ${formatNextPaymentDate(nextPaymentDue)}.`
          : enrollmentFee !== undefined && enrollmentFee > 0
          ? `Your enrollment fee of ${formatCurrency(enrollmentFee)} and first dues of ${formatCurrency(duesAmount)} will be charged today. Your card will be saved for automatic future payments.`
          : `Your first dues of ${formatCurrency(duesAmount)} will be charged today. Your card will be saved for automatic future payments.`}
      </p>
    </form>
  );
}
