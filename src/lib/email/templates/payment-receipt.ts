interface PaymentReceiptEmailProps {
  memberName: string;
  organizationName: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceNumber?: string;
  periodLabel?: string;
}

function formatField(label: string, value: string): string {
  return `<tr>
      <td style="padding: 6px 0; color: #666;">${label}</td>
      <td style="padding: 6px 0; text-align: right; font-weight: 600;">${value}</td>
    </tr>`;
}

export function getPaymentReceiptEmailEN(props: PaymentReceiptEmailProps) {
  const { memberName, organizationName, amount, paymentDate, paymentMethod, invoiceNumber, periodLabel } = props;

  const subject = `Payment Receipt - ${amount}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">Payment Receipt</p>
  </div>

  <p>Assalamu Alaikum ${memberName},</p>

  <p>Thank you for your payment! This email confirms that we have received your payment.</p>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Payment Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${formatField("Amount", amount)}
      ${formatField("Date", paymentDate)}
      ${formatField("Method", paymentMethod)}
      ${invoiceNumber ? formatField("Invoice #", invoiceNumber) : ""}
      ${periodLabel ? formatField("Period", periodLabel) : ""}
    </table>
  </div>

  <p>Your membership is in good standing. Thank you for your continued support of ${organizationName}.</p>

  <p style="color: #666; font-size: 13px;">You can view your payment history and manage your account through the member portal.</p>

  <p>JazakAllah Khair,<br>${organizationName}</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
Assalamu Alaikum ${memberName},

Thank you for your payment! This email confirms that we have received your payment.

Payment Details:
- Amount: ${amount}
- Date: ${paymentDate}
- Method: ${paymentMethod}
${invoiceNumber ? `- Invoice #: ${invoiceNumber}\n` : ""}${periodLabel ? `- Period: ${periodLabel}\n` : ""}
Your membership is in good standing. Thank you for your continued support of ${organizationName}.

You can view your payment history and manage your account through the member portal.

JazakAllah Khair,
${organizationName}
  `.trim();

  return { subject, html, text };
}

export function getPaymentReceiptEmailFA(props: PaymentReceiptEmailProps) {
  const { memberName, organizationName, amount, paymentDate, paymentMethod, invoiceNumber, periodLabel } = props;

  const subject = `رسید پرداخت - ${amount}`;

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
    <p style="color: #666; margin: 5px 0 0 0;">رسید پرداخت</p>
  </div>

  <p>السلام علیکم ${memberName} عزیز،</p>

  <p>از پرداخت شما متشکریم! این ایمیل تأیید می‌کند که پرداخت شما دریافت شده است.</p>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">جزئیات پرداخت</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${formatField("مبلغ", amount)}
      ${formatField("تاریخ", paymentDate)}
      ${formatField("روش", paymentMethod)}
      ${invoiceNumber ? formatField("شماره فاکتور", invoiceNumber) : ""}
      ${periodLabel ? formatField("دوره", periodLabel) : ""}
    </table>
  </div>

  <p>عضویت شما در وضعیت خوبی قرار دارد. از حمایت مستمر شما از ${organizationName} متشکریم.</p>

  <p style="color: #666; font-size: 13px;">شما می‌توانید سابقه پرداخت‌ها و حساب خود را از طریق پورتال اعضا مشاهده و مدیریت کنید.</p>

  <p>جزاک الله خیر،<br>${organizationName}</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px; margin-top: 30px;">
    ${organizationName}
  </p>
</body>
</html>
  `.trim();

  const text = `
السلام علیکم ${memberName} عزیز،

از پرداخت شما متشکریم! این ایمیل تأیید می‌کند که پرداخت شما دریافت شده است.

جزئیات پرداخت:
- مبلغ: ${amount}
- تاریخ: ${paymentDate}
- روش: ${paymentMethod}
${invoiceNumber ? `- شماره فاکتور: ${invoiceNumber}\n` : ""}${periodLabel ? `- دوره: ${periodLabel}\n` : ""}
عضویت شما در وضعیت خوبی قرار دارد. از حمایت مستمر شما از ${organizationName} متشکریم.

شما می‌توانید سابقه پرداخت‌ها و حساب خود را از طریق پورتال اعضا مشاهده و مدیریت کنید.

جزاک الله خیر،
${organizationName}
  `.trim();

  return { subject, html, text };
}

export function getPaymentReceiptEmail(
  props: PaymentReceiptEmailProps & { language: "en" | "fa" }
) {
  return props.language === "fa"
    ? getPaymentReceiptEmailFA(props)
    : getPaymentReceiptEmailEN(props);
}
