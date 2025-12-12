# Complete Project Specification

---

## Overview

Web application for managing burial benefits membership for Muslim communities. Handles member enrollment, payment collection, electronic agreement signing, and eligibility tracking based on paid months.

**First Customer:** Masjid Muhajireen (~1000 members)

**Architecture:** Multi-tenant SaaS supporting multiple organizations

---

## Plan Types & Pricing

| Plan    | Who's Covered              | Monthly | Bi-Annual | Annual |
|---------|----------------------------|---------|-----------|--------|
| Single  | Individual only            | $20     | $120      | $240   |
| Married | Member + spouse + children | $40     | $240      | $480   |
| Widow   | Member + children          | $40     | $240      | $480   |

**Enrollment Fee:** $500 one-time (required before dues begin)

---

## Member Data

### Primary Contact
- First name, last name
- Phone number
- Email address
- Mailing address (street, city, state, zip)

### Household (if applicable)
- Spouse name
- Children (name + date of birth for each)

### Emergency Contact
- Name
- Phone number

### Membership Info
- Plan type
- Billing frequency selected
- Join date
- Billing anniversary day (day of month for recurring charges)
- Agreement status
- Paid months count

---

## Membership Lifecycle

```
1. Sign Up (admin creates or member self-registers)
        ↓
2. Sign Membership Agreement (e-sign)
        ↓
3. Pay Enrollment Fee ($500)
        ↓
4. Set Up Recurring Dues
        ↓
5. Status: IN WAITING PERIOD
        ↓
6. Track paid months (1, 2, 3... 60)
        ↓
7. 60 paid months reached
        ↓
8. Status: ACTIVE MEMBER (eligible for burial benefit)
        ↓
9. Must stay current on payments to retain eligibility
        ↓
10. If 24 months unpaid → Status: CANCELLED
        ↓
11. Reinstatement requires paying ALL back dues
```

---

## Membership Statuses

| Status             | Description                            | Can Use Benefit? |
|--------------------|----------------------------------------|------------------|
| pending            | Account created, onboarding incomplete | No               |
| awaiting_signature | Agreement sent, not yet signed         | No               |
| waiting_period     | Signed + paying, under 60 paid months  | No               |
| active             | 60+ paid months, current on payments   | Yes              |
| lapsed             | Missed recent payment(s), in grace     | No               |
| cancelled          | 24+ months unpaid, membership void     | No               |

---

## Eligibility Rules

| Rule                  | Detail                          |
|-----------------------|---------------------------------|
| Eligibility threshold | 60 paid months                  |
| Monthly payment       | Credits 1 month                 |
| Bi-annual payment     | Credits 6 months                |
| Annual payment        | Credits 12 months               |
| Missed payments       | Pauses counter (does not reset) |
| Auto-cancel trigger   | 24 consecutive months unpaid    |
| Reinstatement         | Must pay ALL back dues in full  |

---

## Payment Architecture

### Stripe Connect (Express Model)

- Platform operates as merchant of record
- Each organization onboards as Stripe Connected Account
- Funds route automatically to org's bank account
- Stripe handles payouts, identity verification, tax reporting (1099s)

### Fee Structure

| Fee Type                              | Who Pays | How                                   |
|---------------------------------------|----------|---------------------------------------|
| Stripe processing fee (~2.9% + $0.30) | Member   | Added to charge amount                |
| Platform fee (flat $ amount)          | Org      | Deducted from payment before transfer |

**Example:** $40 dues payment with $1.00 platform fee
- Stripe fee (~$1.46) added → Member pays $41.46
- Platform fee ($1.00) kept by platform
- Org receives $39.00

> **Note:** Platform fee is configured as a fixed dollar amount per transaction, not a percentage. This simplifies accounting and provides predictable costs for organizations.

### Billing Schedule

**Anniversary Billing Model** — No proration required.

- Billing date is based on signup date (the "anniversary date")
- If member signs up on December 15th, their billing cycle starts on the 15th
- Next payment due: January 15th, then February 15th, etc.
- Same logic applies to bi-annual and annual billing frequencies
- Simplifies payment logic: no partial month calculations needed

| Signup Date | Frequency  | First Due | Second Due | Third Due  |
|-------------|------------|-----------|------------|------------|
| Dec 15      | Monthly    | Jan 15    | Feb 15     | Mar 15     |
| Dec 15      | Bi-Annual  | Jun 15    | Dec 15     | Jun 15     |
| Dec 15      | Annual     | Dec 15    | Dec 15     | Dec 15     |

