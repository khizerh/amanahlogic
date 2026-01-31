import type { EmailTemplateType } from "@/lib/types";

export interface DefaultEmailTemplate {
  type: EmailTemplateType;
  name: string;
  description: string;
  subject: { en: string; fa: string };
  body: { en: string; fa: string };
  variables: string[];
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  // ── Welcome ──────────────────────────────────────────────────────────
  {
    type: "welcome",
    name: "Welcome Email",
    description:
      "Sent when a new member is created. Includes portal invite and payment context.",
    subject: {
      en: "Welcome to {{organization_name}} - Complete Your Membership Setup",
      fa: "خوش آمدید به {{organization_name}} - تکمیل تنظیمات عضویت",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

Welcome! Your membership account has been created at {{organization_name}}. To get started, please set up your member portal account and complete your payment setup.

Step 1: Create Your Portal Account
Access your membership details, track payments, and manage your profile.

Create your account here: {{invite_url}}

Step 2: Complete Payment Setup

Plan: {{plan_name}}
Enrollment Fee: {{enrollment_fee}}
Recurring Dues ({{billing_frequency}}): {{dues_amount}}

Complete your payment setup here: {{checkout_url}}

Your portal invitation expires on {{invite_expires_at}}. If you have any questions, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

خوش آمدید! حساب عضویت شما در {{organization_name}} ایجاد شده است. برای شروع، لطفاً حساب پورتال اعضای خود را ایجاد کنید و تنظیمات پرداخت خود را تکمیل کنید.

مرحله ۱: ایجاد حساب پورتال
جزئیات عضویت، پیگیری پرداخت‌ها و مدیریت پروفایل خود را مشاهده کنید.

حساب خود را اینجا ایجاد کنید: {{invite_url}}

مرحله ۲: تکمیل تنظیمات پرداخت

طرح: {{plan_name}}
هزینه ثبت‌نام: {{enrollment_fee}}
حق عضویت ({{billing_frequency}}): {{dues_amount}}

تنظیمات پرداخت خود را اینجا تکمیل کنید: {{checkout_url}}

دعوتنامه پورتال در تاریخ {{invite_expires_at}} منقضی می‌شود. اگر سوالی دارید، لطفاً با ما تماس بگیرید.`,
    },
    variables: [
      "member_name",
      "organization_name",
      "invite_url",
      "invite_expires_at",
      "checkout_url",
      "plan_name",
      "enrollment_fee",
      "dues_amount",
      "billing_frequency",
    ],
  },

  // ── Agreement Sent ───────────────────────────────────────────────────
  {
    type: "agreement_sent",
    name: "Agreement Signing Request",
    description:
      "Sent when a membership agreement needs to be signed by the member.",
    subject: {
      en: "Action Required: Sign Your {{organization_name}} Membership Agreement",
      fa: "اقدام لازم: امضای قرارداد عضویت {{organization_name}}",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

Welcome to {{organization_name}}! To complete your membership enrollment, please review and sign your membership agreement.

Sign your agreement here: {{sign_url}}

This link will expire on {{expires_at}}. If you have any questions, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

به {{organization_name}} خوش آمدید! برای تکمیل ثبت نام عضویت خود، لطفاً قرارداد عضویت خود را بررسی و امضا کنید.

قرارداد خود را اینجا امضا کنید: {{sign_url}}

این لینک در تاریخ {{expires_at}} منقضی می‌شود. اگر سوالی دارید، لطفاً با ما تماس بگیرید.`,
    },
    variables: [
      "member_name",
      "organization_name",
      "sign_url",
      "expires_at",
    ],
  },

  // ── Payment Reminder ─────────────────────────────────────────────────
  {
    type: "payment_reminder",
    name: "Payment Reminder",
    description:
      "Sent when a member has an overdue payment. Urgency increases with each reminder.",
    subject: {
      en: "Payment Reminder: ${{amount}} Due - Invoice #{{invoice_number}} - {{organization_name}}",
      fa: "یادآوری پرداخت: ${{amount}} - فاکتور #{{invoice_number}} - {{organization_name}}",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

Your payment of \${{amount}} was due on {{due_date}} and is now {{days_overdue}} days overdue. Please make your payment to keep your membership in good standing.

Invoice: #{{invoice_number}}
Amount Due: \${{amount}}
Due Date: {{due_date}}
Days Overdue: {{days_overdue}} days

Make your payment here: {{portal_url}}

If you have already made this payment, please disregard this email. For questions, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

پرداخت شما به مبلغ \${{amount}} در تاریخ {{due_date}} سررسید بود و اکنون {{days_overdue}} روز عقب افتاده است. لطفاً پرداخت خود را انجام دهید تا عضویت شما در وضعیت خوب باقی بماند.

فاکتور: #{{invoice_number}}
مبلغ بدهی: \${{amount}}
تاریخ سررسید: {{due_date}}
روزهای عقب‌افتاده: {{days_overdue}} روز

پرداخت خود را اینجا انجام دهید: {{portal_url}}

اگر قبلاً این پرداخت را انجام داده‌اید، لطفاً این ایمیل را نادیده بگیرید. برای سوالات، لطفاً با ما تماس بگیرید.`,
    },
    variables: [
      "member_name",
      "organization_name",
      "amount",
      "due_date",
      "days_overdue",
      "invoice_number",
      "portal_url",
    ],
  },

  // ── Payment Failed ───────────────────────────────────────────────────
  {
    type: "payment_failed",
    name: "Payment Failed Notification",
    description:
      "Sent when an automatic payment fails. Asks the member to update their payment method.",
    subject: {
      en: "Payment Failed - Action Required - {{organization_name}}",
      fa: "پرداخت ناموفق - اقدام لازم - {{organization_name}}",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

We were unable to process your payment of \${{amount}}. Please update your payment method to keep your membership in good standing.

Reason: {{failure_reason}}

Update your payment method here: {{portal_url}}

If you believe this is an error or need assistance, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

متأسفانه پردازش پرداخت شما به مبلغ \${{amount}} ممکن نشد. لطفاً روش پرداخت خود را بروزرسانی کنید تا عضویت شما در وضعیت خوب باقی بماند.

دلیل: {{failure_reason}}

روش پرداخت خود را اینجا بروزرسانی کنید: {{portal_url}}

اگر فکر می‌کنید این یک خطا است یا به کمک نیاز دارید، لطفاً با ما تماس بگیرید.`,
    },
    variables: [
      "member_name",
      "organization_name",
      "amount",
      "failure_reason",
      "portal_url",
    ],
  },

