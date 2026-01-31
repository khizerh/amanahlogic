-- =============================================================================
-- Seed Data for Burial Benefits Membership System
-- Run this after migrations to populate the database with test data
-- =============================================================================

-- Insert test organization
INSERT INTO organizations (id, name, slug, address, phone, email, timezone, platform_fee)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Masjid Muhajireen',
  'masjid-muhajireen',
  '{"street": "1234 Islamic Center Dr", "city": "Houston", "state": "TX", "zip": "77001"}',
  '+17135550100',
  'admin@masjidmuhajireen.org',
  'America/Chicago',
  2.00
);

-- Insert organization settings
INSERT INTO organization_settings (organization_id)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- Insert plans
INSERT INTO plans (id, organization_id, type, name, description, pricing, enrollment_fee) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'single', 'Single', 'Individual coverage only', '{"monthly": 20, "biannual": 120, "annual": 240}', 500),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'married', 'Married', 'Member + spouse + children', '{"monthly": 40, "biannual": 240, "annual": 480}', 500),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'widow', 'Widow/Widower', 'Member + children', '{"monthly": 40, "biannual": 240, "annual": 480}', 500);

-- Insert sample members
INSERT INTO members (id, organization_id, first_name, last_name, email, phone, address, spouse_name, children, emergency_contact, preferred_language) VALUES
-- Active eligible member
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ahmed', 'Khan', 'ahmed.khan@email.com', '+17135551001', '{"street": "123 Oak Lane", "city": "Houston", "state": "TX", "zip": "77001"}', 'Fatima Khan', '[{"id": "child_1", "name": "Yusuf Khan", "dateOfBirth": "2015-03-15"}]', '{"name": "Hassan Khan", "phone": "+17135552001"}', 'en'),
-- Waiting period member
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Muhammad', 'Ali', 'muhammad.ali@email.com', '+17135551002', '{"street": "456 Maple Drive", "city": "Houston", "state": "TX", "zip": "77002"}', NULL, '[]', '{"name": "Omar Ali", "phone": "+17135552002"}', 'en'),
-- Lapsed member
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fatima', 'Hassan', 'fatima.hassan@email.com', '+17135551003', '{"street": "789 Cedar Street", "city": "Dallas", "state": "TX", "zip": "75201"}', 'Ibrahim Hassan', '[]', '{"name": "Aisha Hassan", "phone": "+17135552003"}', 'fa'),
-- Pending member
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Omar', 'Syed', 'omar.syed@email.com', '+17135551004', '{"street": "321 Pine Road", "city": "Austin", "state": "TX", "zip": "78701"}', NULL, '[]', '{"name": "Bilal Syed", "phone": "+17135552004"}', 'en'),
-- Awaiting signature
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Aisha', 'Rahman', 'aisha.rahman@email.com', '+17135551005', '{"street": "654 Elm Avenue", "city": "Houston", "state": "TX", "zip": "77003"}', NULL, '[]', '{"name": "Maryam Rahman", "phone": "+17135552005"}', 'en');

-- Insert memberships
INSERT INTO memberships (id, organization_id, member_id, plan_id, status, billing_frequency, billing_anniversary_day, paid_months, enrollment_fee_paid, join_date, last_payment_date, next_payment_due, eligible_date, agreement_signed_at, auto_pay_enabled, stripe_customer_id, stripe_subscription_id, subscription_status, payment_method) VALUES
-- Current eligible member with STRIPE AUTOPAY (65 months paid)
-- This member has full Stripe integration for testing autopay flows
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'current', 'monthly', 15, 65, true, '2019-07-15', '2024-12-01', '2025-01-15', '2024-12-15', '2019-07-15T10:00:00Z', true, 'cus_test_ahmed_khan', 'sub_test_ahmed_khan', 'active', '{"type": "card", "last4": "4242", "brand": "visa", "expiryMonth": 12, "expiryYear": 2027}'),
-- Current member (not yet eligible) with MANUAL PAYMENTS (24 months paid)
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'current', 'monthly', 10, 24, true, '2022-12-10', '2024-12-01', '2025-01-10', NULL, '2022-12-10T10:00:00Z', false, NULL, NULL, NULL, NULL),
-- Lapsed member with MANUAL PAYMENTS (missed payments)
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'lapsed', 'monthly', 5, 45, true, '2021-01-05', '2024-10-01', '2024-11-05', NULL, '2021-01-05T10:00:00Z', false, NULL, NULL, NULL, NULL),
-- Pending member (no agreement, no payments)
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'pending', 'monthly', 1, 0, false, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL),
-- Pending (agreement sent but not signed, enrollment fee paid)
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'pending', 'monthly', 20, 0, true, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL);

