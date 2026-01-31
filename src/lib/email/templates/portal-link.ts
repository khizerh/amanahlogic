interface PortalLinkEmailProps {
  memberName: string;
  portalUrl: string;
  organizationName?: string;
}

/**
 * English email template for Stripe Customer Portal link
 */
export function getPortalLinkEmailEN(props: PortalLinkEmailProps) {
  const { memberName, portalUrl, organizationName = "Masjid Muhajireen" } = props;

  const subject = `Manage Your Payment Method - ${organizationName}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">Payment Management</p>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>Use the link below to manage your payment method, view your billing history, or update your payment details.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Manage Payment Method
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>You can:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    <li>Update your credit card or bank account</li>
    <li>View past payments and invoices</li>
    <li>Download receipts</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    If you have any questions, please contact us at info@masjidmuhajireen.org.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${portalUrl}" style="color: #2563eb; word-break: break-all;">${portalUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

Use the link below to manage your payment method, view your billing history, or update your payment details.

Manage your payment method here: ${portalUrl}

You can:
- Update your credit card or bank account
- View past payments and invoices
- Download receipts

If you have any questions, please contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Farsi/Dari email template for Stripe Customer Portal link
 */
export function getPortalLinkEmailFA(props: PortalLinkEmailProps) {
  const { memberName, portalUrl, organizationName = "مسجد جامع مهاجرین" } = props;

  const subject = `مدیریت روش پرداخت - ${organizationName}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">مدیریت پرداخت</p>
  </div>

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>از لینک زیر برای مدیریت روش پرداخت، مشاهده تاریخچه صورتحساب، یا بروزرسانی جزئیات پرداخت خود استفاده کنید.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      مدیریت روش پرداخت
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>شما می‌توانید:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    <li>کارت اعتباری یا حساب بانکی خود را بروزرسانی کنید</li>
    <li>پرداخت‌ها و صورتحساب‌های گذشته را مشاهده کنید</li>
    <li>رسیدها را دانلود کنید</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:<br>
    <a href="${portalUrl}" style="color: #2563eb; word-break: break-all;">${portalUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
السلام علیکم ${memberName} عزیز،

از لینک زیر برای مدیریت روش پرداخت، مشاهده تاریخچه صورتحساب، یا بروزرسانی جزئیات پرداخت خود استفاده کنید.

روش پرداخت خود را اینجا مدیریت کنید: ${portalUrl}

شما می‌توانید:
- کارت اعتباری یا حساب بانکی خود را بروزرسانی کنید
- پرداخت‌ها و صورتحساب‌های گذشته را مشاهده کنید
- رسیدها را دانلود کنید

اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Get portal link email template based on language
 */
export function getPortalLinkEmail(props: PortalLinkEmailProps & { language: "en" | "fa" }) {
  return props.language === "fa"
    ? getPortalLinkEmailFA(props)
    : getPortalLinkEmailEN(props);
}