### Payment Methods Supported

| Method | Type   | Notes                            |
|--------|--------|----------------------------------|
| Card   | Online | Visa, Mastercard, Amex, Discover |
| ACH    | Online | Bank transfer (lower fees)       |
| Cash   | Manual | Admin records in system          |
| Check  | Manual | Admin records in system          |
| Zelle  | Manual | Admin records in system          |

### Payment Types

| Type           | Amount             | When                          |
|----------------|--------------------|-------------------------------|
| Enrollment fee | $500               | One-time, before dues start   |
| Recurring dues | Per plan/frequency | Monthly, bi-annual, or annual |
| Back dues      | Variable           | For reinstatement             |

---

## Electronic Signature (E-Sign)

Replacing DocuSign with built-in e-sign solution.

### How It Works

1. System generates membership agreement PDF with member details
2. Member reviews agreement in browser
3. Member types name or draws signature on signature pad
4. Member checks "I agree to terms" checkbox
5. System captures: signature image, IP address, timestamp, user agent
6. Agreement PDF stamped with signature, stored securely
7. Confirmation email sent to member with signed copy

### Agreement Includes

- Membership terms and conditions
- Selected plan and pricing
- 60-month waiting period disclosure
- Payment obligations
- Cancellation policy
- Burial benefit details

### Legal Validity

E-signatures are legally binding under:
- ESIGN Act (federal)
- UETA (state-level)

Captured metadata (IP, timestamp, consent checkbox) provides audit trail.

---

## Admin Portal Features

### Dashboard

- Total members count
- Members by status (waiting, active, lapsed, cancelled)
- Members approaching eligibility (55+ months)
- Revenue this month / this year
- Recent payments
- Recent sign-ups
- Overdue members requiring attention

### Member Management

- Member directory with search
- Filter by: status, plan type, eligibility, payment status
- Member detail view with full history
- Add new member
- Edit member info
- Delete/archive member
- View paid months progress
- View payment history
- Resend agreement for signature
- Record manual payment

### Bulk Import

- CSV upload for existing members
- Column mapping interface
- Validation with error reporting
- Duplicate detection (by email/phone)
- Preview before commit
- Import history log

### Memberships

- View all memberships
- Filter by status, plan, eligibility
- Membership detail with status timeline
- Manually adjust status (with audit log)
- Manually adjust paid months (with audit log)
- Cancel membership
- Process reinstatement

### Payments

- Payment log (all payments)
- Filter by: date range, member, method, status
- Payment detail view
- Record manual payment (cash/check/zelle)
- Issue refund
- Export payment data

### Reports

- Eligibility Report: All members with 60+ paid months
- Approaching Eligibility: Members at 50-59 paid months
- Overdue Report: Members with missed payments
- Lapsed Report: Members at risk of cancellation
- Revenue Report: By period, plan, payment method
- Growth Report: New members over time
- Export all reports to CSV

### Settings

- Organization profile (name, contact, address)
- Stripe Connect setup and status
- Platform fee configuration
- Plan management (add/edit/deactivate plans)
- Eligibility rules (paid months threshold)
- Email templates customization
- Admin user management (invite, remove)

---

## Member Portal Features

### Authentication

- Sign up (create account, link to membership)
- Login (email + password)
- Forgot password / reset
- Email verification

### Member Dashboard

- Current membership status
- Plan details
- Paid months progress (visual: 47/60 months)
- Eligibility status (eligible or X months remaining)
- Next payment due date
- Recent payments

### Profile Management

- View/edit contact information
- View/edit spouse information
- View/edit children (name + DOB)
- Update emergency contact
- Change password

### Agreement

- View membership agreement
- Sign agreement (if unsigned)
- Download signed agreement PDF

### Payments

- View payment history
- Pay enrollment fee (if unpaid)
- Make dues payment (one-time)
- Set up auto-pay (recurring)
- Update payment method
- View/download receipts
- Pay back dues (if lapsed/cancelled)

### Notifications

- Email: Payment confirmation
- Email: Payment failed/retry
- Email: Approaching eligibility (at 55 months)
- Email: Now eligible (at 60 months)
- Email: Payment overdue
- Email: At risk of cancellation
- Email: Membership cancelled

