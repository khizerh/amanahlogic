import * as React from "react";
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface PaymentFailedProps {
  memberName: string;
  amount: string;
  failureReason: string;
  portalUrl: string;
  organizationName?: string;
  language?: "en" | "fa";
}

const t = {
  en: {
    subject: (org: string) => `Payment Failed - Action Required - ${org}`,
    subtitle: "Payment Notification",
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    body: (amount: string) =>
      `We were unable to process your payment of $${amount}. Please update your payment method to keep your membership in good standing.`,
    reasonLabel: "Reason:",
    cta: "Update Payment Method",
    contact:
      "If you believe this is an error or need assistance, please contact us.",
  },
  fa: {
    subject: (org: string) => `پرداخت ناموفق - اقدام لازم - ${org}`,
    subtitle: "اطلاعیه پرداخت",
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    body: (amount: string) =>
      `متأسفانه پردازش پرداخت شما به مبلغ $${amount} ممکن نشد. لطفاً روش پرداخت خود را بروزرسانی کنید تا عضویت شما در وضعیت خوب باقی بماند.`,
    reasonLabel: "دلیل:",
    cta: "بروزرسانی روش پرداخت",
    contact:
      "اگر فکر می‌کنید این یک خطا است یا به کمک نیاز دارید، لطفاً با ما تماس بگیرید.",
  },
};

export function PaymentFailedEmail(props: PaymentFailedProps) {
  const {
    memberName,
    amount,
    failureReason,
    portalUrl,
    organizationName = "Our Organization",
    language = "en",
  } = props;
  const l = t[language];

  return (
    <EmailLayout
      title={organizationName}
      subtitle={l.subtitle}
      previewText={l.subject(organizationName)}
      greeting={l.greeting(memberName)}
      cta={{ label: l.cta, url: portalUrl }}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>{l.body(amount)}</Text>
      <Section style={styles.errorBox}>
        <Text style={styles.errorText}>
          <strong>{l.reasonLabel}</strong> {failureReason}
        </Text>
      </Section>
      <Text style={styles.muted}>{l.contact}</Text>
    </EmailLayout>
  );
}

export async function renderPaymentFailed(props: PaymentFailedProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  return renderEmail(
    <PaymentFailedEmail {...props} />,
    t[lang].subject(orgName)
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
  errorBox: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "16px",
    margin: "20px 0",
  },
  errorText: {
    margin: "0" as const,
    color: "#991b1b",
    fontSize: "14px",
  },
};
