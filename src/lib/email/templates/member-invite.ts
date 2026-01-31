interface MemberInviteEmailProps {
  memberName: string;
  inviteUrl: string;
  expiresAt: string;
  organizationName?: string;
}

/**
 * English email template for member portal invite
 */
export function getMemberInviteEmailEN(props: MemberInviteEmailProps) {
  const { memberName, inviteUrl, organizationName = "Masjid Muhajireen" } = props;

  const subject = `You're Invited to the ${organizationName} Member Portal`;

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
    <p style="color: #666; margin: 5px 0 0 0;">Member Portal Invitation</p>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>You have been invited to join the ${organizationName} member portal. Create your account to view your membership details, track payments, and manage your profile.</p>

  <div style="text-align: center; margin: 30px 0;">
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

You have been invited to join the ${organizationName} member portal. Create your account to view your membership details, track payments, and manage your profile.

Create your account here: ${inviteUrl}

With your portal account you can:
- View your membership status and eligibility
- Track your payment history
- Update your profile and contact information
- View and sign your membership agreement

If you have any questions, please contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Farsi/Dari email template for member portal invite
 */
export function getMemberInviteEmailFA(props: MemberInviteEmailProps) {
  const { memberName, inviteUrl, organizationName = "مسجد جامع مهاجرین" } = props;

  const subject = `دعوت به پورتال اعضای ${organizationName}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">دعوت به پورتال اعضا</p>
  </div>

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>شما به پورتال اعضای ${organizationName} دعوت شده‌اید. حساب خود را ایجاد کنید تا جزئیات عضویت، پیگیری پرداخت‌ها و مدیریت پروفایل خود را مشاهده کنید.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      ایجاد حساب کاربری
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    <strong>با حساب پورتال خود می‌توانید:</strong>
  </p>
  <ul style="color: #666; font-size: 14px;">
    <li>وضعیت عضویت و واجد شرایط بودن خود را مشاهده کنید</li>
    <li>تاریخچه پرداخت خود را پیگیری کنید</li>
    <li>پروفایل و اطلاعات تماس خود را بروزرسانی کنید</li>
    <li>قرارداد عضویت خود را مشاهده و امضا کنید</li>
  </ul>

  <p style="color: #666; font-size: 14px;">
    اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:<br>
    <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
  </p>

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
السلام علیکم ${memberName} عزیز،

شما به پورتال اعضای ${organizationName} دعوت شده‌اید. حساب خود را ایجاد کنید تا جزئیات عضویت، پیگیری پرداخت‌ها و مدیریت پروفایل خود را مشاهده کنید.

حساب خود را اینجا ایجاد کنید: ${inviteUrl}

با حساب پورتال خود می‌توانید:
- وضعیت عضویت و واجد شرایط بودن خود را مشاهده کنید
- تاریخچه پرداخت خود را پیگیری کنید
- پروفایل و اطلاعات تماس خود را بروزرسانی کنید
- قرارداد عضویت خود را مشاهده و امضا کنید

اگر سوالی دارید، لطفاً با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Get member invite email template based on language
 */
export function getMemberInviteEmail(props: MemberInviteEmailProps & { language: "en" | "fa" }) {
  return props.language === "fa"
    ? getMemberInviteEmailFA(props)
    : getMemberInviteEmailEN(props);
}