---

## Technical Architecture

### Tech Stack

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Frontend      | Next.js + TypeScript + Tailwind CSS           |
| UI Components | Radix UI + custom design system               |
| Backend       | Next.js Server Actions                        |
| Database      | PostgreSQL via Supabase                       |
| Auth          | Supabase Auth                                 |
| Payments      | Stripe Connect (Express)                      |
| E-Sign        | Custom built (signature pad + PDF generation) |
| Email         | React Email + Resend                          |
| File Storage  | Supabase Storage (signed agreements)          |

### Multi-Tenant Design

- All data scoped by organization_id
- Row Level Security (RLS) on all tables
- Org-specific Stripe Connected Accounts
- Isolated admin user pools per org

### Authorization Model

- **Single admin role** — all admins within an organization have equal access
- No permission tiers (viewer, editor, owner) required
- Admins can invite/remove other admins for their organization
- Audit log tracks all admin actions for accountability

### Database Tables

| Table                | Purpose                                  |
|----------------------|------------------------------------------|
| organizations        | Org profile, Stripe Connect ID, settings |
| admin_users          | Admin accounts linked to orgs            |
| members              | Member contact info, dependents          |
| plans                | Plan types with pricing per org          |
| memberships          | Member↔Plan, status, paid months         |
| payments             | Payment records with full details        |
| agreements           | Signed agreement records + metadata      |
| stripe_customers     | Member↔Stripe customer link              |
| stripe_subscriptions | Recurring subscription tracking          |
| audit_log            | Admin actions for compliance             |

---

## Page Structure

### Admin Portal (/admin)

```
/admin
├── /                       → Dashboard
├── /members                → Member list
│   ├── /new                → Add member
│   ├── /import             → CSV import
│   └── /[id]               → Member detail
│       └── /edit           → Edit member
├── /memberships            → Membership list
│   └── /[id]               → Membership detail
├── /payments               → Payment log
│   └── /[id]               → Payment detail
├── /reports
│   ├── /eligibility        → Eligible members
│   ├── /approaching        → Almost eligible
│   ├── /overdue            → Overdue payments
│   └── /revenue            → Revenue report
└── /settings
    ├── /                   → General settings
    ├── /plans              → Manage plans
    ├── /stripe             → Stripe Connect
    ├── /emails             → Email templates
    └── /admins             → Admin users
```

### Member Portal (/)

```
/
├── /                       → Member dashboard
├── /profile                → View/edit profile
├── /agreement              → View/sign agreement
├── /payments               → Payment history
│   └── /make-payment       → Pay now
├── /settings               → Account settings
├── /login                  → Login
├── /signup                 → Create account
└── /forgot-password        → Password reset
```

---

## Phase Breakdown

### Phase 1: Foundation

**Scope:** Project setup, database, auth, layout
- Fork/setup Next.js project structure
- Database schema and migrations
- Supabase project setup
- Row Level Security policies
- Admin authentication
- Layout shell and navigation
- Basic organization settings

---

### Phase 2: Member Management

**Scope:** Full member CRUD
- Member list page with search
- Member filters (status, plan, eligibility)
- Member detail page
- Add member form
- Edit member form
- Delete/archive member
- Children management (name + DOB)
- Member data validation

---

### Phase 3: Plans & Memberships

**Scope:** Plan config and membership lifecycle
- Plans CRUD in settings
- Plan pricing configuration
- Create membership flow
- Status workflow engine
- Paid months tracking logic
- Status transitions (waiting → active → lapsed → cancelled)
- Reinstatement flow
- Manual status/months adjustment with audit

---

### Phase 4: Payments & Billing

**Scope:** Stripe Connect + payment processing
- Stripe Connect onboarding flow
- Connected account management
- Enrollment fee collection
- Recurring dues setup
- Fee passthrough to members
- Platform fee deduction
- Manual payment entry
- Payment log UI
- Refund processing
- Paid months increment on payment

---

### Phase 5: Bulk Import

**Scope:** CSV import for existing members
- CSV upload interface
- Column mapping UI
- Data validation rules
- Duplicate detection
- Error reporting
- Preview before import
- Batch processing
- Import history

---

### Phase 6: E-Sign Agreement

