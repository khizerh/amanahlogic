import * as React from "react";
import { Text, Section, Button, Heading } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface WelcomeProps {
  memberName: string;
  organizationName?: string;
  inviteUrl: string;
  inviteExpiresAt: string;
  paymentMethod: "stripe" | "manual";
  language?: "en" | "fa";
  // Stripe-only:
  checkoutUrl?: string;
  planName?: string;
  enrollmentFee?: number;
  duesAmount?: number;
  billingFrequency?: string;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const freqMap = {
  en: { monthly: "monthly", biannual: "every 6 months", annual: "annually" },
  fa: { monthly: "ماهانه", biannual: "هر ۶ ماه", annual: "سالانه" },
};

function getFrequencyText(freq: string | undefined, lang: "en" | "fa") {
  const m = freqMap[lang];
  if (freq === "monthly") return m.monthly;
  if (freq === "biannual") return m.biannual;
  return m.annual;
}

const t = {
  en: {
    subjectStripe: (org: string) => `Welcome to ${org} - Complete Your Membership Setup`,
    subjectManual: (org: string) => `Welcome to ${org} - Your Member Portal Invitation`,
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    bodyStripe: (org: string) =>
      `Your membership account has been created at ${org}, please set up your member portal and complete your payment setup.`,
    bodyManual: (org: string) =>
      `Your membership account has been created at ${org}. Please make arrangements for your payment and set up your member portal account to view your membership details and track payments.`,
    step1Title: "Create Your Portal Account",
    step1Desc: "Access your membership details, track payments, and manage your profile.",
    step1Cta: "Create Your Account",
    step2Title: "Complete Payment Setup",
    summaryTitle: "Payment Summary",
    plan: "Plan",
    enrollmentFee: "Enrollment Fee (one-time)",
    recurringDues: (freq: string) => `Recurring Dues (${freq})`,
    step2Cta: "Complete Payment Setup",
    nextSteps: "What happens next:",
    enrollmentCharge: "Your enrollment fee and first dues payment will be charged immediately",
    cardSaved: "Your card will be saved for automatic future payments",
    agreementNote: "You'll also receive a separate email to sign your membership agreement",
    // Manual-specific
    portalListHeader: "With your portal account you can:",
    portalItems: [
      "View your membership status and eligibility",
      "Track your payment history",
      "Update your profile and contact information",
      "View and sign your membership agreement",
    ],
    manualPaymentReminder: "Payment Reminder:",
    manualPaymentNote:
      "Please arrange your membership payment (cash, check, or other).",
    manualPaymentDesc: "Please arrange your membership payment (cash, check, or other).",
    total: "Total",
    contact: "If you have any questions, please contact us.",
  },
  fa: {
    subjectStripe: (org: string) => `خوش آمدید به ${org} - تکمیل تنظیمات عضویت`,
    subjectManual: (org: string) => `خوش آمدید به ${org} - دعوت به پورتال اعضا`,
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    bodyStripe: (org: string) =>
      `حساب عضویت شما در ${org} ایجاد شده است، لطفاً پورتال اعضای خود را ایجاد کنید و تنظیمات پرداخت خود را تکمیل کنید.`,
    bodyManual: (org: string) =>
      `حساب عضویت شما در ${org} ایجاد شده است. لطفاً ترتیب پرداخت خود را بدهید و حساب پورتال اعضای خود را ایجاد کنید تا جزئیات عضویت و پیگیری پرداخت‌ها را مشاهده کنید.`,
    step1Title: "ایجاد حساب پورتال",
    step1Desc: "جزئیات عضویت، پیگیری پرداخت‌ها و مدیریت پروفایل خود را مشاهده کنید.",
    step1Cta: "ایجاد حساب کاربری",
    step2Title: "تکمیل تنظیمات پرداخت",
    summaryTitle: "خلاصه پرداخت",
    plan: "طرح",
    enrollmentFee: "هزینه ثبت‌نام (یکبار)",
    recurringDues: (freq: string) => `حق عضویت (${freq})`,
    step2Cta: "تکمیل تنظیمات پرداخت",
    nextSteps: "مراحل بعدی:",
    enrollmentCharge: "هزینه ثبت‌نام و اولین حق عضویت شما فوراً کسر می‌شود",
    cardSaved: "کارت شما برای پرداخت‌های خودکار آینده ذخیره می‌شود",
    agreementNote: "همچنین یک ایمیل جداگانه برای امضای قرارداد عضویت دریافت خواهید کرد",
    portalListHeader: "با حساب پورتال خود می‌توانید:",
    portalItems: [
      "وضعیت عضویت و واجد شرایط بودن خود را مشاهده کنید",
      "تاریخچه پرداخت خود را پیگیری کنید",
      "پروفایل و اطلاعات تماس خود را بروزرسانی کنید",
      "قرارداد عضویت خود را مشاهده و امضا کنید",
    ],
    manualPaymentReminder: "یادآوری پرداخت:",
    manualPaymentNote:
      "لطفاً ترتیب پرداخت عضویت خود را بدهید (نقدی، چک یا سایر).",
    manualPaymentDesc: "لطفاً ترتیب پرداخت عضویت خود را بدهید (نقدی، چک یا سایر).",
    total: "مجموع",
    contact: "اگر سوالی دارید، لطفاً با ما تماس بگیرید.",
  },
};

function SummaryRow({ label, value, align }: { label: string; value: string; align?: string }) {
  return (
    <tr>
      <td style={{ padding: "8px 0", color: "#666666" }}>{label}</td>
      <td
        style={{
          padding: "8px 0",
          textAlign: (align ?? "right") as React.CSSProperties["textAlign"],
          fontWeight: 600,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export function WelcomeEmail(props: WelcomeProps) {
  const {
    memberName,
    organizationName = "Our Organization",
    inviteUrl,
    paymentMethod,
    language = "en",
    checkoutUrl,
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
  } = props;
  const l = t[language];
  const isStripe = paymentMethod === "stripe";
  const freqText = getFrequencyText(billingFrequency, language);
  const valueAlign = language === "fa" ? "left" : "right";

  return (
    <EmailLayout
      title={organizationName}
      previewText={
        isStripe ? l.subjectStripe(organizationName) : l.subjectManual(organizationName)
      }
      greeting={l.greeting(memberName)}
      language={language}
      footer={{ organization_name: organizationName }}
    >
      <Text style={styles.text}>
        {isStripe ? l.bodyStripe(organizationName) : l.bodyManual(organizationName)}
      </Text>

      {/* Step 1: Portal account */}
      <Heading as="h2" style={styles.stepHeading}>
        {isStripe ? l.step1Title : l.step1Title}
      </Heading>
      <Text style={styles.muted}>{l.step1Desc}</Text>
      <Button href={inviteUrl} style={styles.ctaButton} className="email-cta-button">
        {l.step1Cta}
      </Button>

      {isStripe ? (
        <>
          {/* Step 2: Payment setup */}
          <Heading as="h2" style={styles.stepHeading}>
            {l.step2Title}
          </Heading>
          <Section style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>{l.summaryTitle}</Text>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <SummaryRow label={l.plan} value={planName || "Membership"} align={valueAlign} />
                {enrollmentFee ? (
                  <SummaryRow
                    label={l.enrollmentFee}
                    value={formatCurrency(enrollmentFee)}
                    align={valueAlign}
                  />
                ) : null}
                <SummaryRow
                  label={l.recurringDues(freqText)}
                  value={duesAmount != null ? formatCurrency(duesAmount) : "N/A"}
                  align={valueAlign}
                />
              </tbody>
            </table>
          </Section>
          <Button href={checkoutUrl} style={styles.ctaButton} className="email-cta-button">
            {l.step2Cta}
          </Button>
          <Text style={styles.muted}>
            <strong>{l.nextSteps}</strong>
          </Text>
          <ul style={styles.list}>
            {enrollmentFee ? <li>{l.enrollmentCharge}</li> : null}
            <li>{l.cardSaved}</li>
            <li>{l.agreementNote}</li>
          </ul>
        </>
      ) : (
        <>
          {/* Manual payment path */}
          <Heading as="h2" style={styles.stepHeading}>
            {l.step2Title}
          </Heading>
          <Text style={styles.muted}>{l.manualPaymentDesc}</Text>
          {(planName || duesAmount != null || enrollmentFee) && (
            <Section style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>{l.summaryTitle}</Text>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <SummaryRow label={l.plan} value={planName || "Membership"} align={valueAlign} />
                  {enrollmentFee ? (
                    <SummaryRow
                      label={l.enrollmentFee}
                      value={formatCurrency(enrollmentFee)}
                      align={valueAlign}
                    />
                  ) : null}
                  <SummaryRow
                    label={l.recurringDues(freqText)}
                    value={duesAmount != null ? formatCurrency(duesAmount) : "N/A"}
                    align={valueAlign}
                  />
                  <tr>
                    <td style={{ padding: "10px 0 0", borderTop: "1px solid #e5e7eb", fontWeight: 600, color: "#1a1a1a" }}>{l.total}</td>
                    <td style={{ padding: "10px 0 0", borderTop: "1px solid #e5e7eb", textAlign: (valueAlign ?? "right") as React.CSSProperties["textAlign"], fontWeight: 700, color: "#1a1a1a", fontSize: "16px" }}>
                      {formatCurrency((enrollmentFee || 0) + (duesAmount || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}
          <Text style={styles.muted}>
            {l.agreementNote}
          </Text>
        </>
      )}

      <Text style={styles.muted}>{l.contact}</Text>
    </EmailLayout>
  );
}

export async function renderWelcome(props: WelcomeProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  const l = t[lang];
  const subject =
    props.paymentMethod === "stripe"
      ? l.subjectStripe(orgName)
      : l.subjectManual(orgName);
  return renderEmail(<WelcomeEmail {...props} />, subject);
}

export default function WelcomePreview() {
  return (
    <WelcomeEmail
      memberName="Ahmad Khan"
      organizationName="Masjid Muhajireen"
      inviteUrl="https://example.com/portal/accept-invite?token=abc123"
      inviteExpiresAt="2025-02-15"
      paymentMethod="stripe"
      checkoutUrl="https://checkout.stripe.com/pay/cs_test_abc123"
      planName="Family Plan"
      enrollmentFee={100}
      duesAmount={50}
      billingFrequency="monthly"
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
  stepHeading: {
    color: "#1a1a1a",
    fontSize: "18px",
    margin: "30px 0 10px 0",
    paddingBottom: "8px",
    borderBottom: "2px solid #e5e7eb",
  },
  ctaButton: {
    display: "inline-block" as const,
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "8px",
    marginTop: "16px",
    textDecoration: "none" as const,
    fontWeight: 500 as const,
  },
  summaryBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    padding: "20px",
    margin: "20px 0",
  },
  summaryTitle: {
    margin: "0 0 15px 0",
    fontSize: "16px",
    fontWeight: 600 as const,
    color: "#1a1a1a",
  },
  manualSummaryBox: {
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    borderRadius: "8px",
    padding: "20px",
    margin: "20px 0",
  },
  manualSummaryTitle: {
    margin: "0 0 15px 0",
    fontSize: "16px",
    fontWeight: 600 as const,
    color: "#92400e",
  },
  manualPaymentText: {
    margin: "15px 0 0 0",
    fontSize: "14px",
    color: "#92400e",
    borderTop: "1px solid #f59e0b",
    paddingTop: "12px",
  },
  warningBox: {
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    borderRadius: "8px",
    padding: "16px",
    margin: "20px 0",
  },
  warningText: {
    margin: "0" as const,
    color: "#92400e",
    fontSize: "14px",
  },
};
