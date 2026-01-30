interface PaymentFailedEmailProps {
  memberName: string;
  amount: string;
  failureReason: string;
  portalUrl: string;
  organizationName?: string;
}

/**
 * English email template for payment failure notification
 */
export function getPaymentFailedEmailEN(props: PaymentFailedEmailProps) {
  const {
    memberName,
    amount,
    failureReason,
    portalUrl,
    organizationName = "Masjid Muhajireen",
  } = props;

  const subject = `Payment Failed - Action Required - ${organizationName}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">Payment Notification</p>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>We were unable to process your payment of <strong>$${amount}</strong>. Please update your payment method to keep your membership in good standing.</p>

  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #991b1b; font-size: 14px;">
      <strong>Reason:</strong> ${failureReason}
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Update Payment Method
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you believe this is an error or need assistance, please contact us at info@masjidmuhajireen.org.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${portalUrl}" style="color: #2563eb; word-break: break-all;">${portalUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}<br>
    185 Folsom Ave, Hayward, CA 94544
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

We were unable to process your payment of $${amount}. Please update your payment method to keep your membership in good standing.

Reason: ${failureReason}

Update your payment method here: ${portalUrl}

If you believe this is an error or need assistance, please contact us at info@masjidmuhajireen.org.

${organizationName}
185 Folsom Ave, Hayward, CA 94544
  `.trim();

  return { subject, html, text };
}

/**
 * Farsi/Dari email template for payment failure notification
 */
export function getPaymentFailedEmailFA(props: PaymentFailedEmailProps) {
  const {
    memberName,
    amount,
    failureReason,
    portalUrl,
    organizationName = "مسجد جامع مهاجرین",
  } = props;

  const subject = `پرداخت ناموفق - اقدام لازم - ${organizationName}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">اطلاعیه پرداخت</p>
  </div>

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>متأسفانه پردازش پرداخت شما به مبلغ <strong>$${amount}</strong> ممکن نشد. لطفاً روش پرداخت خود را بروزرسانی کنید تا عضویت شما در وضعیت خوب باقی بماند.</p>

  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #991b1b; font-size: 14px;">
      <strong>دلیل:</strong> ${failureReason}
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      بروزرسانی روش پرداخت
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    اگر فکر می‌کنید این یک خطا است یا به کمک نیاز دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:<br>
    <a href="${portalUrl}" style="color: #2563eb; word-break: break-all;">${portalUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}<br>
    185 Folsom Ave, Hayward, CA 94544
  </p>
</body>
</html>
  `.trim();

  const text = `
السلام علیکم ${memberName} عزیز،

متأسفانه پردازش پرداخت شما به مبلغ $${amount} ممکن نشد. لطفاً روش پرداخت خود را بروزرسانی کنید تا عضویت شما در وضعیت خوب باقی بماند.

دلیل: ${failureReason}

روش پرداخت خود را اینجا بروزرسانی کنید: ${portalUrl}

اگر فکر می‌کنید این یک خطا است یا به کمک نیاز دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
185 Folsom Ave, Hayward, CA 94544
  `.trim();

  return { subject, html, text };
}

/**
 * Get payment failed email template based on language
 */
export function getPaymentFailedEmail(props: PaymentFailedEmailProps & { language: "en" | "fa" }) {
  return props.language === "fa"
    ? getPaymentFailedEmailFA(props)
    : getPaymentFailedEmailEN(props);
}
