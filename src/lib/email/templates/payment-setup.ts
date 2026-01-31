interface PaymentSetupEmailProps {
  memberName: string;
  checkoutUrl: string;
  organizationName?: string;
  planName: string;
  enrollmentFee?: number;
  duesAmount: number;
  billingFrequency: string;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * English email template for Payment Setup link
 */
export function getPaymentSetupEmailEN(props: PaymentSetupEmailProps) {
  const {
    memberName,
    checkoutUrl,
    organizationName = "Masjid Muhajireen",
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
  } = props;

  const subject = `Complete Your Membership Setup - ${organizationName}`;

  const frequencyText =
    billingFrequency === "monthly"
      ? "monthly"
      : billingFrequency === "biannual"
      ? "every 6 months"
      : "annually";

  const enrollmentSection = enrollmentFee
    ? `
    <tr>
      <td style="padding: 8px 0; color: #666;">Enrollment Fee (one-time)</td>
      <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurrency(enrollmentFee)}</td>
    </tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${organizationName}</h1>
    <p style="color: #666; margin: 5px 0 0 0;">Membership Payment Setup</p>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>Welcome! Your membership account has been created. Please complete your payment setup using the secure link below.</p>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Payment Summary</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">Plan</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${planName}</td>
      </tr>
      ${enrollmentSection}
      <tr>
        <td style="padding: 8px 0; color: #666;">Recurring Dues (${frequencyText})</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurrency(duesAmount)}</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${checkoutUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Complete Payment Setup
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>What happens next:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    ${enrollmentFee ? "<li>Your enrollment fee will be charged immediately</li>" : ""}
    <li>Your card will be saved for automatic future payments</li>
    <li>You'll receive a confirmation once setup is complete</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    If you have any questions, please contact us at info@masjidmuhajireen.org.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${checkoutUrl}" style="color: #16a34a; word-break: break-all;">${checkoutUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

Welcome! Your membership account has been created. Please complete your payment setup using the link below.

PAYMENT SUMMARY
---------------
Plan: ${planName}
${enrollmentFee ? `Enrollment Fee (one-time): ${formatCurrency(enrollmentFee)}\n` : ""}Recurring Dues (${frequencyText}): ${formatCurrency(duesAmount)}

Complete your payment setup here: ${checkoutUrl}

What happens next:
${enrollmentFee ? "- Your enrollment fee will be charged immediately\n" : ""}- Your card will be saved for automatic future payments
- You'll receive a confirmation once setup is complete

If you have any questions, please contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Farsi email template for Payment Setup link
 */
export function getPaymentSetupEmailFA(props: PaymentSetupEmailProps) {
  const {
    memberName,
    checkoutUrl,
    organizationName = "مسجد جامع مهاجرین",
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
  } = props;

  const subject = `تکمیل تنظیمات عضویت - ${organizationName}`;

  const frequencyText =
    billingFrequency === "monthly"
      ? "ماهانه"
      : billingFrequency === "biannual"
      ? "هر ۶ ماه"
      : "سالانه";

  const enrollmentSection = enrollmentFee
    ? `
    <tr>
      <td style="padding: 8px 0; color: #666;">هزینه ثبت‌نام (یکبار)</td>
      <td style="padding: 8px 0; text-align: left; font-weight: 600;">${formatCurrency(enrollmentFee)}</td>
    </tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a1a1a; margin: 0;">${organizationName}</h1>
    <p style="color: #666; margin: 5px 0 0 0;">تنظیم پرداخت عضویت</p>
  </div>

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>خوش آمدید! حساب عضویت شما ایجاد شده است. لطفاً تنظیمات پرداخت خود را با استفاده از لینک امن زیر تکمیل کنید.</p>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">خلاصه پرداخت</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666;">طرح</td>
        <td style="padding: 8px 0; text-align: left; font-weight: 600;">${planName}</td>
      </tr>
      ${enrollmentSection}
      <tr>
        <td style="padding: 8px 0; color: #666;">حق عضویت (${frequencyText})</td>
        <td style="padding: 8px 0; text-align: left; font-weight: 600;">${formatCurrency(duesAmount)}</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${checkoutUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      تکمیل تنظیمات پرداخت
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>مراحل بعدی:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    ${enrollmentFee ? "<li>هزینه ثبت‌نام شما فوراً کسر می‌شود</li>" : ""}
    <li>کارت شما برای پرداخت‌های خودکار آینده ذخیره می‌شود</li>
    <li>پس از تکمیل تنظیمات، تأییدیه دریافت خواهید کرد</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:<br>
    <a href="${checkoutUrl}" style="color: #16a34a; word-break: break-all;">${checkoutUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
السلام علیکم ${memberName} عزیز،

خوش آمدید! حساب عضویت شما ایجاد شده است. لطفاً تنظیمات پرداخت خود را با استفاده از لینک زیر تکمیل کنید.

خلاصه پرداخت
---------------
طرح: ${planName}
${enrollmentFee ? `هزینه ثبت‌نام (یکبار): ${formatCurrency(enrollmentFee)}\n` : ""}حق عضویت (${frequencyText}): ${formatCurrency(duesAmount)}

تنظیمات پرداخت خود را اینجا تکمیل کنید: ${checkoutUrl}

مراحل بعدی:
${enrollmentFee ? "- هزینه ثبت‌نام شما فوراً کسر می‌شود\n" : ""}- کارت شما برای پرداخت‌های خودکار آینده ذخیره می‌شود
- پس از تکمیل تنظیمات، تأییدیه دریافت خواهید کرد

اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Get payment setup email template based on language
 */
export function getPaymentSetupEmail(
  props: PaymentSetupEmailProps & { language: "en" | "fa" }
) {
  return props.language === "fa"
    ? getPaymentSetupEmailFA(props)
    : getPaymentSetupEmailEN(props);
}
