import * as React from "react";
import { Text, Button } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface PasswordResetProps {
  resetUrl: string;
  organizationName?: string;
  language?: "en" | "fa";
}

const t = {
  en: {
    subject: (org: string) => `Reset Your Password - ${org}`,
    greeting: "Assalamu Alaikum,",
    body: "We received a request to reset your password. Click the button below to set a new password:",
    cta: "Reset Password",
    ignore:
      "If you didn't request this, you can safely ignore this email. This link will expire in 24 hours.",
    fallback:
      "If the button above doesn't work, copy and paste this link into your browser:",
  },
  fa: {
    subject: (org: string) => `بازنشانی رمز عبور - ${org}`,
    greeting: "السلام علیکم،",
    body: "درخواست بازنشانی رمز عبور شما دریافت شد. برای تنظیم رمز عبور جدید روی دکمه زیر کلیک کنید:",
    cta: "بازنشانی رمز عبور",
    ignore:
      "اگر این درخواست را نداده‌اید، می‌توانید این ایمیل را نادیده بگیرید. این لینک ۲۴ ساعت اعتبار دارد.",
    fallback:
      "اگر دکمه بالا کار نمی‌کند، این لینک را در مرورگر خود کپی و پیست کنید:",
  },
};

export function PasswordResetEmail(props: PasswordResetProps) {
  const {
    resetUrl,
    organizationName = "Our Organization",
    language = "en",
  } = props;
  const l = t[language];

  return (
    <EmailLayout
      title={organizationName}
      previewText={l.subject(organizationName)}
      greeting={l.greeting}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>{l.body}</Text>
      <Button href={resetUrl} style={styles.ctaButton} className="email-cta-button">
        {l.cta}
      </Button>
      <Text style={styles.muted}>{l.ignore}</Text>
      <Text style={styles.muted}>{l.fallback}</Text>
      <Text style={styles.link}>{resetUrl}</Text>
    </EmailLayout>
  );
}

export async function renderPasswordReset(props: PasswordResetProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  return renderEmail(
    <PasswordResetEmail {...props} />,
    t[lang].subject(orgName)
  );
}

export default function PasswordResetPreview() {
  return (
    <PasswordResetEmail
      resetUrl="https://example.com/reset-password?token=abc123"
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
  ctaButton: {
    display: "inline-block" as const,
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "8px",
    marginTop: "16px",
    marginBottom: "16px",
    textDecoration: "none" as const,
    fontWeight: 500 as const,
  },
  muted: {
    fontSize: "14px",
    color: "#666666",
  },
  link: {
    fontSize: "12px",
    color: "#666666",
    wordBreak: "break-all" as const,
  },
};
