import * as React from "react";
import { Text, Link } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface AgreementSentProps {
  memberName: string;
  signUrl: string;
  expiresAt: string;
  organizationName?: string;
  language?: "en" | "fa";
}

const t = {
  en: {
    subject: (org: string) => `Action Required: Sign Your ${org} Membership Agreement`,
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    body: () =>
      `To complete your membership enrollment, please review and sign your membership agreement.`,
    cta: "Sign Agreement",
    contact: "If you have any questions, please contact us.",
    fallback: (url: string) =>
      `If the button above doesn't work, copy and paste this link into your browser:`,
  },
  fa: {
    subject: (org: string) => `اقدام لازم: امضای قرارداد عضویت ${org}`,
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    body: () =>
      `برای تکمیل ثبت نام عضویت خود، لطفاً قرارداد عضویت خود را بررسی و امضا کنید.`,
    cta: "امضای قرارداد",
    contact: "اگر سوالی دارید، لطفاً با ما تماس بگیرید.",
    fallback: () =>
      `اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:`,
  },
};

export function AgreementSentEmail(props: AgreementSentProps) {
  const { memberName, signUrl, organizationName = "Our Organization", language = "en" } = props;
  const l = t[language];

  return (
    <EmailLayout
      title={organizationName}
      previewText={l.subject(organizationName)}
      greeting={l.greeting(memberName)}
      cta={{ label: l.cta, url: signUrl }}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>{l.body()}</Text>
      <Text style={styles.muted}>{l.contact}</Text>
    </EmailLayout>
  );
}

export async function renderAgreementSent(props: AgreementSentProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  return renderEmail(
    <AgreementSentEmail {...props} />,
    t[lang].subject(orgName)
  );
}

export default function AgreementSentPreview() {
  return (
    <AgreementSentEmail
      memberName="Ahmad Khan"
      signUrl="https://example.com/sign/abc123"
      expiresAt="2025-02-15"
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
