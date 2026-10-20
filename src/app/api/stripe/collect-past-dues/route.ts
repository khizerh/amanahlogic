import { NextResponse } from "next/server";

import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { MembershipsService } from "@/lib/database/memberships";
import { MembersService } from "@/lib/database/members";
import { PlansService } from "@/lib/database/plans";
import { OrganizationsService } from "@/lib/database/organizations";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { stripe, isStripeConfigured, getPlatformFee } from "@/lib/stripe";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";
import { monthsOwed, clampArrearsMonths, arrearsPeriodLabel } from "@/lib/billing/arrears";
import { chargeArrears } from "@/lib/billing/collect-arrears";

interface CollectPastDuesBody {
  membershipId: string;
  memberId: string;
  /** Months to charge now. Omitted = everything owed. Clamped to owed. */
  arrearsMonths?: number | null;
}

/**
 * POST /api/stripe/collect-past-dues
 *
 * For a member who is ALREADY on auto-pay and carries a gap from before the
 * subscription started (or from a stretch where it was cancelled). No setup
 * link applies, so this charges the card Stripe already has, as one back_dues
 * payment of N months, and waives the rest. Same engine as the setup-link
 * path, so the ledger ends up identical either way.
 */
export async function POST(req: Request) {
  try {
    const organizationId = await getOrganizationId();

    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const { membershipId, memberId, arrearsMonths: requested }: CollectPastDuesBody = await req.json();
    if (!membershipId || !memberId) {
      return NextResponse.json({ error: "membershipId and memberId are required" }, { status: 400 });
    }

    const membership = await MembershipsService.getById(membershipId);
    if (!membership || membership.organizationId !== organizationId || membership.memberId !== memberId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (!membership.stripeCustomerId) {
      return NextResponse.json(
        { error: "No card on file. Use Resend Payment Link to collect past dues with a new card." },
        { status: 400 }
      );
    }

    const [member, plan, org] = await Promise.all([
      MembersService.getById(memberId),
      PlansService.getById(membership.planId),
      OrganizationsService.getById(organizationId),
    ]);
    if (!member || !plan || !org) {
      return NextResponse.json({ error: "Member, plan, or organization not found" }, { status: 404 });
    }

    const today = getTodayInOrgTimezone(org.timezone || "America/Los_Angeles");
    const owedMonths = monthsOwed(membership.nextPaymentDue, today);
    if (owedMonths === 0) {
      return NextResponse.json({ error: "This member is not behind on dues" }, { status: 400 });
    }
    const arrearsMonths = clampArrearsMonths(requested, owedMonths);
    const waivedMonths = owedMonths - arrearsMonths;

    // Card to charge: the subscription's own default first, then the customer's.
    let paymentMethodId: string | null = null;
    if (membership.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
        paymentMethodId =
          typeof sub.default_payment_method === "string"
            ? sub.default_payment_method
            : sub.default_payment_method?.id ?? null;
      } catch {
        // fall through to the customer default
      }
    }
    if (!paymentMethodId) {
      const customer = await stripe.customers.retrieve(membership.stripeCustomerId);
      if (!customer.deleted) {
        const def = customer.invoice_settings?.default_payment_method;
        paymentMethodId = typeof def === "string" ? def : def?.id ?? null;
      }
    }
    if (!paymentMethodId && arrearsMonths > 0) {
      return NextResponse.json(
        { error: "No saved payment method found. Send a portal link so the member can add a card first." },
        { status: 400 }
      );
    }
    const pm = paymentMethodId ? await stripe.paymentMethods.retrieve(paymentMethodId) : null;

    const result = await chargeArrears({
      stripe,
      supabase: createServiceRoleClient(),
      organizationId,
      membershipId,
      memberId,
      customerId: membership.stripeCustomerId,
      paymentMethodId: paymentMethodId ?? "",
      paymentMethodType: pm?.type ?? "card",
      receiptEmail: member.email,
      planName: plan.name,
      monthlyDuesCents: Math.round((plan.pricing?.monthly || 0) * 100),
      platformFeeMonthlyDollars: getPlatformFee(org.platformFees, "monthly"),
      passFeesToMember: org.passFeesToMember || false,
      connectAccountId: org.stripeConnectId && org.stripeOnboarded ? org.stripeConnectId : null,
      nextPaymentDue: membership.nextPaymentDue,
      arrearsMonths,
      waivedMonths,
      origin: "by admin",
      recordedBy: "admin",
    });

    const after = await MembershipsService.getById(membershipId);

    if (result.status === "failed") {
      return NextResponse.json(
        {
          error: `Charge failed: ${result.failureMessage || "unknown error"}`,
          result,
          nextPaymentDue: after?.nextPaymentDue ?? null,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      owedMonths,
      periodLabel: arrearsPeriodLabel(membership.nextPaymentDue, owedMonths),
      result,
      nextPaymentDue: after?.nextPaymentDue ?? null,
      paidMonths: after?.paidMonths ?? null,
    });
  } catch (error) {
    console.error("Error collecting past dues:", error);
    const message = error instanceof Error ? error.message : "Failed to collect past dues";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