-- Insert some sample payments for active member
INSERT INTO payments (organization_id, membership_id, member_id, type, method, status, amount, stripe_fee, platform_fee, total_charged, net_amount, months_credited, invoice_number, period_label, created_at, paid_at) VALUES
-- Enrollment fee
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'enrollment_fee', 'stripe', 'completed', 500.00, 14.80, 2.00, 514.80, 483.20, 0, 'INV-2019-0001', 'Enrollment Fee', '2019-07-15T10:00:00Z', '2019-07-15T10:00:00Z'),
-- Recent dues payments
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'dues', 'stripe', 'completed', 40.00, 1.46, 2.00, 41.46, 36.54, 1, 'INV-2024-0010', 'December 2024', '2024-12-01T10:00:00Z', '2024-12-01T10:00:00Z'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'dues', 'stripe', 'completed', 40.00, 1.46, 2.00, 41.46, 36.54, 1, 'INV-2024-0009', 'November 2024', '2024-11-01T10:00:00Z', '2024-11-01T10:00:00Z'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d01', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'dues', 'stripe', 'completed', 40.00, 1.46, 2.00, 41.46, 36.54, 1, 'INV-2024-0008', 'October 2024', '2024-10-01T10:00:00Z', '2024-10-01T10:00:00Z');

-- Insert payments for waiting period member
INSERT INTO payments (organization_id, membership_id, member_id, type, method, status, amount, stripe_fee, platform_fee, total_charged, net_amount, months_credited, invoice_number, period_label, created_at, paid_at) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'enrollment_fee', 'check', 'completed', 500.00, 0.00, 2.00, 500.00, 498.00, 0, 'INV-2022-0050', 'Enrollment Fee', '2022-12-10T10:00:00Z', '2022-12-10T10:00:00Z'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d02', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02', 'dues', 'cash', 'completed', 20.00, 0.00, 2.00, 20.00, 18.00, 1, 'INV-2024-0011', 'December 2024', '2024-12-01T10:00:00Z', '2024-12-01T10:00:00Z');

-- Insert a pending payment for lapsed member
INSERT INTO payments (organization_id, membership_id, member_id, type, method, status, amount, stripe_fee, platform_fee, total_charged, net_amount, months_credited, invoice_number, due_date, period_label, reminder_count, created_at) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d03', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'dues', NULL, 'pending', 40.00, 0.00, 2.00, 40.00, 38.00, 1, 'INV-2024-0012', '2024-11-05', 'November 2024', 2, '2024-11-01T10:00:00Z');

-- Insert agreement for awaiting signature member
INSERT INTO agreements (organization_id, membership_id, member_id, template_version, sent_at) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', '1.0', '2024-12-10T10:00:00Z');

-- Insert sample email logs
INSERT INTO email_logs (organization_id, member_id, member_name, member_email, template_type, "to", subject, body_preview, language, status, sent_at, delivered_at, resend_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01', 'Ahmed Khan', 'ahmed.khan@email.com', 'payment_receipt', 'ahmed.khan@email.com', 'Payment Receipt - $40.00', 'Thank you for your payment of $40.00...', 'en', 'delivered', '2024-12-01T10:01:00Z', '2024-12-01T10:01:30Z', 're_abc123'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03', 'Fatima Hassan', 'fatima.hassan@email.com', 'payment_reminder', 'fatima.hassan@email.com', 'Payment Reminder - Due Nov 5, 2024', 'This is a friendly reminder that your membership dues...', 'fa', 'delivered', '2024-11-08T10:00:00Z', '2024-11-08T10:00:30Z', 're_def456'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 'Aisha Rahman', 'aisha.rahman@email.com', 'agreement_sent', 'aisha.rahman@email.com', 'Membership Agreement Ready for Signature', 'Your membership agreement is ready for your signature...', 'en', 'delivered', '2024-12-10T10:00:00Z', '2024-12-10T10:00:30Z', 're_ghi789');

-- Insert onboarding invite for awaiting signature member
INSERT INTO onboarding_invites (organization_id, membership_id, member_id, planned_amount, status, sent_at) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d05', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05', 20.00, 'pending', '2024-12-10T11:00:00Z');

-- =============================================================================
-- Summary
-- =============================================================================
-- Organization: 1 (Masjid Muhajireen)
-- Plans: 3 (Single, Married, Widow)
-- Members: 5 (various statuses)
-- Memberships: 5
--   - Ahmed Khan: current (eligible), STRIPE AUTOPAY (has stripe_customer_id, stripe_subscription_id, subscription_status=active)
--   - Muhammad Ali: current (not yet eligible), MANUAL payments
--   - Fatima Hassan: lapsed, MANUAL payments
--   - Omar Syed: pending, no payments yet (enrollment fee NOT paid)
--   - Aisha Rahman: pending, enrollment fee paid but agreement not signed
-- Payments: 7 (enrollment fees and dues)
-- Agreements: 1 (unsigned)
-- Email Logs: 3
-- Auto Pay Invites: 1
--
-- TEST SCENARIOS:
-- 1. Try recording manual payment for Ahmed Khan -> should be BLOCKED (has active Stripe subscription)
-- 2. Click "Switch to Manual" for Ahmed Khan -> cancels Stripe subscription, then manual payment works
-- 3. Record manual payment for Muhammad Ali -> should work (no autopay)
-- 4. Send Portal Link for Ahmed Khan -> sends email with Stripe billing portal URL
--
-- NEW MEMBER CREATION TEST SCENARIOS:
-- 5. Create new member with MANUAL payment method -> creates member, redirects to detail page
-- 6. Create new member with STRIPE payment method -> creates member, redirects to Stripe Checkout
--    - Checkout includes: $500 enrollment fee (one-time) + first dues payment (subscription)
--    - On success: webhook marks enrollment_fee_paid=true, creates payment records, enables autopay
-- 7. Use Omar Syed to test "Set Up Auto-Pay" -> should include enrollment fee since not paid
