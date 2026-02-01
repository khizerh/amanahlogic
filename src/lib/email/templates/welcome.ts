interface WelcomeEmailProps {
  memberName: string;
  organizationName?: string;
  inviteUrl: string;
  inviteExpiresAt: string;
  paymentMethod: "stripe" | "manual";
  // Stripe-only:
  checkoutUrl?: string;
  planName?: string;
  enrollmentFee?: number;
  duesAmount?: number;
  billingFrequency?: string;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// =============================================================================
// English Templates
// =============================================================================

function getWelcomeEmailStripeEN(props: WelcomeEmailProps) {
  const {
    memberName,
    organizationName = "Masjid Muhajireen",
    inviteUrl,
    checkoutUrl,
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
  } = props;

  const frequencyText =
    billingFrequency === "monthly"
      ? "monthly"
      : billingFrequency === "biannual"
      ? "every 6 months"
      : "annually";

  const enrollmentRow = enrollmentFee
    ? `
    <tr>
      <td style="padding: 8px 0; color: #666;">Enrollment Fee (one-time)</td>
      <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurrency(enrollmentFee)}</td>
    </tr>`
    : "";

  const subject = `Welcome to ${organizationName} - Complete Your Membership Setup`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${organizationName}</h1>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>Welcome! Your membership account has been created at ${organizationName}. To get started, please set up your member portal account and complete your payment setup.</p>

  <h2 style="color: #1a1a1a; font-size: 18px; margin: 30px 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Step 1: Create Your Portal Account</h2>
  <p style="color: #666; font-size: 14px;">Access your membership details, track payments, and manage your profile.</p>

  <div style="margin: 20px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Create Your Account
    </a>
  </div>

  <h2 style="color: #1a1a1a; font-size: 18px; margin: 30px 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Step 2: Complete Payment Setup</h2>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h4 style="margin: 0 0 15px 0; color: #1a1a1a;">Payment Summary</h4>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">Plan</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${planName || "Membership"}</td>
      </tr>
      ${enrollmentRow}
      <tr>
        <td style="padding: 8px 0; color: #666;">Recurring Dues (${frequencyText})</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${duesAmount != null ? formatCurrency(duesAmount) : "N/A"}</td>
      </tr>
    </table>
  </div>

  <div style="margin: 20px 0;">
    <a href="${checkoutUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Complete Payment Setup
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>What happens next:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    ${enrollmentFee ? "<li>Your enrollment fee will be charged immediately</li>" : ""}
    <li>Your card will be saved for automatic future payments</li>
    <li>You'll also receive a separate email to sign your membership agreement</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    If you have any questions, please contact us at info@masjidmuhajireen.org.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    If the buttons above don't work, copy and paste these links into your browser:<br>
    Portal: <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a><br>
    Payment: <a href="${checkoutUrl}" style="color: #2563eb; word-break: break-all;">${checkoutUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

Welcome! Your membership account has been created at ${organizationName}. To get started, please set up your member portal account and complete your payment setup.

STEP 1: CREATE YOUR PORTAL ACCOUNT
Access your membership details, track payments, and manage your profile.
Create your account here: ${inviteUrl}

STEP 2: COMPLETE PAYMENT SETUP

PAYMENT SUMMARY
---------------
Plan: ${planName || "Membership"}
${enrollmentFee ? `Enrollment Fee (one-time): ${formatCurrency(enrollmentFee)}\n` : ""}Recurring Dues (${frequencyText}): ${duesAmount != null ? formatCurrency(duesAmount) : "N/A"}

Complete your payment setup here: ${checkoutUrl}

What happens next:
${enrollmentFee ? "- Your enrollment fee will be charged immediately\n" : ""}- Your card will be saved for automatic future payments
- You'll also receive a separate email to sign your membership agreement

If you have any questions, please contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

function getWelcomeEmailManualEN(props: WelcomeEmailProps) {
  const {
    memberName,
    organizationName = "Masjid Muhajireen",
    inviteUrl,
  } = props;

  const subject = `Welcome to ${organizationName} - Your Member Portal Invitation`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${organizationName}</h1>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>Welcome! Your membership account has been created at ${organizationName}. Please set up your member portal account to view your membership details and track payments.</p>

  <div style="margin: 30px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Create Your Account
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>With your portal account you can:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    <li>View your membership status and eligibility</li>
    <li>Track your payment history</li>
    <li>Update your profile and contact information</li>
    <li>View and sign your membership agreement</li>
  </ul>

  <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px;">
      <strong>Payment Reminder:</strong> Please arrange your membership payment (cash, check, or Zelle) with the administration. You'll also receive a separate email to sign your membership agreement.
    </p>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you have any questions, please contact us at info@masjidmuhajireen.org.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

Welcome! Your membership account has been created at ${organizationName}. Please set up your member portal account to view your membership details and track payments.

Create your account here: ${inviteUrl}

With your portal account you can:
- View your membership status and eligibility
- Track your payment history
- Update your profile and contact information
- View and sign your membership agreement

PAYMENT REMINDER: Please arrange your membership payment (cash, check, or Zelle) with the administration. You'll also receive a separate email to sign your membership agreement.

If you have any questions, please contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

// =============================================================================
// Farsi Templates
// =============================================================================

function getWelcomeEmailStripeFA(props: WelcomeEmailProps) {
  const {
    memberName,
    organizationName = "\u0645\u0633\u062C\u062F \u062C\u0627\u0645\u0639 \u0645\u0647\u0627\u062C\u0631\u06CC\u0646",
    inviteUrl,
    checkoutUrl,
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
  } = props;

  const frequencyText =
    billingFrequency === "monthly"
      ? "\u0645\u0627\u0647\u0627\u0646\u0647"
      : billingFrequency === "biannual"
      ? "\u0647\u0631 \u06F6 \u0645\u0627\u0647"
      : "\u0633\u0627\u0644\u0627\u0646\u0647";

  const enrollmentRow = enrollmentFee
    ? `
    <tr>
      <td style="padding: 8px 0; color: #666;">\u0647\u0632\u06CC\u0646\u0647 \u062B\u0628\u062A\u200C\u0646\u0627\u0645 (\u06CC\u06A9\u0628\u0627\u0631)</td>
      <td style="padding: 8px 0; text-align: left; font-weight: 600;">${formatCurrency(enrollmentFee)}</td>
    </tr>`
    : "";

  const subject = `\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F \u0628\u0647 ${organizationName} - \u062A\u06A9\u0645\u06CC\u0644 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0639\u0636\u0648\u06CC\u062A`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
  <div style="margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${organizationName}</h1>
  </div>

  <p>\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 ${memberName} \u0639\u0632\u06CC\u0632\u060C</p>

  <p>\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F! \u062D\u0633\u0627\u0628 \u0639\u0636\u0648\u06CC\u062A \u0634\u0645\u0627 \u062F\u0631 ${organizationName} \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u0634\u0631\u0648\u0639\u060C \u0644\u0637\u0641\u0627\u064B \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644 \u0627\u0639\u0636\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F \u0648 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0631\u062F\u0627\u062E\u062A \u062E\u0648\u062F \u0631\u0627 \u062A\u06A9\u0645\u06CC\u0644 \u06A9\u0646\u06CC\u062F.</p>

  <h2 style="color: #1a1a1a; font-size: 18px; margin: 30px 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">\u0645\u0631\u062D\u0644\u0647 \u06F1: \u0627\u06CC\u062C\u0627\u062F \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644</h2>
  <p style="color: #666; font-size: 14px;">\u062C\u0632\u0626\u06CC\u0627\u062A \u0639\u0636\u0648\u06CC\u062A\u060C \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0647\u0627 \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F.</p>

  <div style="margin: 20px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      \u0627\u06CC\u062C\u0627\u062F \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC
    </a>
  </div>

  <h2 style="color: #1a1a1a; font-size: 18px; margin: 30px 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">\u0645\u0631\u062D\u0644\u0647 \u06F2: \u062A\u06A9\u0645\u06CC\u0644 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0631\u062F\u0627\u062E\u062A</h2>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h4 style="margin: 0 0 15px 0; color: #1a1a1a;">\u062E\u0644\u0627\u0635\u0647 \u067E\u0631\u062F\u0627\u062E\u062A</h4>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">\u0637\u0631\u062D</td>
        <td style="padding: 8px 0; text-align: left; font-weight: 600;">${planName || "\u0639\u0636\u0648\u06CC\u062A"}</td>
      </tr>
      ${enrollmentRow}
      <tr>
        <td style="padding: 8px 0; color: #666;">\u062D\u0642 \u0639\u0636\u0648\u06CC\u062A (${frequencyText})</td>
        <td style="padding: 8px 0; text-align: left; font-weight: 600;">${duesAmount != null ? formatCurrency(duesAmount) : "N/A"}</td>
      </tr>
    </table>
  </div>

  <div style="margin: 20px 0;">
    <a href="${checkoutUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      \u062A\u06A9\u0645\u06CC\u0644 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0631\u062F\u0627\u062E\u062A
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>\u0645\u0631\u0627\u062D\u0644 \u0628\u0639\u062F\u06CC:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    ${enrollmentFee ? "<li>\u0647\u0632\u06CC\u0646\u0647 \u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0634\u0645\u0627 \u0641\u0648\u0631\u0627\u064B \u06A9\u0633\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F</li>" : ""}
    <li>\u06A9\u0627\u0631\u062A \u0634\u0645\u0627 \u0628\u0631\u0627\u06CC \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0647\u0627\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631 \u0622\u06CC\u0646\u062F\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F</li>
    <li>\u0647\u0645\u0686\u0646\u06CC\u0646 \u06CC\u06A9 \u0627\u06CC\u0645\u06CC\u0644 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u0628\u0631\u0627\u06CC \u0627\u0645\u0636\u0627\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0639\u0636\u0648\u06CC\u062A \u062F\u0631\u06CC\u0627\u0641\u062A \u062E\u0648\u0627\u0647\u06CC\u062F \u06A9\u0631\u062F</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    \u0627\u06AF\u0631 \u062F\u06A9\u0645\u0647\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627 \u06A9\u0627\u0631 \u0646\u0645\u06CC\u200C\u06A9\u0646\u0646\u062F\u060C \u0627\u06CC\u0646 \u0644\u06CC\u0646\u06A9\u200C\u0647\u0627 \u0631\u0627 \u062F\u0631 \u0645\u0631\u0648\u0631\u06AF\u0631 \u062E\u0648\u062F \u06A9\u067E\u06CC \u0648 \u067E\u06CC\u0633\u062A \u06A9\u0646\u06CC\u062F:<br>
    \u067E\u0648\u0631\u062A\u0627\u0644: <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a><br>
    \u067E\u0631\u062F\u0627\u062E\u062A: <a href="${checkoutUrl}" style="color: #2563eb; word-break: break-all;">${checkoutUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 ${memberName} \u0639\u0632\u06CC\u0632\u060C

\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F! \u062D\u0633\u0627\u0628 \u0639\u0636\u0648\u06CC\u062A \u0634\u0645\u0627 \u062F\u0631 ${organizationName} \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u0634\u0631\u0648\u0639\u060C \u0644\u0637\u0641\u0627\u064B \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644 \u0627\u0639\u0636\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F \u0648 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0631\u062F\u0627\u062E\u062A \u062E\u0648\u062F \u0631\u0627 \u062A\u06A9\u0645\u06CC\u0644 \u06A9\u0646\u06CC\u062F.

\u0645\u0631\u062D\u0644\u0647 \u06F1: \u0627\u06CC\u062C\u0627\u062F \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644
\u062D\u0633\u0627\u0628 \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u0646\u062C\u0627 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F: ${inviteUrl}

\u0645\u0631\u062D\u0644\u0647 \u06F2: \u062A\u06A9\u0645\u06CC\u0644 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0631\u062F\u0627\u062E\u062A

\u062E\u0644\u0627\u0635\u0647 \u067E\u0631\u062F\u0627\u062E\u062A
---------------
\u0637\u0631\u062D: ${planName || "\u0639\u0636\u0648\u06CC\u062A"}
${enrollmentFee ? `\u0647\u0632\u06CC\u0646\u0647 \u062B\u0628\u062A\u200C\u0646\u0627\u0645 (\u06CC\u06A9\u0628\u0627\u0631): ${formatCurrency(enrollmentFee)}\n` : ""}\u062D\u0642 \u0639\u0636\u0648\u06CC\u062A (${frequencyText}): ${duesAmount != null ? formatCurrency(duesAmount) : "N/A"}

\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0631\u062F\u0627\u062E\u062A \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u0646\u062C\u0627 \u062A\u06A9\u0645\u06CC\u0644 \u06A9\u0646\u06CC\u062F: ${checkoutUrl}

\u0645\u0631\u0627\u062D\u0644 \u0628\u0639\u062F\u06CC:
${enrollmentFee ? "- \u0647\u0632\u06CC\u0646\u0647 \u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0634\u0645\u0627 \u0641\u0648\u0631\u0627\u064B \u06A9\u0633\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F\n" : ""}- \u06A9\u0627\u0631\u062A \u0634\u0645\u0627 \u0628\u0631\u0627\u06CC \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0647\u0627\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631 \u0622\u06CC\u0646\u062F\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F
- \u0647\u0645\u0686\u0646\u06CC\u0646 \u06CC\u06A9 \u0627\u06CC\u0645\u06CC\u0644 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u0628\u0631\u0627\u06CC \u0627\u0645\u0636\u0627\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0639\u0636\u0648\u06CC\u062A \u062F\u0631\u06CC\u0627\u0641\u062A \u062E\u0648\u0627\u0647\u06CC\u062F \u06A9\u0631\u062F

اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

function getWelcomeEmailManualFA(props: WelcomeEmailProps) {
  const {
    memberName,
    organizationName = "\u0645\u0633\u062C\u062F \u062C\u0627\u0645\u0639 \u0645\u0647\u0627\u062C\u0631\u06CC\u0646",
    inviteUrl,
    inviteExpiresAt,
  } = props;

  const subject = `\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F \u0628\u0647 ${organizationName} - \u062F\u0639\u0648\u062A \u0628\u0647 \u067E\u0648\u0631\u062A\u0627\u0644 \u0627\u0639\u0636\u0627`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
  <div style="margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${organizationName}</h1>
  </div>

  <p>\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 ${memberName} \u0639\u0632\u06CC\u0632\u060C</p>

  <p>\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F! \u062D\u0633\u0627\u0628 \u0639\u0636\u0648\u06CC\u062A \u0634\u0645\u0627 \u062F\u0631 ${organizationName} \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644 \u0627\u0639\u0636\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F \u062A\u0627 \u062C\u0632\u0626\u06CC\u0627\u062A \u0639\u0636\u0648\u06CC\u062A \u0648 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0647\u0627 \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F.</p>

  <div style="margin: 30px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      \u0627\u06CC\u062C\u0627\u062F \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>\u0628\u0627 \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644 \u062E\u0648\u062F \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    <li>\u0648\u0636\u0639\u06CC\u062A \u0639\u0636\u0648\u06CC\u062A \u0648 \u0648\u0627\u062C\u062F \u0634\u0631\u0627\u06CC\u0637 \u0628\u0648\u062F\u0646 \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F</li>
    <li>\u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u067E\u0631\u062F\u0627\u062E\u062A \u062E\u0648\u062F \u0631\u0627 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u06A9\u0646\u06CC\u062F</li>
    <li>\u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0648 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062A\u0645\u0627\u0633 \u062E\u0648\u062F \u0631\u0627 \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0646\u06CC\u062F</li>
    <li>\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0639\u0636\u0648\u06CC\u062A \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0627\u0645\u0636\u0627 \u06A9\u0646\u06CC\u062F</li>
  </ul>

  <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px;">
      <strong>\u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u067E\u0631\u062F\u0627\u062E\u062A:</strong> \u0644\u0637\u0641\u0627\u064B \u067E\u0631\u062F\u0627\u062E\u062A \u0639\u0636\u0648\u06CC\u062A \u062E\u0648\u062F \u0631\u0627 (\u0646\u0642\u062F\u06CC\u060C \u0686\u06A9 \u06CC\u0627 Zelle) \u0628\u0627 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0647\u0645\u0627\u0647\u0646\u06AF \u06A9\u0646\u06CC\u062F. \u0647\u0645\u0686\u0646\u06CC\u0646 \u06CC\u06A9 \u0627\u06CC\u0645\u06CC\u0644 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u0628\u0631\u0627\u06CC \u0627\u0645\u0636\u0627\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0639\u0636\u0648\u06CC\u062A \u062F\u0631\u06CC\u0627\u0641\u062A \u062E\u0648\u0627\u0647\u06CC\u062F \u06A9\u0631\u062F.
    </p>
  </div>

  <p style="color: #666; font-size: 14px;">
    اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    \u0627\u06AF\u0631 \u062F\u06A9\u0645\u0647 \u0628\u0627\u0644\u0627 \u06A9\u0627\u0631 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0627\u06CC\u0646 \u0644\u06CC\u0646\u06A9 \u0631\u0627 \u062F\u0631 \u0645\u0631\u0648\u0631\u06AF\u0631 \u062E\u0648\u062F \u06A9\u067E\u06CC \u0648 \u067E\u06CC\u0633\u062A \u06A9\u0646\u06CC\u062F:<br>
    <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 ${memberName} \u0639\u0632\u06CC\u0632\u060C

\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F! \u062D\u0633\u0627\u0628 \u0639\u0636\u0648\u06CC\u062A \u0634\u0645\u0627 \u062F\u0631 ${organizationName} \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644 \u0627\u0639\u0636\u0627\u06CC \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F \u062A\u0627 \u062C\u0632\u0626\u06CC\u0627\u062A \u0639\u0636\u0648\u06CC\u062A \u0648 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0647\u0627 \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F.

\u062D\u0633\u0627\u0628 \u062E\u0648\u062F \u0631\u0627 \u0627\u06CC\u0646\u062C\u0627 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F: ${inviteUrl}

\u0628\u0627 \u062D\u0633\u0627\u0628 \u067E\u0648\u0631\u062A\u0627\u0644 \u062E\u0648\u062F \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F:
- \u0648\u0636\u0639\u06CC\u062A \u0639\u0636\u0648\u06CC\u062A \u0648 \u0648\u0627\u062C\u062F \u0634\u0631\u0627\u06CC\u0637 \u0628\u0648\u062F\u0646 \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F
- \u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u067E\u0631\u062F\u0627\u062E\u062A \u062E\u0648\u062F \u0631\u0627 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u06A9\u0646\u06CC\u062F
- \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0648 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062A\u0645\u0627\u0633 \u062E\u0648\u062F \u0631\u0627 \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06A9\u0646\u06CC\u062F
- \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0639\u0636\u0648\u06CC\u062A \u062E\u0648\u062F \u0631\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0627\u0645\u0636\u0627 \u06A9\u0646\u06CC\u062F

\u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u067E\u0631\u062F\u0627\u062E\u062A: \u0644\u0637\u0641\u0627\u064B \u067E\u0631\u062F\u0627\u062E\u062A \u0639\u0636\u0648\u06CC\u062A \u062E\u0648\u062F \u0631\u0627 (\u0646\u0642\u062F\u06CC\u060C \u0686\u06A9 \u06CC\u0627 Zelle) \u0628\u0627 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0647\u0645\u0627\u0647\u0646\u06AF \u06A9\u0646\u06CC\u062F. \u0647\u0645\u0686\u0646\u06CC\u0646 \u06CC\u06A9 \u0627\u06CC\u0645\u06CC\u0644 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u0628\u0631\u0627\u06CC \u0627\u0645\u0636\u0627\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0639\u0636\u0648\u06CC\u062A \u062F\u0631\u06CC\u0627\u0641\u062A \u062E\u0648\u0627\u0647\u06CC\u062F \u06A9\u0631\u062F.

اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

// =============================================================================
// Public API
// =============================================================================

export function getWelcomeEmailEN(props: WelcomeEmailProps) {
  return props.paymentMethod === "stripe"
    ? getWelcomeEmailStripeEN(props)
    : getWelcomeEmailManualEN(props);
}

export function getWelcomeEmailFA(props: WelcomeEmailProps) {
  return props.paymentMethod === "stripe"
    ? getWelcomeEmailStripeFA(props)
    : getWelcomeEmailManualFA(props);
}

export function getWelcomeEmail(props: WelcomeEmailProps & { language: "en" | "fa" }) {
  return props.language === "fa"
    ? getWelcomeEmailFA(props)
    : getWelcomeEmailEN(props);
}
