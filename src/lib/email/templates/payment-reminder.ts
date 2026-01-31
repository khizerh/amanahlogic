interface PaymentReminderEmailProps {
  memberName: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  reminderNumber: number;
  invoiceNumber: string;
  portalUrl: string;
  organizationName?: string;
}

/**
 * English email template for payment reminder
 */
export function getPaymentReminderEmailEN(props: PaymentReminderEmailProps) {
  const {
    memberName,
    amount,
    dueDate,
    daysOverdue,
    reminderNumber,
    invoiceNumber,
    portalUrl,
    organizationName = "Masjid Muhajireen",
  } = props;

  const formattedDueDate = new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgencyLabel = reminderNumber >= 3 ? "Final Notice" : reminderNumber === 2 ? "Second Reminder" : "Payment Reminder";
  const subject = `${urgencyLabel}: $${amount} Due - Invoice #${invoiceNumber} - ${organizationName}`;

  const urgencyMessage = reminderNumber >= 3
    ? "This is your final reminder. Your membership may be affected if payment is not received."
    : `Your payment of <strong>$${amount}</strong> was due on <strong>${formattedDueDate}</strong> and is now <strong>${daysOverdue} days overdue</strong>. Please make your payment to keep your membership in good standing.`;

  const urgencyMessageText = reminderNumber >= 3
    ? "This is your final reminder. Your membership may be affected if payment is not received."
    : `Your payment of $${amount} was due on ${formattedDueDate} and is now ${daysOverdue} days overdue. Please make your payment to keep your membership in good standing.`;

  const urgencyColor = reminderNumber >= 3 ? "#991b1b" : reminderNumber === 2 ? "#92400e" : "#1e40af";
  const urgencyBg = reminderNumber >= 3 ? "#fef2f2" : reminderNumber === 2 ? "#fffbeb" : "#eff6ff";
  const urgencyBorder = reminderNumber >= 3 ? "#fecaca" : reminderNumber === 2 ? "#fde68a" : "#bfdbfe";

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
    <p style="color: #666; margin: 5px 0 0 0;">${urgencyLabel}</p>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>${urgencyMessage}</p>

  <div style="background-color: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 4px 0; color: #666;">Invoice</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: ${urgencyColor};">#${invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">Amount Due</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: ${urgencyColor};">$${amount}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">Due Date</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: ${urgencyColor};">${formattedDueDate}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">Days Overdue</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: ${urgencyColor};">${daysOverdue} days</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Make Payment
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you have already made this payment, please disregard this email. For questions, contact us at info@masjidmuhajireen.org.
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

${urgencyMessageText}

Invoice: #${invoiceNumber}
Amount Due: $${amount}
Due Date: ${formattedDueDate}
Days Overdue: ${daysOverdue} days

Make your payment here: ${portalUrl}

If you have already made this payment, please disregard this email. For questions, contact us at info@masjidmuhajireen.org.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Farsi/Dari email template for payment reminder
 */
export function getPaymentReminderEmailFA(props: PaymentReminderEmailProps) {
  const {
    memberName,
    amount,
    dueDate,
    daysOverdue,
    reminderNumber,
    invoiceNumber,
    portalUrl,
    organizationName = "مسجد جامع مهاجرین",
  } = props;

  const formattedDueDate = new Date(dueDate + "T12:00:00").toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgencyLabel = reminderNumber >= 3 ? "اخطار نهایی" : reminderNumber === 2 ? "یادآوری دوم" : "یادآوری پرداخت";
  const subject = `${urgencyLabel}: $${amount} - فاکتور #${invoiceNumber} - ${organizationName}`;

  const urgencyMessage = reminderNumber >= 3
    ? "این آخرین یادآوری شماست. عضویت شما ممکن است تحت تأثیر قرار گیرد اگر پرداخت دریافت نشود."
    : `پرداخت شما به مبلغ <strong>$${amount}</strong> در تاریخ <strong>${formattedDueDate}</strong> سررسید بود و اکنون <strong>${daysOverdue} روز</strong> عقب افتاده است. لطفاً پرداخت خود را انجام دهید تا عضویت شما در وضعیت خوب باقی بماند.`;

  const urgencyMessageText = reminderNumber >= 3
    ? "این آخرین یادآوری شماست. عضویت شما ممکن است تحت تأثیر قرار گیرد اگر پرداخت دریافت نشود."
    : `پرداخت شما به مبلغ $${amount} در تاریخ ${formattedDueDate} سررسید بود و اکنون ${daysOverdue} روز عقب افتاده است. لطفاً پرداخت خود را انجام دهید تا عضویت شما در وضعیت خوب باقی بماند.`;

  const urgencyColor = reminderNumber >= 3 ? "#991b1b" : reminderNumber === 2 ? "#92400e" : "#1e40af";
  const urgencyBg = reminderNumber >= 3 ? "#fef2f2" : reminderNumber === 2 ? "#fffbeb" : "#eff6ff";
  const urgencyBorder = reminderNumber >= 3 ? "#fecaca" : reminderNumber === 2 ? "#fde68a" : "#bfdbfe";

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
    <p style="color: #666; margin: 5px 0 0 0;">${urgencyLabel}</p>
  </div>

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>${urgencyMessage}</p>

  <div style="background-color: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 4px 0; color: #666;">فاکتور</td>
        <td style="padding: 4px 0; text-align: left; font-weight: 600; color: ${urgencyColor};">#${invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">مبلغ بدهی</td>
        <td style="padding: 4px 0; text-align: left; font-weight: 600; color: ${urgencyColor};">$${amount}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">تاریخ سررسید</td>
        <td style="padding: 4px 0; text-align: left; font-weight: 600; color: ${urgencyColor};">${formattedDueDate}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">روزهای عقب‌افتاده</td>
        <td style="padding: 4px 0; text-align: left; font-weight: 600; color: ${urgencyColor};">${daysOverdue} روز</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${portalUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      انجام پرداخت
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    اگر قبلاً این پرداخت را انجام داده‌اید، لطفاً این ایمیل را نادیده بگیرید. برای سوالات، با ما در info@masjidmuhajireen.org تماس بگیرید.
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

${urgencyMessageText}

فاکتور: #${invoiceNumber}
مبلغ بدهی: $${amount}
تاریخ سررسید: ${formattedDueDate}
روزهای عقب‌افتاده: ${daysOverdue} روز

پرداخت خود را اینجا انجام دهید: ${portalUrl}

اگر قبلاً این پرداخت را انجام داده‌اید، لطفاً این ایمیل را نادیده بگیرید. برای سوالات، با ما در info@masjidmuhajireen.org تماس بگیرید.

${organizationName}
  `.trim();

  return { subject, html, text };
}

/**
 * Get payment reminder email template based on language
 */
export function getPaymentReminderEmail(props: PaymentReminderEmailProps & { language: "en" | "fa" }) {
  return props.language === "fa"
    ? getPaymentReminderEmailFA(props)
    : getPaymentReminderEmailEN(props);
}
