interface AgreementSentEmailProps {
  memberName: string;
  signUrl: string;
  expiresAt: string;
  organizationName?: string;
}

/**
 * English email template for agreement signing request
 */
export function getAgreementSentEmailEN(props: AgreementSentEmailProps) {
  const { memberName, signUrl, organizationName = "Masjid Muhajireen" } = props;

  const subject = `Action Required: Sign Your ${organizationName} Membership Agreement`;

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

  <p>Welcome to ${organizationName}! To complete your membership enrollment, please review and sign your membership agreement.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${signUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Sign Agreement
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you have any questions, please contact us at info@masjidmuhajireen.org.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    If the button above doesn't work, copy and paste this link into your browser:<br>
    <a href="${signUrl}" style="color: #2563eb; word-break: break-all;">${signUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

Welcome to ${organizationName}! To complete your membership enrollment, please review and sign your membership agreement.

Sign your agreement here: ${signUrl}

If you have any questions, please contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Farsi/Dari email template for agreement signing request
 */
export function getAgreementSentEmailFA(props: AgreementSentEmailProps) {
  const { memberName, signUrl, organizationName = "مسجد جامع مهاجرین" } = props;

  const subject = `اقدام لازم: امضای قرارداد عضویت ${organizationName}`;

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

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>به ${organizationName} خوش آمدید! برای تکمیل ثبت نام عضویت خود، لطفاً قرارداد عضویت خود را بررسی و امضا کنید.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${signUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      امضای قرارداد
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:<br>
    <a href="${signUrl}" style="color: #2563eb; word-break: break-all;">${signUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
السلام علیکم ${memberName} عزیز،

به ${organizationName} خوش آمدید! برای تکمیل ثبت نام عضویت خود، لطفاً قرارداد عضویت خود را بررسی و امضا کنید.

قرارداد خود را اینجا امضا کنید: ${signUrl}

اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Get agreement sent email template based on language
 */
export function getAgreementSentEmail(props: AgreementSentEmailProps & { language: "en" | "fa" }) {
  return props.language === "fa"
    ? getAgreementSentEmailFA(props)
    : getAgreementSentEmailEN(props);
}
