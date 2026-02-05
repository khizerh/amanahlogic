import { NextRequest, NextResponse } from "next/server";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { OrganizationsService } from "@/lib/database/organizations";
import { renderAgreementSent } from "@emails/templates/AgreementSent";
import { renderMemberInvite } from "@emails/templates/MemberInvite";
import { renderPortalLink } from "@emails/templates/PortalLink";
import { renderPaymentFailed } from "@emails/templates/PaymentFailed";
import { renderPaymentReceipt } from "@emails/templates/PaymentReceipt";
import { renderPaymentSetup } from "@emails/templates/PaymentSetup";
import { renderPaymentReminder } from "@emails/templates/PaymentReminder";
import { renderWelcome } from "@emails/templates/Welcome";
import { renderPasswordReset } from "@emails/templates/PasswordReset";

export async function GET(req: NextRequest) {
  try {
    const organizationId = await getOrganizationId();
    const org = await OrganizationsService.getById(organizationId);
    const orgName = org?.name ?? "Our Organization";

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const language = (searchParams.get("language") ?? "en") as "en" | "fa";

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const result = await renderPreview(type, language, orgName);
    if (!result) {
      return NextResponse.json({ error: "Unknown template type" }, { status: 400 });
    }

    return new NextResponse(result.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function renderPreview(type: string, language: "en" | "fa", orgName: string) {
  switch (type) {
    case "welcome":
      return renderWelcome({
        memberName: "Ahmad Khan",
        organizationName: orgName,
        inviteUrl: "https://example.com/portal/accept-invite?token=abc123",
        inviteExpiresAt: "2025-03-01",
        paymentMethod: "stripe",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test_abc123",
        planName: "Family Plan",
        enrollmentFee: 100,
        duesAmount: 50,
        billingFrequency: "monthly",
        language,
      });

    case "agreement_sent":
      return renderAgreementSent({
        memberName: "Ahmad Khan",
        signUrl: "https://example.com/sign/abc123",
        expiresAt: "2025-03-01",
        organizationName: orgName,
        language,
      });

    case "payment_setup":
      return renderPaymentSetup({
        memberName: "Ahmad Khan",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test_abc123",
        organizationName: orgName,
        planName: "Family Plan",
        enrollmentFee: 100,
        duesAmount: 50,
        billingFrequency: "monthly",
        language,
      });

    case "payment_receipt":
      return renderPaymentReceipt({
        memberName: "Ahmad Khan",
        organizationName: orgName,
        amount: "$50.00",
        paymentDate: "January 15, 2025",
        paymentMethod: "Visa ending in 4242",
        invoiceNumber: "INV-2025-001",
        periodLabel: "January 2025",
        language,
      });

    case "payment_reminder":
      return renderPaymentReminder({
        memberName: "Ahmad Khan",
        amount: "50.00",
        dueDate: "2025-01-01",
        daysOverdue: 15,
        reminderNumber: 2,
        invoiceNumber: "INV-2025-001",
        portalUrl: "https://example.com/portal/payments",
        organizationName: orgName,
        language,
      });

    case "payment_failed":
      return renderPaymentFailed({
        memberName: "Ahmad Khan",
        amount: "50.00",
        failureReason: "Your card was declined. Please try a different payment method.",
        portalUrl: "https://example.com/portal/payments",
        organizationName: orgName,
        language,
      });

    case "portal_link":
      return renderPortalLink({
        memberName: "Ahmad Khan",
        portalUrl: "https://example.com/portal",
        organizationName: orgName,
        language,
      });

    case "member_invite":
      return renderMemberInvite({
        memberName: "Ahmad Khan",
        inviteUrl: "https://example.com/portal/accept-invite?token=abc123",
        expiresAt: "2025-03-01",
        organizationName: orgName,
        language,
      });

    case "password_reset":
      return renderPasswordReset({
        resetUrl: "https://example.com/reset-password?token=abc123",
        organizationName: orgName,
        language,
      });

    default:
      return null;
  }
}
