import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface MemberInviteProps {
  memberName: string;
  inviteUrl: string;
  expiresAt: string;
  organizationName?: string;
  language?: "en" | "fa";
}

const t = {
  en: {
    subject: (org: string) => `You're Invited to the ${org} Member Portal`,
    subtitle: "Member Portal Invitation",
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    body: (org: string) =>
      `You have been invited to join the ${org} member portal. Create your account to view your membership details, track payments, and manage your profile.`,
    cta: "Create Your Account",
    listHeader: "With your portal account you can:",
    items: [
      "View your membership status and eligibility",
      "Track your payment history",
      "Update your profile and contact information",
      "View and sign your membership agreement",
    ],
    contact: "If you have any questions, please contact us.",
  },
  fa: {
    subject: (org: string) => `دعوت به پورتال اعضای ${org}`,
    subtitle: "دعوت به پورتال اعضا",
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    body: (org: string) =>
      `شما به پورتال اعضای ${org} دعوت شده‌اید. حساب خود را ایجاد کنید تا جزئیات عضویت، پیگیری پرداخت‌ها و مدیریت پروفایل خود را مشاهده کنید.`,
    cta: "ایجاد حساب کاربری",
    listHeader: "با حساب پورتال خود می‌توانید:",
    items: [
      "وضعیت عضویت و واجد شرایط بودن خود را مشاهده کنید",
      "تاریخچه پرداخت خود را پیگیری کنید",
      "پروفایل و اطلاعات تماس خود را بروزرسانی کنید",
      "قرارداد عضویت خود را مشاهده و امضا کنید",
    ],
    contact: "اگر سوالی دارید، لطفاً با ما تماس بگیرید.",
  },
};

export function MemberInviteEmail(props: MemberInviteProps) {
  const { memberName, inviteUrl, organizationName = "Our Organization", language = "en" } = props;
  const l = t[language];

  return (
    <EmailLayout
      title={organizationName}
      subtitle={l.subtitle}
      previewText={l.subject(organizationName)}
      greeting={l.greeting(memberName)}
      cta={{ label: l.cta, url: inviteUrl }}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>{l.body(organizationName)}</Text>
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

export async function renderMemberInvite(props: MemberInviteProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  return renderEmail(
    <MemberInviteEmail {...props} />,
    t[lang].subject(orgName)
  );
}

export default function MemberInvitePreview() {
  return (
    <MemberInviteEmail
      memberName="Ahmad Khan"
      inviteUrl="https://example.com/portal/accept-invite?token=abc123"
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
  list: {
    fontSize: "14px",
    color: "#666666",
    paddingLeft: "20px",
  },
};
