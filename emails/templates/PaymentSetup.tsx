import * as React from "react";
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "../components/EmailLayout";
import { renderEmail } from "../../src/lib/email/render-email";

interface PaymentSetupProps {
  memberName: string;
  checkoutUrl: string;
  organizationName?: string;
  planName: string;
  enrollmentFee?: number;
  duesAmount: number;
  billingFrequency: string;
  language?: "en" | "fa";
  firstChargeDate?: string;
  /** When a payer is paying for another member, the beneficiary's name */
  payingForName?: string;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const freqMap = {
  en: { monthly: "monthly", biannual: "every 6 months", annual: "annually" },
  fa: { monthly: "ماهانه", biannual: "هر ۶ ماه", annual: "سالانه" },
};

function getFrequencyText(freq: string, lang: "en" | "fa") {
  const m = freqMap[lang];
  if (freq === "monthly") return m.monthly;
  if (freq === "biannual") return m.biannual;
  return m.annual;
}

const t = {
  en: {
    subject: (org: string) => `Complete Your Membership Setup - ${org}`,
    subtitle: "Membership Payment Setup",
    greeting: (name: string) => `Assalamu Alaikum ${name},`,
    body: "Please complete your payment setup using the secure link below.",
    summaryTitle: "Payment Summary",
    plan: "Plan",
    enrollmentFee: "Enrollment Fee (one-time)",
    recurringDues: (freq: string) => `Recurring Dues (${freq})`,
    cta: "Complete Payment Setup",
    nextSteps: "What happens next:",
    enrollmentCharge: "Your enrollment fee will be charged immediately",
    cardSaved: "Your card will be saved for automatic future payments",
    firstCharge: (date: string) => `Automatic payments begin ${date}`,
    confirmation: "You'll receive a confirmation once setup is complete",
    contact: "If you have any questions, please contact us.",
  },
  fa: {
    subject: (org: string) => `تکمیل تنظیمات عضویت - ${org}`,
    subtitle: "تنظیم پرداخت عضویت",
    greeting: (name: string) => `السلام علیکم ${name} عزیز،`,
    body: "لطفاً تنظیمات پرداخت خود را با استفاده از لینک امن زیر تکمیل کنید.",
    summaryTitle: "خلاصه پرداخت",
    plan: "طرح",
    enrollmentFee: "هزینه ثبت‌نام (یکبار)",
    recurringDues: (freq: string) => `حق عضویت (${freq})`,
    cta: "تکمیل تنظیمات پرداخت",
    nextSteps: "مراحل بعدی:",
    enrollmentCharge: "هزینه ثبت‌نام شما فوراً کسر می‌شود",
    cardSaved: "کارت شما برای پرداخت‌های خودکار آینده ذخیره می‌شود",
    firstCharge: (date: string) => `پرداخت‌های خودکار از ${date} شروع می‌شود`,
    confirmation: "پس از تکمیل تنظیمات، تأییدیه دریافت خواهید کرد",
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

export function PaymentSetupEmail(props: PaymentSetupProps) {
  const {
    memberName,
    checkoutUrl,
    organizationName = "Our Organization",
    planName,
    enrollmentFee,
    duesAmount,
    billingFrequency,
    language = "en",
    firstChargeDate,
    payingForName,
  } = props;
  const l = t[language];
  const freqText = getFrequencyText(billingFrequency, language);
  const valueAlign = language === "fa" ? "left" : "right";

  return (
    <EmailLayout
      title={organizationName}
      subtitle={l.subtitle}
      previewText={l.subject(organizationName)}
      greeting={l.greeting(memberName)}
      cta={{ label: l.cta, url: checkoutUrl }}
      ctaColor="#16a34a"
      language={language}
      footer={{ organization_name: organizationName }}
    >
      {payingForName && (
        <Text style={styles.text}>
          {language === "fa"
            ? `شما پرداخت عضویت ${payingForName} را انجام می‌دهید.`
            : `You are setting up payment for ${payingForName}'s membership.`}
        </Text>
      )}
      <Text style={styles.text}>{l.body}</Text>
      <Section style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>{l.summaryTitle}</Text>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <SummaryRow label={l.plan} value={planName} align={valueAlign} />
            {enrollmentFee ? (
              <SummaryRow
                label={l.enrollmentFee}
                value={formatCurrency(enrollmentFee)}
                align={valueAlign}
              />
            ) : null}
            <SummaryRow
              label={l.recurringDues(freqText)}
              value={formatCurrency(duesAmount)}
              align={valueAlign}
            />
          </tbody>
        </table>
      </Section>
      <Text style={styles.muted}>
        <strong>{l.nextSteps}</strong>
      </Text>
      <ul style={styles.list}>
        {enrollmentFee ? <li>{l.enrollmentCharge}</li> : null}
        <li>{l.cardSaved}</li>
        {firstChargeDate ? <li>{l.firstCharge(firstChargeDate)}</li> : null}
        <li>{l.confirmation}</li>
      </ul>
      <Text style={styles.muted}>{l.contact}</Text>
    </EmailLayout>
  );
}

export async function renderPaymentSetup(props: PaymentSetupProps) {
  const lang = props.language ?? "en";
  const orgName = props.organizationName ?? "Our Organization";
  return renderEmail(
    <PaymentSetupEmail {...props} />,
    t[lang].subject(orgName)
  );
}

export default function PaymentSetupPreview() {
  return (
    <PaymentSetupEmail
      memberName="Ahmad Khan"
      checkoutUrl="https://checkout.stripe.com/pay/cs_test_abc123"
      organizationName="Masjid Muhajireen"
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
};
