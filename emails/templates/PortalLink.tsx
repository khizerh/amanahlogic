import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface PortalLinkProps {
  memberName: string;
  portalUrl: string;
  organizationName?: string;
  language?: "en" | "fa";
}

const t = {
  en: {
    subject: (org: string) => `Manage Your Payment Method - ${org}`,
    subtitle: "Payment Management",
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    body: "Use the link below to manage your payment method, view your billing history, or update your payment details.",
    cta: "Manage Payment Method",
    listHeader: "You can:",
    items: [
      "Update your credit card or bank account",
      "View past payments and invoices",
      "Download receipts",
    ],
    contact: "If you have any questions, please contact us.",
  },
  fa: {
    subject: (org: string) => `مدیریت روش پرداخت - ${org}`,
    subtitle: "مدیریت پرداخت",
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    body: "از لینک زیر برای مدیریت روش پرداخت، مشاهده تاریخچه صورتحساب، یا بروزرسانی جزئیات پرداخت خود استفاده کنید.",
    cta: "مدیریت روش پرداخت",
    listHeader: "شما می‌توانید:",
    items: [
      "کارت اعتباری یا حساب بانکی خود را بروزرسانی کنید",
      "پرداخت‌ها و صورتحساب‌های گذشته را مشاهده کنید",
      "رسیدها را دانلود کنید",
    ],
    contact: "اگر سوالی دارید، لطفاً با ما تماس بگیرید.",
  },
};

export function PortalLinkEmail(props: PortalLinkProps) {
  const { memberName, portalUrl, organizationName = "Our Organization", language = "en" } = props;
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
      <Text style={styles.text}>{l.body}</Text>
      <Text style={styles.muted}>
        <strong>{l.listHeader}</strong>
      </Text>
      <ul style={styles.list}>
        {l.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <Text style={styles.muted}>{l.contact}</Text>
    </EmailLayout>
  );
}

export async function renderPortalLink(props: PortalLinkProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  return renderEmail(
    <PortalLinkEmail {...props} />,
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
  list: {
    fontSize: "14px",
    color: "#666666",
    paddingLeft: "20px",
  },
};
