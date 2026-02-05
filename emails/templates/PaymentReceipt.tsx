import * as React from "react";
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface PaymentReceiptProps {
  memberName: string;
  organizationName: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceNumber?: string;
  periodLabel?: string;
  language?: "en" | "fa";
}

const t = {
  en: {
    subject: (amount: string) => `Payment Receipt - ${amount}`,
    subtitle: "Payment Receipt",
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    body: "Thank you for your payment! This email confirms that we have received your payment.",
    detailsTitle: "Payment Details",
    amount: "Amount",
    date: "Date",
    method: "Method",
    invoice: "Invoice #",
    period: "Period",
    standing: (org: string) =>
      `Your membership is in good standing. Thank you for your continued support of ${org}.`,
    portalNote:
      "You can view your payment history and manage your account through the member portal.",
    closing: (org: string) => `JazakAllah Khair,\n${org}`,
  },
  fa: {
    subject: (amount: string) => `رسید پرداخت - ${amount}`,
    subtitle: "رسید پرداخت",
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    body: "از پرداخت شما متشکریم! این ایمیل تأیید می‌کند که پرداخت شما دریافت شده است.",
    detailsTitle: "جزئیات پرداخت",
    amount: "مبلغ",
    date: "تاریخ",
    method: "روش",
    invoice: "شماره فاکتور",
    period: "دوره",
    standing: (org: string) =>
      `عضویت شما در وضعیت خوبی قرار دارد. از حمایت مستمر شما از ${org} متشکریم.`,
    portalNote:
      "شما می‌توانید سابقه پرداخت‌ها و حساب خود را از طریق پورتال اعضا مشاهده و مدیریت کنید.",
    closing: (org: string) => `جزاک الله خیر،\n${org}`,
  },
};

function DetailRow({ label, value, align }: { label: string; value: string; align?: string }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: "#666666" }}>{label}</td>
      <td
        style={{
          padding: "6px 0",
          textAlign: (align ?? "right") as React.CSSProperties["textAlign"],
          fontWeight: 600,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export function PaymentReceiptEmail(props: PaymentReceiptProps) {
  const {
    memberName,
    organizationName,
    amount,
    paymentDate,
    paymentMethod,
    invoiceNumber,
    periodLabel,
    language = "en",
  } = props;
  const l = t[language];
  const valueAlign = language === "fa" ? "left" : "right";

  return (
    <EmailLayout
      title={organizationName}
      subtitle={l.subtitle}
      previewText={l.subject(amount)}
      greeting={l.greeting(memberName)}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>{l.body}</Text>
      <Section style={styles.detailsBox}>
        <Text style={styles.detailsTitle}>{l.detailsTitle}</Text>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <DetailRow label={l.amount} value={amount} align={valueAlign} />
            <DetailRow label={l.date} value={paymentDate} align={valueAlign} />
            <DetailRow label={l.method} value={paymentMethod} align={valueAlign} />
            {invoiceNumber ? (
              <DetailRow label={l.invoice} value={invoiceNumber} align={valueAlign} />
            ) : null}
            {periodLabel ? (
              <DetailRow label={l.period} value={periodLabel} align={valueAlign} />
            ) : null}
          </tbody>
        </table>
      </Section>
      <Text style={styles.text}>{l.standing(organizationName)}</Text>
      <Text style={styles.muted}>{l.portalNote}</Text>
      <Text style={styles.text}>{l.closing(organizationName)}</Text>
    </EmailLayout>
  );
}

export async function renderPaymentReceipt(props: PaymentReceiptProps) {
  const lang = props.language ?? "en";
  return renderEmail(
    <PaymentReceiptEmail {...props} />,
    t[lang].subject(props.amount)
  );
}

const styles = {
  text: {
    fontSize: "16px",
    lineHeight: 1.6 as const,
    color: "#1f2937",
  },
  muted: {
    fontSize: "13px",
    color: "#666666",
  },
  detailsBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    padding: "20px",
    margin: "20px 0",
  },
  detailsTitle: {
    margin: "0 0 15px 0",
    fontSize: "16px",
    fontWeight: 600 as const,
    color: "#1a1a1a",
  },
};