**Scope:** Built-in electronic signature
- Agreement template system
- PDF generation with member details
- Signature pad component
- Consent capture (checkbox, IP, timestamp)
- Signed PDF storage
- Agreement status tracking
- Resend agreement flow
- Download signed copy

---

### Phase 7: Dashboard & Reports

**Scope:** Analytics and reporting
- Admin dashboard with key metrics
- Eligibility report
- Approaching eligibility report
- Overdue payment report
- Lapsed members report
- Revenue report
- CSV export for all reports

---

### Phase 8: Settings & Polish

**Scope:** Configuration and hardening
- Organization settings
- Email template customization
- Admin user management
- Edge case handling
- Error handling improvements
- Loading states
- Mobile responsiveness
- Testing and bug fixes

---

### Phase 9: Member Portal

**Scope:** Self-service portal for members
- Member authentication (signup, login, reset)
- Member dashboard
- Profile management
- Agreement viewing/signing
- Payment history
- Make payment flow
- Auto-pay setup
- Back dues payment
- Email notifications

---

## Hour Summary

| Phase              | Scope               | Hours  |
|--------------------|---------------------|--------|
| 1                  | Foundation          | 6-8    |
| 2                  | Member Management   | 12-14  |
| 3                  | Plans & Memberships | 10-12  |
| 4                  | Payments & Billing  | 16-18  |
| 5                  | Bulk Import         | 6-8    |
| 6                  | E-Sign Agreement    | 10-12  |
| 7                  | Dashboard & Reports | 8-10   |
| 8                  | Settings & Polish   | 6-8    |
| Admin Portal Total |                     | 74-90  |
| 9                  | Member Portal       | 20-25  |
| **Full System Total** |                  | **94-115** |

---

## Investment

| Option | Scope                 | Hours  | Cost @ $40/hr   |
|--------|-----------------------|--------|-----------------|
| A      | Admin Portal Only     | 74-90  | $2,960 - $3,600 |
| B      | Admin + Member Portal | 94-115 | $3,760 - $4,600 |

---

## Milestones

### Admin Portal Only (Option A)

| Hours | Deliverable                            |
|-------|----------------------------------------|
| 8     | App running, auth working, empty shell |
| 22    | Members fully functional               |
| 34    | Plans + memberships + status workflow  |
| 52    | Payments + Stripe Connect working      |
| 60    | CSV import complete                    |
| 72    | E-sign integrated                      |
| 82    | Dashboard + reports done               |
| 90    | Polished, tested, ready for users      |

### With Member Portal (Option B)

| Hours | Deliverable                               |
|-------|-------------------------------------------|
| 90    | Admin portal complete                     |
| 100   | Member auth + dashboard                   |
| 108   | Member payments working                   |
| 115   | Member portal complete, full system ready |

---

## Deliverables

1. Fully functional web application (admin portal)
2. Member self-service portal (if Option B)
3. Database schema with migrations
4. Multi-tenant architecture
5. Admin authentication and authorization
6. Stripe Connect payment integration
7. Built-in e-signature system
8. CSV import tooling
9. Dashboard and reports
10. Documentation for admin users

---

## Open Questions

| #   | Question                                                                                         | Impact                |
|-----|--------------------------------------------------------------------------------------------------|-----------------------|
| 1   | Grace period before lapsed? How many days after missed payment before status changes to lapsed?  | Status workflow logic |
| 2   | Notification preferences? Which emails should members receive? All, or let them opt out of some? | Email system          |

### Resolved Questions

| Question | Resolution |
|----------|------------|
| Proration on signup? | **No proration.** Anniversary billing model — member signs up on the 15th, bills on the 15th each period. |
| Platform fee percentage? | **Flat dollar amount**, not percentage. Configured per organization in settings. |
| Agreement template content? | **Client provides** the legal text for the membership agreement. |
| Admin roles? | **Single admin level.** All admins have full access, no permission tiers needed. |

---

## Assumptions

- Client provides membership agreement legal text ✓ (confirmed)
- Client has or will create Stripe account for Connect onboarding
- ~1000 initial members for import
- English language only (no i18n)
- US-based organizations only (USD, US tax requirements)
- Standard Stripe fees apply (~2.9% + $0.30 card, ~0.8% ACH)
- Anniversary billing with no proration ✓ (confirmed)
- Platform fee as flat dollar amount ✓ (confirmed)
- Single admin role per organization ✓ (confirmed)
