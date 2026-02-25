import { createServiceRoleClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { calculateFees, getPlatformFee } from "@/lib/stripe";
import type { PlatformFees, BillingFrequency } from "@/lib/types";
import { SetupClient } from "./SetupClient";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function PaymentSetupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const setupIntentId = params.setup_intent;
  const clientSecret = params.setup_intent_client_secret;

  if (!setupIntentId || !clientSecret) {
    return <ErrorPage message="Invalid payment link. Please contact your administrator for a new link." />;
  }

  if (!stripe) {
    return <ErrorPage message="Payment system is not configured. Please contact support." />;
  }

  // Validate the SetupIntent with Stripe
  let setupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch {
    return <ErrorPage message="This payment link is no longer valid. Please contact your administrator for a new link." />;
  }

  if (setupIntent.status === "succeeded") {
    return <ErrorPage message="This payment setup has already been completed. Your card is on file and your subscription is active." isCompleted />;
  }

  if (setupIntent.status === "canceled") {
    return <ErrorPage message="This payment link has been canceled. Please contact your administrator for a new link." />;
  }

  const metadata = setupIntent.metadata;
  if (!metadata?.membership_id || !metadata?.organization_id) {
    return <ErrorPage message="This payment link is missing required information. Please contact your administrator." />;
  }

  // Load membership, plan, and organization data
  const supabase = createServiceRoleClient();

  const [{ data: membership }, { data: org }] = await Promise.all([
    supabase
      .from("memberships")
      .select("*, plan:plans(*)")
      .eq("id", metadata.membership_id)
      .single(),
    supabase
      .from("organizations")
      .select("id, name, platform_fees, pass_fees_to_member")
      .eq("id", metadata.organization_id)
      .single(),
  ]);

  if (!membership || !org) {
    return <ErrorPage message="Could not find your membership details. Please contact your administrator." />;
  }

  const plan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;
  const planName = metadata.plan_name || plan?.name || "Membership";
  const billingFrequency = metadata.billing_frequency || membership.billing_frequency || "monthly";
  const passFeesToMember = metadata.pass_fees_to_member === "true";

  // Check if member is current (already paid through a future date)
  const memberIsCurrent = metadata.member_is_current === "true";
  const nextPaymentDue = metadata.next_payment_due || undefined;

  // Calculate current amounts from plan pricing
  let baseDuesAmount: number;
  switch (billingFrequency) {
    case "biannual":
      baseDuesAmount = plan?.pricing?.biannual || 0;
      break;
    case "annual":
      baseDuesAmount = plan?.pricing?.annual || 0;
      break;
    default:
      baseDuesAmount = plan?.pricing?.monthly || 0;
  }

  const duesAmountCents = Math.round(baseDuesAmount * 100);
  const platformFeeDollars = getPlatformFee(org.platform_fees as PlatformFees | null, billingFrequency as BillingFrequency);
  const duesFees = calculateFees(duesAmountCents, platformFeeDollars, passFeesToMember);
  const displayDues = memberIsCurrent ? 0 : duesFees.chargeAmountCents / 100;

  // Enrollment fee (always run through calculateFees to include platform fee)
  const enrollmentFeeAmountCents = parseInt(metadata.enrollment_fee_amount_cents || "0", 10);
  let displayEnrollmentFee: number | undefined;
  if (enrollmentFeeAmountCents > 0 && !memberIsCurrent) {
    const enrollmentFees = calculateFees(enrollmentFeeAmountCents, platformFeeDollars, passFeesToMember);
    displayEnrollmentFee = enrollmentFees.chargeAmountCents / 100;
  }

  const frequencyText =
    billingFrequency === "monthly"
      ? "monthly"
      : billingFrequency === "biannual"
      ? "every 6 months"
      : "annually";

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return <ErrorPage message="Payment system is not properly configured. Please contact support." />;
  }

  return (
    <SetupClient
      clientSecret={clientSecret}
      publishableKey={publishableKey}
      organizationName={org.name}
      planName={planName}
      duesAmount={displayDues}
      enrollmentFee={displayEnrollmentFee}
      billingFrequency={frequencyText}
      nextPaymentDue={nextPaymentDue}
    />
  );
}

function ErrorPage({ message, isCompleted }: { message: string; isCompleted?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className={`mx-auto w-16 h-16 ${isCompleted ? "bg-green-100" : "bg-red-100"} rounded-full flex items-center justify-center`}>
              <XCircle className={`w-10 h-10 ${isCompleted ? "text-green-600" : "text-red-600"}`} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isCompleted ? "Already Completed" : "Payment Link Error"}
            </h1>
            <p className="text-gray-600">{message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
