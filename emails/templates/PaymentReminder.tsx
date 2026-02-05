import * as React from "react";
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface PaymentReminderProps {
  memberName: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  reminderNumber: number;
  invoiceNumber: string;
  portalUrl: string;
  organizationName?: string;
  language?: "en" | "fa";
}

function getUrgency(reminderNumber: number) {
  if (reminderNumber >= 3)
    return {
      color: "#991b1b",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  if (reminderNumber === 2)
    return {
      color: "#92400e",
      bg: "#fffbeb",
      border: "#fde68a",
    };
  return {
    color: "#1e40af",
    bg: "#eff6ff",
    border: "#bfdbfe",
  };
}

const t = {
  en: {
    urgencyLabel: (n: number) =>
      n >= 3 ? "Final Notice" : n === 2 ? "Second Reminder" : "Payment Reminder",
    subject: (label: string, amount: string, inv: string, org: string) =>
      `${label}: $${amount} Due - Invoice #${inv} - ${org}`,
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    bodyFinal:
      "This is your final reminder. Your membership may be affected if payment is not received.",
    bodyRegular: (amount: string, date: string, days: number) =>
      `Your payment of $${amount} was due on ${date} and is now ${days} days overdue. Please make your payment to keep your membership in good standing.`,
    invoice: "Invoice",
    amountDue: "Amount Due",
    dueDate: "Due Date",
    daysOverdue: "Days Overdue",
    daysUnit: "days",
    cta: "Make Payment",
    contact:
      "If you have already made this payment, please disregard this email. For questions, contact us.",
  },
  fa: {
    urgencyLabel: (n: number) =>
      n >= 3 ? "اخطار نهایی" : n === 2 ? "یادآوری دوم" : "یادآوری پرداخت",
    subject: (label: string, amount: string, inv: string, org: string) =>
      `${label}: $${amount} - فاکتور #${inv} - ${org}`,
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    bodyFinal:
      "این آخرین یادآوری شماست. عضویت شما ممکن است تحت تأثیر قرار گیرد اگر پرداخت دریافت نشود.",
    bodyRegular: (amount: string, date: string, days: number) =>
      `پرداخت شما به مبلغ $${amount} در تاریخ ${date} سررسید بود و اکنون ${days} روز عقب افتاده است. لطفاً پرداخت خود را انجام دهید تا عضویت شما در وضعیت خوب باقی بماند.`,
    invoice: "فاکتور",
    amountDue: "مبلغ بدهی",
    dueDate: "تاریخ سررسید",
    daysOverdue: "روزهای عقب‌افتاده",
    daysUnit: "روز",
    cta: "انجام پرداخت",
    contact:
      "اگر قبلاً این پرداخت را انجام داده‌اید، لطفاً این ایمیل را نادیده بگیرید. برای سوالات، با ما تماس بگیرید.",
  },
};

function DetailRow({
  label,
  value,
  color,
  align,
}: {
  label: string;
  value: string;
  color: string;
  align?: string;
}) {
  return (
    <tr>
      <td style={{ padding: "4px 0", color: "#666666" }}>{label}</td>
      <td
        style={{
          padding: "4px 0",
          textAlign: (align ?? "right") as React.CSSProperties["textAlign"],
          fontWeight: 600,
          color,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export function PaymentReminderEmail(props: PaymentReminderProps) {
  const {
    memberName,
    amount,
    dueDate,
    daysOverdue,
    reminderNumber,
    invoiceNumber,
    portalUrl,
    organizationName = "Our Organization",
    language = "en",
  } = props;
  const l = t[language];
  const urgency = getUrgency(reminderNumber);
  const urgencyLabel = l.urgencyLabel(reminderNumber);
  const valueAlign = language === "fa" ? "left" : "right";

  const formattedDueDate = new Date(dueDate + "T12:00:00").toLocaleDateString(
    language === "fa" ? "fa-IR" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const bodyText =
    reminderNumber >= 3
      ? l.bodyFinal
      : l.bodyRegular(amount, formattedDueDate, daysOverdue);

  return (
    <EmailLayout
      title={organizationName}
      subtitle={urgencyLabel}
      previewText={l.subject(urgencyLabel, amount, invoiceNumber, organizationName)}
      greeting={l.greeting(memberName)}
      cta={{ label: l.cta, url: portalUrl }}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>{bodyText}</Text>
      <Section
        style={{
          backgroundColor: urgency.bg,
          border: `1px solid ${urgency.border}`,
          borderRadius: "8px",
          padding: "16px",
          margin: "20px 0",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <tbody>
            <DetailRow
              label={l.invoice}
              value={`#${invoiceNumber}`}
              color={urgency.color}
              align={valueAlign}
            />
            <DetailRow
              label={l.amountDue}
              value={`$${amount}`}
              color={urgency.color}
              align={valueAlign}
            />
            <DetailRow
              label={l.dueDate}
              value={formattedDueDate}
              color={urgency.color}
              align={valueAlign}
            />
            <DetailRow
              label={l.daysOverdue}
              value={`${daysOverdue} ${l.daysUnit}`}
              color={urgency.color}
              align={valueAlign}
            />
          </tbody>
        </table>
      </Section>
      <Text style={styles.muted}>{l.contact}</Text>
    </EmailLayout>
  );
}

export async function renderPaymentReminder(props: PaymentReminderProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  const l = t[lang];
  const urgencyLabel = l.urgencyLabel(props.reminderNumber);
  return renderEmail(
    <PaymentReminderEmail {...props} />,
    l.subject(urgencyLabel, props.amount, props.invoiceNumber, orgName)
  );
}

export default function PaymentReminderPreview() {
  return (
    <PaymentReminderEmail
      memberName="Ahmad Khan"
      amount="50.00"
      dueDate="2025-01-01"
      daysOverdue={15}
      reminderNumber={2}
      invoiceNumber="INV-2025-001"
      portalUrl="https://example.com/portal/payments"
      organizationName="Masjid Muhajireen"
      language="en"
    />
  );
}

const styles = {
  text: {
    fontSize: "16px",
    lineHeight: 1.6 as const,
    color: "#1f2937",
  },
  muted: {
    fontSize: "14px",
    color: "#666666",
  },
};