  // ── Payment Setup ────────────────────────────────────────────────────
  {
    type: "payment_setup",
    name: "Payment Setup",
    description:
      "Sent to members who need to set up their Stripe payment method.",
    subject: {
      en: "Complete Your Membership Setup - {{organization_name}}",
      fa: "تکمیل تنظیمات عضویت - {{organization_name}}",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

Welcome! Your membership account has been created. Please complete your payment setup using the secure link below.

Payment Summary
Plan: {{plan_name}}
Enrollment Fee: {{enrollment_fee}}
Recurring Dues ({{billing_frequency}}): {{dues_amount}}

Complete your payment setup here: {{checkout_url}}

If you have any questions, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

خوش آمدید! حساب عضویت شما ایجاد شده است. لطفاً تنظیمات پرداخت خود را با استفاده از لینک امن زیر تکمیل کنید.

خلاصه پرداخت
طرح: {{plan_name}}
هزینه ثبت‌نام: {{enrollment_fee}}
حق عضویت ({{billing_frequency}}): {{dues_amount}}

تنظیمات پرداخت خود را اینجا تکمیل کنید: {{checkout_url}}

اگر سوالی دارید، لطفاً با ما تماس بگیرید.`,
    },
    variables: [
      "member_name",
      "organization_name",
      "checkout_url",
      "plan_name",
      "enrollment_fee",
      "dues_amount",
      "billing_frequency",
    ],
  },

  // ── Portal Link ──────────────────────────────────────────────────────
  {
    type: "portal_link",
    name: "Payment Portal Link",
    description:
      "Sent when a member requests a link to manage their Stripe payment method.",
    subject: {
      en: "Manage Your Payment Method - {{organization_name}}",
      fa: "مدیریت روش پرداخت - {{organization_name}}",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

Use the link below to manage your payment method, view your billing history, or update your payment details.

Manage your payment method here: {{portal_url}}

You can:
- Update your credit card or bank account
- View past payments and invoices
- Download receipts

If you have any questions, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

از لینک زیر برای مدیریت روش پرداخت، مشاهده تاریخچه صورتحساب، یا بروزرسانی جزئیات پرداخت خود استفاده کنید.

روش پرداخت خود را اینجا مدیریت کنید: {{portal_url}}

شما می‌توانید:
- کارت اعتباری یا حساب بانکی خود را بروزرسانی کنید
- پرداخت‌ها و صورتحساب‌های گذشته را مشاهده کنید
- رسیدها را دانلود کنید

اگر سوالی دارید، لطفاً با ما تماس بگیرید.`,
    },
    variables: ["member_name", "organization_name", "portal_url"],
  },

  // ── Member Invite ────────────────────────────────────────────────────
  {
    type: "member_invite",
    name: "Member Portal Invitation",
    description:
      "Sent to invite a member to create their portal account.",
    subject: {
      en: "You're Invited to the {{organization_name}} Member Portal",
      fa: "دعوت به پورتال اعضای {{organization_name}}",
    },
    body: {
      en: `Assalamu Alaikum {{member_name}},

You have been invited to join the {{organization_name}} member portal. Create your account to view your membership details, track payments, and manage your profile.

Create your account here: {{invite_url}}

With your portal account you can:
- View your membership status and eligibility
- Track your payment history
- Update your profile and contact information
- View and sign your membership agreement

This invitation expires on {{expires_at}}. If you have any questions, please contact us.`,
      fa: `السلام علیکم {{member_name}} عزیز،

شما به پورتال اعضای {{organization_name}} دعوت شده‌اید. حساب خود را ایجاد کنید تا جزئیات عضویت، پیگیری پرداخت‌ها و مدیریت پروفایل خود را مشاهده کنید.

حساب خود را اینجا ایجاد کنید: {{invite_url}}

با حساب پورتال خود می‌توانید:
- وضعیت عضویت و واجد شرایط بودن خود را مشاهده کنید
- تاریخچه پرداخت خود را پیگیری کنید
- پروفایل و اطلاعات تماس خود را بروزرسانی کنید
- قرارداد عضویت خود را مشاهده و امضا کنید

این دعوتنامه در تاریخ {{expires_at}} منقضی می‌شود. اگر سوالی دارید، لطفاً با ما تماس بگیرید.`,
    },
    variables: [
      "member_name",
      "organization_name",
      "invite_url",
      "expires_at",
    ],
  },
];
