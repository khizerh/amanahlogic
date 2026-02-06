"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";

function PaymentCompleteContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  // Stripe redirects back with redirect_status after confirmSetup()
  const redirectStatus = searchParams.get("redirect_status");
  const isSuccess = status === "success" || redirectStatus === "succeeded";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {isSuccess ? (
              <>
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Payment Complete!
                </h1>
                <p className="text-gray-600">
                  Thank you! Your payment has been processed and your membership
                  is now active.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                  <p className="font-medium">What happens next:</p>
                  <ul className="mt-2 space-y-1 text-left">
                    <li>• Your card has been saved for automatic future payments</li>
                    <li>• Future dues will be charged automatically on your billing date</li>
                    <li>• You can manage your account anytime through the member portal</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Payment Cancelled
                </h1>
                <p className="text-gray-600">
                  Your payment setup was cancelled. No charges were made to your card.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p>
                    If you&apos;d like to complete your payment setup, please contact
                    your membership administrator or check your email for the payment link.
                  </p>
                </div>
              </>
            )}

            <div className="pt-4 space-y-3">
              <Link href="/portal">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Go to Member Portal
                </Button>
              </Link>
              <p className="text-sm text-gray-500">
                Questions? Contact your organization administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Loading...</div>
        </div>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}
