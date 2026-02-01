// =============================================================================
// Mock Data Layer for Development
// Provides realistic sample data for UI development without database
// =============================================================================

import {
  Organization,
  Plan,
  Member,
  Membership,
  Payment,
  MemberWithMembership,
  MembershipWithDetails,
  PaymentWithDetails,
  DashboardStats,
  MemberFilters,
  PaymentFilters,
  MembershipStatus,
  PlanType,
  BillingFrequency,
  PaymentMethod,
  Child,
  CommunicationLanguage,
  EmailTemplate,
  EmailTemplateType,
  EmailLog,
  EmailStatus,
  OnboardingInvite,
  OnboardingInviteWithMember,
  OnboardingInviteStatus,
  OverduePaymentInfo,
  AgingBucket,
} from '@/lib/types';

// -----------------------------------------------------------------------------
// Organization
// -----------------------------------------------------------------------------

export const mockOrganization: Organization = {
  id: 'org_1',
  name: 'Masjid Muhajireen',
  slug: 'masjid-muhajireen',
  address: {
    street: '1234 Islamic Center Dr',
    city: 'Houston',
    state: 'TX',
    zip: '77001',
  },
  phone: '(713) 555-0100',
  email: 'admin@masjidmuhajireen.org',
  timezone: 'America/Chicago',
  stripeConnectId: null,
  stripeOnboarded: false,
  platformFee: 2.0,
  passFeesToMember: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// -----------------------------------------------------------------------------
// Plans
// -----------------------------------------------------------------------------

export const mockPlans: Plan[] = [
  {
    id: 'plan_single',
    organizationId: 'org_1',
    type: 'single',
    name: 'Single',
    description: 'Individual coverage only',
    pricing: { monthly: 20, biannual: 120, annual: 240 },
    enrollmentFee: 500,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'plan_married',
    organizationId: 'org_1',
    type: 'married',
    name: 'Married',
    description: 'Member + spouse + children',
    pricing: { monthly: 40, biannual: 240, annual: 480 },
    enrollmentFee: 500,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'plan_widow',
    organizationId: 'org_1',
    type: 'widow',
    name: 'Widow/Widower',
    description: 'Member + children',
    pricing: { monthly: 40, biannual: 240, annual: 480 },
    enrollmentFee: 500,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// -----------------------------------------------------------------------------
// Seeded Random Number Generator (for consistent SSR/client rendering)
// -----------------------------------------------------------------------------

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Simple mulberry32 PRNG
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// Use a fixed seed for deterministic data generation
const rng = new SeededRandom(12345);

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + rng.next() * (end.getTime() - start.getTime()));
  return date.toISOString();
}

function generateId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(4, '0')}`;
}

function randomChoice<T>(arr: T[]): T {
  return rng.choice(arr);
}

function randomInt(min: number, max: number): number {
  return rng.nextInt(min, max);
}

function seededId(prefix: string): string {
  return `${prefix}_${Math.floor(rng.next() * 100000000000000).toString(36)}`;
}

// -----------------------------------------------------------------------------
// Sample Data Generation
// -----------------------------------------------------------------------------

const firstNames = [
  'Ahmed', 'Muhammad', 'Omar', 'Ali', 'Hassan', 'Ibrahim', 'Yusuf', 'Khalid', 'Tariq', 'Bilal',
  'Fatima', 'Aisha', 'Khadija', 'Maryam', 'Zahra', 'Amina', 'Sara', 'Noor', 'Layla', 'Hana',
  'Adam', 'Zaid', 'Hamza', 'Idris', 'Malik', 'Jamal', 'Kareem', 'Rashid', 'Salim', 'Nasir',
  'Hafsa', 'Ruqayyah', 'Sumaya', 'Yasmin', 'Inaya', 'Aaliyah', 'Mariam', 'Zainab', 'Asma', 'Safiya'
];

const lastNames = [
  'Khan', 'Ahmed', 'Ali', 'Hassan', 'Hussein', 'Ibrahim', 'Rahman', 'Malik', 'Shah', 'Syed',
  'Patel', 'Mohammed', 'Abdullah', 'Qureshi', 'Mirza', 'Butt', 'Chaudhry', 'Siddiqui', 'Ansari', 'Farooq',
  'Bukhari', 'Rizvi', 'Zaidi', 'Naqvi', 'Kazmi', 'Hashmi', 'Usmani', 'Nomani', 'Madani', 'Makki'
];

const streets = [
  'Oak Lane', 'Maple Drive', 'Cedar Street', 'Pine Road', 'Elm Avenue',
  'Willow Way', 'Birch Boulevard', 'Cypress Court', 'Magnolia Lane', 'Hickory Drive'
];

const cities = [
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'Austin', state: 'TX', zip: '78701' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'Fort Worth', state: 'TX', zip: '76101' },
];

// Generate members
function generateMembers(count: number): Member[] {
  const members: Member[] = [];

  for (let i = 1; i <= count; i++) {
    const firstName = randomChoice(firstNames);
    const lastName = randomChoice(lastNames);
    const location = randomChoice(cities);
    const hasSpouse = rng.next() > 0.3;
    const childCount = hasSpouse ? randomInt(0, 4) : randomInt(0, 2);

    const children: Child[] = [];
    for (let c = 0; c < childCount; c++) {
      children.push({
        id: `child_${i}_${c}`,
        name: `${randomChoice(firstNames)} ${lastName}`,
        dateOfBirth: randomDate(new Date('2005-01-01'), new Date('2020-12-31')),
      });
    }

    // ~30% Farsi speakers
    const preferredLanguage: CommunicationLanguage = rng.next() > 0.7 ? 'fa' : 'en';

    members.push({
      id: generateId('mem', i),
      organizationId: 'org_1',
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
      phone: `(713) 555-${String(randomInt(1000, 9999))}`,
      address: {
        street: `${randomInt(100, 9999)} ${randomChoice(streets)}`,
        city: location.city,
        state: location.state,
        zip: location.zip,
      },
      spouseName: hasSpouse ? `${randomChoice(firstNames)} ${lastName}` : null,
      children,
      emergencyContact: {
        name: `${randomChoice(firstNames)} ${randomChoice(lastNames)}`,
        phone: `(713) 555-${String(randomInt(1000, 9999))}`,
      },
      preferredLanguage,
      userId: null,
      createdAt: randomDate(new Date('2019-01-01'), new Date('2024-06-01')),
      updatedAt: randomDate(new Date('2024-01-01'), new Date('2024-12-01')),
    });
  }

  return members;
}

// Generate memberships based on members
function generateMemberships(members: Member[]): Membership[] {
  // Simplified statuses: pending, current, lapsed, cancelled
  // Eligibility (60+ months) is tracked separately
  const statuses: MembershipStatus[] = ['pending', 'current', 'lapsed', 'cancelled'];
  const statusWeights = [0.10, 0.70, 0.15, 0.05]; // Realistic distribution

  function weightedStatus(): MembershipStatus {
    const rand = rng.next();
    let cumulative = 0;
    for (let i = 0; i < statuses.length; i++) {
      cumulative += statusWeights[i];
      if (rand < cumulative) return statuses[i];
    }
    return 'current';
  }

  return members.map((member, idx) => {
    const status = weightedStatus();
    const hasSpouse = member.spouseName !== null;
    const planType: PlanType = hasSpouse ? (rng.next() > 0.2 ? 'married' : 'widow') : 'single';
    const plan = mockPlans.find(p => p.type === planType)!;
    const billingFrequency: BillingFrequency = randomChoice(['monthly', 'monthly', 'monthly', 'biannual', 'annual']);

    let paidMonths = 0;
    let enrollmentFeePaid = false;
    let agreementSignedAt: string | null = null;

    // Set realistic values based on status
    switch (status) {
      case 'pending':
        // Onboarding incomplete - no agreement or payment yet
        paidMonths = 0;
        enrollmentFeePaid = false;
        break;
      case 'current':
        // Good standing - could be any paid months (eligible or not)
        paidMonths = randomInt(1, 120);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2019-01-01'), new Date('2024-01-01'));
        break;
      case 'lapsed':
        // Behind on payments
        paidMonths = randomInt(20, 80);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2020-01-01'), new Date('2023-01-01'));
        break;
      case 'cancelled':
        // Membership voided
        paidMonths = randomInt(5, 40);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2020-01-01'), new Date('2022-01-01'));
        break;
    }

    // joinDate = when both agreement signed AND first payment completed
    // For pending members, joinDate is null
    const joinDate = agreementSignedAt;
    const billingDay = randomInt(1, 28);

    // createdAt is when admin added them to system (before or same as signing)
    const createdAt = agreementSignedAt
      ? randomDate(new Date(new Date(agreementSignedAt).getTime() - 30 * 24 * 60 * 60 * 1000), new Date(agreementSignedAt))
      : randomDate(new Date('2024-01-01'), new Date('2024-11-01'));

    // Recurring payments - about 60% of current members have it set up
    const autoPayEnabled = status === 'current' && rng.next() > 0.4;

    // Generate payment method details for recurring payment members
    const cardBrands = ['visa', 'mastercard', 'amex', 'discover'];
    const paymentMethod = autoPayEnabled ? (
      rng.next() > 0.15 ? {
        // 85% cards
        type: 'card' as const,
        last4: String(1000 + Math.floor(rng.next() * 9000)),
        brand: cardBrands[Math.floor(rng.next() * cardBrands.length)],
        expiryMonth: Math.floor(rng.next() * 12) + 1,
        expiryYear: 2025 + Math.floor(rng.next() * 5),
      } : {
        // 15% bank accounts
        type: 'us_bank_account' as const,
        last4: String(1000 + Math.floor(rng.next() * 9000)),
        bankName: ['Chase', 'Bank of America', 'Wells Fargo', 'Citi'][Math.floor(rng.next() * 4)],
      }
    ) : null;

    // Subscription status for recurring payment members
    const subscriptionStatus = autoPayEnabled
      ? (rng.next() > 0.1 ? 'active' : (rng.next() > 0.5 ? 'paused' : 'past_due')) as 'active' | 'paused' | 'past_due'
      : null;

    return {
      id: generateId('mship', idx + 1),
      organizationId: 'org_1',
      memberId: member.id,
      planId: plan.id,
      status,
      billingFrequency,
      billingAnniversaryDay: billingDay,
      paidMonths,
      enrollmentFeePaid,
      joinDate,
      lastPaymentDate: paidMonths > 0 ? randomDate(new Date('2024-06-01'), new Date('2024-11-30')) : null,
      nextPaymentDue: status === 'current'
        ? new Date(2024, 11, billingDay).toISOString()
        : null,
      eligibleDate: paidMonths >= 60
        ? randomDate(new Date('2024-01-01'), new Date('2024-06-01'))
        : null,
      cancelledDate: status === 'cancelled'
        ? randomDate(new Date('2024-01-01'), new Date('2024-10-01'))
        : null,
      agreementSignedAt,
      agreementId: agreementSignedAt ? generateId('agr', idx + 1) : null,
      autoPayEnabled,
      stripeSubscriptionId: autoPayEnabled ? seededId('sub') : null,
      stripeCustomerId: autoPayEnabled ? seededId('cus') : null,
      subscriptionStatus,
      paymentMethod,
      createdAt,
      updatedAt: randomDate(new Date('2024-06-01'), new Date('2024-12-01')),
    };
  });
}

// Generate payments
function generatePayments(memberships: Membership[], _members: Member[]): Payment[] {
  const payments: Payment[] = [];
  let paymentIdx = 1;

  memberships.forEach((membership) => {
    const plan = mockPlans.find(p => p.id === membership.planId)!

    // Generate enrollment fee payment if paid
    if (membership.enrollmentFeePaid) {
      const enrollMethod: PaymentMethod = randomChoice(['stripe', 'stripe', 'stripe', 'stripe', 'check']);
      const enrollIsManual = enrollMethod === 'check';
      payments.push({
        id: generateId('pay', paymentIdx++),
        organizationId: 'org_1',
        membershipId: membership.id,
        memberId: membership.memberId,
        type: 'enrollment_fee',
        method: enrollMethod,
        status: 'completed',
        amount: 500,
        stripeFee: enrollIsManual ? 0 : 14.80,
        platformFee: 2.00,
        totalCharged: enrollIsManual ? 500 : 514.80,
        netAmount: 498.00,
        monthsCredited: 0,
        stripePaymentIntentId: enrollIsManual ? null : seededId('pi'),
        checkNumber: enrollIsManual ? `${randomInt(1000, 9999)}` : null,
        zelleTransactionId: null,
        notes: enrollIsManual ? 'Enrollment fee - check payment' : null,
        recordedBy: enrollIsManual ? 'Admin User' : null,
        createdAt: membership.joinDate || membership.createdAt,
        paidAt: membership.joinDate || membership.createdAt,
        refundedAt: null,
      });
    }

    // Generate some dues payments based on paid months
    const numPayments = Math.min(membership.paidMonths, 12); // Last 12 payments max
    for (let i = 0; i < numPayments; i++) {
      const method: PaymentMethod = randomChoice(['stripe', 'stripe', 'stripe', 'cash', 'check', 'zelle']);
      const isManual = ['cash', 'check', 'zelle'].includes(method);

      let amount: number;
      let monthsCredited: number;

      switch (membership.billingFrequency) {
        case 'annual':
          amount = plan.pricing.annual;
          monthsCredited = 12;
          break;
        case 'biannual':
          amount = plan.pricing.biannual;
          monthsCredited = 6;
          break;
        default:
          amount = plan.pricing.monthly;
          monthsCredited = 1;
      }

      const stripeFee = isManual ? 0 : parseFloat((amount * 0.029 + 0.30).toFixed(2));
      const totalCharged = isManual ? amount : amount + stripeFee;

      payments.push({
        id: generateId('pay', paymentIdx++),
        organizationId: 'org_1',
        membershipId: membership.id,
        memberId: membership.memberId,
        type: 'dues',
        method,
        status: 'completed',
        amount,
        stripeFee,
        platformFee: 2.00,
        totalCharged,
        netAmount: amount - 2.00,
        monthsCredited,
        stripePaymentIntentId: isManual ? null : seededId('pi'),
        checkNumber: method === 'check' ? `${randomInt(1000, 9999)}` : null,
        zelleTransactionId: method === 'zelle' ? seededId('zelle') : null,
        notes: isManual ? `${method} payment recorded` : null,
        recordedBy: isManual ? 'Admin User' : null,
        createdAt: randomDate(new Date('2024-01-01'), new Date('2024-11-30')),
        paidAt: randomDate(new Date('2024-01-01'), new Date('2024-11-30')),
        refundedAt: null,
      });
    }
  });

  // Sort by date
  return payments.sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());
}

// -----------------------------------------------------------------------------
// Generated Mock Data
// -----------------------------------------------------------------------------

export const mockMembers: Member[] = generateMembers(50);
export const mockMemberships: Membership[] = generateMemberships(mockMembers);
export const mockPayments: Payment[] = generatePayments(mockMemberships, mockMembers);

// -----------------------------------------------------------------------------
// Onboarding Invites (Stripe Checkout Session Tracking)
// -----------------------------------------------------------------------------

function generateOnboardingInvites(): OnboardingInvite[] {
  const invites: OnboardingInvite[] = [];
  const now = new Date();

  // Find members without recurring payments to create invites for
  const membersWithoutAutoPay = mockMemberships.filter(
    m => !m.autoPayEnabled && m.status === 'current'
  );

  // Create some pending invites (sent but not completed)
  membersWithoutAutoPay.slice(0, 5).forEach((membership, i) => {
    const sentDate = new Date(now);
    sentDate.setDate(sentDate.getDate() - (i + 1)); // 1-5 days ago

    const plan = mockPlans.find(p => p.id === membership.planId);

    invites.push({
      id: `invite_pending_${i + 1}`,
      organizationId: 'org_1',
      membershipId: membership.id,
      memberId: membership.memberId,
      paymentMethod: 'stripe',
      stripeCheckoutSessionId: `cs_live_${Math.random().toString(36).substring(2, 15)}`,
      stripeSetupIntentId: null,
      enrollmentFeeAmount: plan?.enrollmentFee || 500,
      includesEnrollmentFee: true,
      enrollmentFeePaidAt: null,
      duesAmount: plan?.pricing.monthly || 20,
      billingFrequency: membership.billingFrequency,
      duesPaidAt: null,
      plannedAmount: plan?.pricing.monthly || 20,
      firstChargeDate: new Date(now.getFullYear(), now.getMonth() + 1, membership.billingAnniversaryDay).toISOString(),
      status: 'pending',
      sentAt: sentDate.toISOString(),
      completedAt: null,
      expiredAt: null,
      createdAt: sentDate.toISOString(),
      updatedAt: sentDate.toISOString(),
    });
  });

  // Create some completed invites (members who completed onboarding setup)
  const membersWithAutoPay = mockMemberships.filter(m => m.autoPayEnabled);
  membersWithAutoPay.slice(0, 8).forEach((membership, i) => {
    const sentDate = new Date(now);
    sentDate.setDate(sentDate.getDate() - (10 + i * 3)); // 10-31 days ago

    const completedDate = new Date(sentDate);
    completedDate.setDate(completedDate.getDate() + 1); // Completed 1 day after sent

    const plan = mockPlans.find(p => p.id === membership.planId);

    invites.push({
      id: `invite_completed_${i + 1}`,
      organizationId: 'org_1',
      membershipId: membership.id,
      memberId: membership.memberId,
      paymentMethod: 'stripe',
      stripeCheckoutSessionId: `cs_live_${Math.random().toString(36).substring(2, 15)}`,
      stripeSetupIntentId: null,
      enrollmentFeeAmount: plan?.enrollmentFee || 500,
      includesEnrollmentFee: true,
      enrollmentFeePaidAt: completedDate.toISOString(),
      duesAmount: plan?.pricing.monthly || 20,
      billingFrequency: membership.billingFrequency,
      duesPaidAt: completedDate.toISOString(),
      plannedAmount: plan?.pricing.monthly || 20,
      firstChargeDate: new Date(completedDate.getFullYear(), completedDate.getMonth() + 1, membership.billingAnniversaryDay).toISOString(),
      status: 'completed',
      sentAt: sentDate.toISOString(),
      completedAt: completedDate.toISOString(),
      expiredAt: null,
      createdAt: sentDate.toISOString(),
      updatedAt: completedDate.toISOString(),
    });
  });

  // Create some expired invites (link expired after 24 hours)
  membersWithoutAutoPay.slice(5, 8).forEach((membership, i) => {
    const sentDate = new Date(now);
    sentDate.setDate(sentDate.getDate() - (5 + i)); // 5-7 days ago

    const expiredDate = new Date(sentDate);
    expiredDate.setDate(expiredDate.getDate() + 1); // Expired 1 day after sent

    const plan = mockPlans.find(p => p.id === membership.planId);

    invites.push({
      id: `invite_expired_${i + 1}`,
      organizationId: 'org_1',
      membershipId: membership.id,
      memberId: membership.memberId,
      paymentMethod: 'stripe',
      stripeCheckoutSessionId: `cs_live_${Math.random().toString(36).substring(2, 15)}`,
      stripeSetupIntentId: null,
      enrollmentFeeAmount: plan?.enrollmentFee || 500,
      includesEnrollmentFee: true,
      enrollmentFeePaidAt: null,
      duesAmount: plan?.pricing.monthly || 20,
      billingFrequency: membership.billingFrequency,
      duesPaidAt: null,
      plannedAmount: plan?.pricing.monthly || 20,
      firstChargeDate: null,
      status: 'expired',
      sentAt: sentDate.toISOString(),
      completedAt: null,
      expiredAt: expiredDate.toISOString(),
      createdAt: sentDate.toISOString(),
      updatedAt: expiredDate.toISOString(),
    });
  });

  return invites;
}

export const mockOnboardingInvites: OnboardingInvite[] = generateOnboardingInvites();

// -----------------------------------------------------------------------------
// Data Access Functions (simulating API calls)
// -----------------------------------------------------------------------------

export function getMembers(filters?: MemberFilters): MemberWithMembership[] {
  let results = mockMembers.map(member => {
    const membership = mockMemberships.find(m => m.memberId === member.id) || null;
    const plan = membership ? mockPlans.find(p => p.id === membership.planId) || null : null;
    return { ...member, membership, plan };
  });

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    results = results.filter(m =>
      m.firstName.toLowerCase().includes(search) ||
      m.lastName.toLowerCase().includes(search) ||
      m.email.toLowerCase().includes(search) ||
      m.phone.includes(search)
    );
  }

  if (filters?.status && filters.status !== 'all') {
    results = results.filter(m => m.membership?.status === filters.status);
  }

  if (filters?.planType && filters.planType !== 'all') {
    results = results.filter(m => m.plan?.type === filters.planType);
  }

  if (filters?.eligibility && filters.eligibility !== 'all') {
    switch (filters.eligibility) {
      case 'eligible':
        results = results.filter(m => m.membership && m.membership.paidMonths >= 60);
        break;
      case 'approaching':
        results = results.filter(m => m.membership && m.membership.paidMonths >= 50 && m.membership.paidMonths < 60);
        break;
      case 'waiting':
        results = results.filter(m => m.membership && m.membership.paidMonths < 50);
        break;
    }
  }

  return results;
}

export function getMember(id: string): MemberWithMembership | null {
  const member = mockMembers.find(m => m.id === id);
  if (!member) return null;

  const membership = mockMemberships.find(m => m.memberId === member.id) || null;
  const plan = membership ? mockPlans.find(p => p.id === membership.planId) || null : null;

  return { ...member, membership, plan };
}

export function getMemberships(statusFilter?: MembershipStatus | 'all'): MembershipWithDetails[] {
  let results = mockMemberships;

  if (statusFilter && statusFilter !== 'all') {
    results = results.filter(m => m.status === statusFilter);
  }

  return results.map(membership => {
    const member = mockMembers.find(m => m.id === membership.memberId)!;
    const plan = mockPlans.find(p => p.id === membership.planId)!;
    const recentPayments = mockPayments
      .filter(p => p.membershipId === membership.id)
      .slice(0, 5);

    return { ...membership, member, plan, recentPayments };
  });
}

export function getMembership(id: string): MembershipWithDetails | null {
  const membership = mockMemberships.find(m => m.id === id);
  if (!membership) return null;

  const member = mockMembers.find(m => m.id === membership.memberId)!;
  const plan = mockPlans.find(p => p.id === membership.planId)!;
  const recentPayments = mockPayments.filter(p => p.membershipId === membership.id);

  return { ...membership, member, plan, recentPayments };
}

export function getPayments(filters?: PaymentFilters): PaymentWithDetails[] {
  let results = mockPayments;

  if (filters?.method && filters.method !== 'all') {
    results = results.filter(p => p.method === filters.method);
  }

  if (filters?.type && filters.type !== 'all') {
    results = results.filter(p => p.type === filters.type);
  }

  if (filters?.status && filters.status !== 'all') {
    results = results.filter(p => p.status === filters.status);
  }

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    results = results.filter(p => {
      const member = mockMembers.find(m => m.id === p.memberId);
      return member && (
        member.firstName.toLowerCase().includes(search) ||
        member.lastName.toLowerCase().includes(search) ||
        member.email.toLowerCase().includes(search)
      );
    });
  }

  return results.map(payment => {
    const member = mockMembers.find(m => m.id === payment.memberId)!;
    const membership = mockMemberships.find(m => m.id === payment.membershipId)!;
    return { ...payment, member, membership };
  });
}

export function getPayment(id: string): PaymentWithDetails | null {
  const payment = mockPayments.find(p => p.id === id);
  if (!payment) return null;

  const member = mockMembers.find(m => m.id === payment.memberId)!;
  const membership = mockMemberships.find(m => m.id === payment.membershipId)!;

  return { ...payment, member, membership };
}

export function getDashboardStats(): DashboardStats {
  const memberships = mockMemberships;
  const payments = mockPayments;

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisYear = new Date(now.getFullYear(), 0, 1);

  const monthlyPayments = payments.filter(p =>
    p.status === 'completed' &&
    p.paidAt &&
    new Date(p.paidAt) >= thisMonth
  );

  const yearlyPayments = payments.filter(p =>
    p.status === 'completed' &&
    p.paidAt &&
    new Date(p.paidAt) >= thisYear
  );

  return {
    totalMembers: mockMembers.length,
    // "current" = good standing (payments up to date)
    activeMembers: memberships.filter(m => m.status === 'current').length,
    // Eligible = 60+ paid months (separate from status)
    eligibleMembers: memberships.filter(m => m.paidMonths >= 60 && m.status !== 'cancelled').length,
    lapsed: memberships.filter(m => m.status === 'lapsed').length,
    cancelled: memberships.filter(m => m.status === 'cancelled').length,
    pending: memberships.filter(m => m.status === 'pending').length,
    monthlyRevenue: monthlyPayments.reduce((sum, p) => sum + p.amount, 0),
    yearlyRevenue: yearlyPayments.reduce((sum, p) => sum + p.amount, 0),
    approachingEligibility: memberships.filter(m => m.paidMonths >= 50 && m.paidMonths < 60).length,
    overduePayments: memberships.filter(m =>
      m.status === 'lapsed' ||
      (m.nextPaymentDue && new Date(m.nextPaymentDue) < now)
    ).length,
  };
}

export function getPlans(): Plan[] {
  return mockPlans;
}

export function getPlan(id: string): Plan | null {
  return mockPlans.find(p => p.id === id) || null;
}

export function getOrganization(): Organization {
  return mockOrganization;
}

// Helper to get recent signups
export function getRecentSignups(limit: number = 5): MemberWithMembership[] {
  return getMembers()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

// Helper to get approaching eligibility
export function getApproachingEligibility(limit: number = 10): MembershipWithDetails[] {
  return getMemberships()
    .filter(m => m.paidMonths >= 50 && m.paidMonths < 60)
    .sort((a, b) => b.paidMonths - a.paidMonths)
    .slice(0, limit);
}

// -----------------------------------------------------------------------------
// Overdue Payment Helpers
// -----------------------------------------------------------------------------

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a payment is overdue (past due date)
 */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const now = new Date();
  const due = new Date(dueDate);
  return daysBetween(due, now) > 0;
}

/**
 * Get days overdue for a due date
 */
export function getDaysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.max(0, daysBetween(due, now));
}

/**
 * Get overdue payment information with proper calculations
 */
export function getOverduePayments(): OverduePaymentInfo[] {
  const results: OverduePaymentInfo[] = [];

  getMemberships().forEach(m => {
    if (!m.nextPaymentDue) return;
    if (!isOverdue(m.nextPaymentDue)) return;

    const plan = mockPlans.find(p => p.id === m.planId);
    const daysOverdue = getDaysOverdue(m.nextPaymentDue);
    const amountDue = plan
      ? (m.billingFrequency === 'monthly'
          ? plan.pricing.monthly
          : m.billingFrequency === 'biannual'
          ? plan.pricing.biannual
          : plan.pricing.annual)
      : 0;

    results.push({
      id: `overdue_${m.id}`,
      membershipId: m.id,
      memberId: m.member.id,
      memberName: `${m.member.firstName} ${m.member.lastName}`,
      memberEmail: m.member.email,
      planName: plan?.name || 'Unknown',
      amountDue,
      dueDate: m.nextPaymentDue,
      daysOverdue,
      lastPaymentDate: m.lastPaymentDate,
      paidMonths: m.paidMonths,
      membershipStatus: m.status,
      reminderCount: Math.min(Math.floor(daysOverdue / 7), 3), // Mock: 1 reminder per week, max 3
      lastReminderSent: daysOverdue > 7 ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() : null,
      remindersPaused: false,
    });
  });

  // Sort by days overdue descending
  return results.sort((a, b) => b.daysOverdue - a.daysOverdue);
}


/**
 * Get aging buckets for overdue analysis
 */
export function getAgingBuckets(): AgingBucket[] {
  const overduePayments = getOverduePayments();

  const buckets: AgingBucket[] = [
    { range: '1-7 days', count: 0, totalAmount: 0 },
    { range: '8-30 days', count: 0, totalAmount: 0 },
    { range: '31-60 days', count: 0, totalAmount: 0 },
    { range: '61-90 days', count: 0, totalAmount: 0 },
    { range: '90+ days', count: 0, totalAmount: 0 },
  ];

  overduePayments.forEach(p => {
    const days = p.daysOverdue;
    let bucketIndex = 0;
    if (days <= 7) bucketIndex = 0;
    else if (days <= 30) bucketIndex = 1;
    else if (days <= 60) bucketIndex = 2;
    else if (days <= 90) bucketIndex = 3;
    else bucketIndex = 4;

    buckets[bucketIndex].count++;
    buckets[bucketIndex].totalAmount += p.amountDue;
  });

  return buckets;
}

/**
 * Legacy function - kept for backwards compatibility
 * @deprecated Use getOverduePayments() instead
 */
export function getOverdueMembers(limit: number = 10): MembershipWithDetails[] {
  const now = new Date();

  return getMemberships()
    .filter(m => m.nextPaymentDue && new Date(m.nextPaymentDue) < now)
    .slice(0, limit);
}

// -----------------------------------------------------------------------------
// Onboarding Invite Helpers
// -----------------------------------------------------------------------------

/**
 * Get onboarding invites with member details
 */
export function getOnboardingInvites(status?: OnboardingInviteStatus): OnboardingInviteWithMember[] {
  let invites = mockOnboardingInvites;

  if (status) {
    invites = invites.filter(i => i.status === status);
  }

  return invites.map(invite => {
    const member = mockMembers.find(m => m.id === invite.memberId)!;
    const membership = mockMemberships.find(m => m.id === invite.membershipId)!;
    const plan = mockPlans.find(p => p.id === membership?.planId)!;
    return { ...invite, member, membership, plan };
  }).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

// Legacy alias for backward compatibility
export const getAutoPayInvites = getOnboardingInvites;

/**
 * Get pending onboarding invites count
 */
export function getPendingInvitesCount(): number {
  return mockOnboardingInvites.filter(i => i.status === 'pending').length;
}

/**
 * Helper to get members with recurring payments enabled
 */
export function getAutoPayMembers(): MembershipWithDetails[] {
  return getMemberships().filter(m => m.autoPayEnabled);
}

/**
 * Helper to get members without auto-pay AND no pending invite
 * These are members who could be sent onboarding invites
 */
export function getMembersWithoutAutoPay(): MembershipWithDetails[] {
  const pendingInviteMemberIds = new Set(
    mockOnboardingInvites
      .filter(i => i.status === 'pending')
      .map(i => i.memberId)
  );

  return getMemberships().filter(m =>
    !m.autoPayEnabled &&
    !pendingInviteMemberIds.has(m.member.id) &&
    m.status === 'current'
  );
}

// Format helpers - re-exported from utils/formatters for backward compatibility
export {
  formatCurrency,
  formatDate,
  formatStatus,
  formatPlanType,
  getStatusColor,
  getStatusVariant,
} from "@/lib/utils/formatters";

// -----------------------------------------------------------------------------
// Email Templates
// -----------------------------------------------------------------------------

export const mockEmailTemplates: EmailTemplate[] = [
  {
    id: 'tmpl_welcome',
    organizationId: 'org_1',
    type: 'welcome',
    name: 'Welcome Email',
    description: 'Sent when a new member signs up',
    subject: {
      en: 'Welcome to {{organization_name}} Burial Benefits Program',
      fa: 'به برنامه مزایای تدفین {{organization_name}} خوش آمدید',
    },
    body: {
      en: `Dear {{member_name}},

Welcome to the {{organization_name}} Burial Benefits Program! We are honored to have you as a member of our community.

Your membership details:
- Plan: {{plan_name}}
- Monthly dues: {{monthly_amount}}

To complete your enrollment, please sign the membership agreement and ensure your enrollment fee is paid.

If you have any questions, please don't hesitate to contact us.

JazakAllah Khair,
{{organization_name}}`,
      fa: `{{member_name}} عزیز،

به برنامه مزایای تدفین {{organization_name}} خوش آمدید! ما از داشتن شما به عنوان عضوی از جامعه خود مفتخریم.

جزئیات عضویت شما:
- برنامه: {{plan_name}}
- حق عضویت ماهانه: {{monthly_amount}}

برای تکمیل ثبت نام، لطفا توافقنامه عضویت را امضا کنید و از پرداخت هزینه ثبت نام اطمینان حاصل کنید.

اگر سوالی دارید، لطفا با ما تماس بگیرید.

جزاک الله خیر،
{{organization_name}}`,
    },
    variables: ['member_name', 'organization_name', 'plan_name', 'monthly_amount'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_payment_receipt',
    organizationId: 'org_1',
    type: 'payment_receipt',
    name: 'Payment Receipt',
    description: 'Sent after a successful payment',
    subject: {
      en: 'Payment Receipt - {{amount}}',
      fa: 'رسید پرداخت - {{amount}}',
    },
    body: {
      en: `Dear {{member_name}},

Thank you for your payment of {{amount}}.

Payment Details:
- Date: {{payment_date}}
- Amount: {{amount}}
- Type: {{payment_type}}
- Months Credited: {{months_credited}}

Your Progress:
- Total Paid Months: {{paid_months}}/60
- Status: {{membership_status}}

Thank you for your continued support.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

از پرداخت شما به مبلغ {{amount}} متشکریم.

جزئیات پرداخت:
- تاریخ: {{payment_date}}
- مبلغ: {{amount}}
- نوع: {{payment_type}}
- ماه‌های اعتبار داده شده: {{months_credited}}

پیشرفت شما:
- کل ماه‌های پرداخت شده: {{paid_months}}/60
- وضعیت: {{membership_status}}

از حمایت مستمر شما متشکریم.

{{organization_name}}`,
    },
    variables: ['member_name', 'amount', 'payment_date', 'payment_type', 'months_credited', 'paid_months', 'membership_status', 'organization_name'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_payment_reminder',
    organizationId: 'org_1',
    type: 'payment_reminder',
    name: 'Payment Reminder',
    description: 'Sent before payment is due',
    subject: {
      en: 'Payment Reminder - Due {{due_date}}',
      fa: 'یادآوری پرداخت - موعد {{due_date}}',
    },
    body: {
      en: `Dear {{member_name}},

This is a friendly reminder that your membership dues of {{amount}} are due on {{due_date}}.

Your current progress: {{paid_months}}/60 months

Please ensure your payment is made on time to maintain your membership status.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

این یک یادآوری دوستانه است که حق عضویت شما به مبلغ {{amount}} در تاریخ {{due_date}} موعد پرداخت می‌باشد.

پیشرفت فعلی شما: {{paid_months}}/60 ماه

لطفا اطمینان حاصل کنید که پرداخت شما به موقع انجام می‌شود تا وضعیت عضویت شما حفظ شود.

{{organization_name}}`,
    },
    variables: ['member_name', 'amount', 'due_date', 'paid_months', 'organization_name'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_payment_failed',
    organizationId: 'org_1',
    type: 'payment_failed',
    name: 'Payment Failed',
    description: 'Sent when auto-pay fails',
    subject: {
      en: 'Payment Failed - Action Required',
      fa: 'پرداخت ناموفق - نیاز به اقدام',
    },
    body: {
      en: `Dear {{member_name}},

We were unable to process your payment of {{amount}} on {{payment_date}}.

Reason: {{failure_reason}}

Please update your payment method or contact us to make alternative arrangements.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

ما قادر به پردازش پرداخت شما به مبلغ {{amount}} در تاریخ {{payment_date}} نبودیم.

دلیل: {{failure_reason}}

لطفا روش پرداخت خود را به‌روز کنید یا برای ترتیبات جایگزین با ما تماس بگیرید.

{{organization_name}}`,
    },
    variables: ['member_name', 'amount', 'payment_date', 'failure_reason', 'organization_name'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_overdue_notice',
    organizationId: 'org_1',
    type: 'overdue_notice',
    name: 'Overdue Notice',
    description: 'Sent when payment is overdue',
    subject: {
      en: 'Overdue Notice - Payment Required',
      fa: 'اخطار تأخیر - پرداخت لازم است',
    },
    body: {
      en: `Dear {{member_name}},

Your membership payment is now overdue. Your last payment was on {{last_payment_date}}.

Amount Due: {{amount}}
Days Overdue: {{days_overdue}}

Please make your payment as soon as possible to avoid any interruption to your membership benefits.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

پرداخت عضویت شما اکنون عقب افتاده است. آخرین پرداخت شما در تاریخ {{last_payment_date}} بود.

مبلغ بدهی: {{amount}}
روزهای تأخیر: {{days_overdue}}

لطفا در اسرع وقت پرداخت خود را انجام دهید تا از هرگونه وقفه در مزایای عضویت خود جلوگیری کنید.

{{organization_name}}`,
    },
    variables: ['member_name', 'amount', 'last_payment_date', 'days_overdue', 'organization_name'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_eligibility_reached',
    organizationId: 'org_1',
    type: 'eligibility_reached',
    name: 'Eligibility Reached',
    description: 'Sent when member reaches 60 paid months',
    subject: {
      en: 'Congratulations! You Are Now Eligible for Benefits',
      fa: 'تبریک! شما اکنون واجد شرایط مزایا هستید',
    },
    body: {
      en: `Dear {{member_name}},

Alhamdulillah! We are pleased to inform you that you have completed 60 months of paid membership and are now fully eligible for burial benefits.

Eligibility Date: {{eligibility_date}}
Total Paid Months: {{paid_months}}

May Allah bless you and your family. Please continue to maintain your membership by making timely payments.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

الحمدلله! ما خوشحالیم که به شما اطلاع دهیم که شما 60 ماه عضویت پرداخت شده را تکمیل کرده‌اید و اکنون کاملاً واجد شرایط مزایای تدفین هستید.

تاریخ واجد شرایط شدن: {{eligibility_date}}
کل ماه‌های پرداخت شده: {{paid_months}}

خداوند شما و خانواده‌تان را برکت دهد. لطفا با پرداخت‌های به موقع عضویت خود را حفظ کنید.

{{organization_name}}`,
    },
    variables: ['member_name', 'eligibility_date', 'paid_months', 'organization_name'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_agreement_sent',
    organizationId: 'org_1',
    type: 'agreement_sent',
    name: 'Agreement Sent',
    description: 'Sent when membership agreement is ready to sign',
    subject: {
      en: 'Membership Agreement Ready for Signature',
      fa: 'توافقنامه عضویت آماده امضا است',
    },
    body: {
      en: `Dear {{member_name}},

Your membership agreement is ready for your signature. Please review and sign the agreement to complete your enrollment.

Click the link below to sign:
{{agreement_link}}

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

توافقنامه عضویت شما آماده امضای شماست. لطفا توافقنامه را بررسی و امضا کنید تا ثبت نام شما تکمیل شود.

برای امضا روی لینک زیر کلیک کنید:
{{agreement_link}}

{{organization_name}}`,
    },
    variables: ['member_name', 'agreement_link', 'organization_name'],
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_agreement_signed',
    organizationId: 'org_1',
    type: 'agreement_signed',
    name: 'Agreement Signed',
    description: 'Confirmation after agreement is signed',
    subject: {
      en: 'Membership Agreement Signed Successfully',
      fa: 'توافقنامه عضویت با موفقیت امضا شد',
    },
    body: {
      en: `Dear {{member_name}},

Thank you for signing your membership agreement. Your enrollment is now complete.

Signed Date: {{signed_date}}
Agreement ID: {{agreement_id}}

A copy of your signed agreement is attached.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

از امضای توافقنامه عضویت شما متشکریم. ثبت نام شما اکنون تکمیل شده است.

تاریخ امضا: {{signed_date}}
شناسه توافقنامه: {{agreement_id}}

یک نسخه از توافقنامه امضا شده شما پیوست شده است.

{{organization_name}}`,
    },
    variables: ['member_name', 'signed_date', 'agreement_id', 'organization_name'],
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tmpl_membership_cancelled',
    organizationId: 'org_1',
    type: 'membership_cancelled',
    name: 'Membership Cancelled',
    description: 'Sent when membership is cancelled',
    subject: {
      en: 'Membership Cancellation Confirmation',
      fa: 'تأیید لغو عضویت',
    },
    body: {
      en: `Dear {{member_name}},

This is to confirm that your membership has been cancelled as of {{cancellation_date}}.

Total months paid: {{paid_months}}

If you believe this was done in error or would like to reinstate your membership, please contact us.

{{organization_name}}`,
      fa: `{{member_name}} عزیز،

این برای تأیید این است که عضویت شما از تاریخ {{cancellation_date}} لغو شده است.

کل ماه‌های پرداخت شده: {{paid_months}}

اگر فکر می‌کنید این اشتباهی بوده یا می‌خواهید عضویت خود را بازگردانید، لطفا با ما تماس بگیرید.

{{organization_name}}`,
    },
    variables: ['member_name', 'cancellation_date', 'paid_months', 'organization_name'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// -----------------------------------------------------------------------------
// Email Log (Sample sent emails)
// -----------------------------------------------------------------------------

function generateEmailLogs(): EmailLog[] {
  const logs: EmailLog[] = [];
  const statuses: EmailStatus[] = ['sent', 'delivered', 'delivered', 'delivered', 'failed'];
  const templateTypes: EmailTemplateType[] = ['welcome', 'payment_receipt', 'payment_reminder', 'overdue_notice'];

  // Generate sample email logs based on members
  mockMembers.slice(0, 20).forEach((member, idx) => {
    const numEmails = randomInt(1, 4);
    for (let i = 0; i < numEmails; i++) {
      const templateType = randomChoice(templateTypes);
      const template = mockEmailTemplates.find(t => t.type === templateType)!;
      const status = randomChoice(statuses);
      const lang = member.preferredLanguage;
      const sentDate = randomDate(new Date('2024-06-01'), new Date('2024-12-10'));

      logs.push({
        id: `email_${String(idx * 10 + i).padStart(4, '0')}`,
        organizationId: 'org_1',
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberEmail: member.email,
        templateType,
        to: member.email,
        subject: template.subject[lang].replace('{{organization_name}}', 'Masjid Muhajireen').replace('{{amount}}', '$20.00').replace('{{due_date}}', 'Dec 15, 2024'),
        bodyPreview: template.body[lang].substring(0, 150) + '...',
        language: lang,
        status,
        sentAt: status !== 'queued' ? sentDate : null,
        deliveredAt: status === 'delivered' ? sentDate : null,
        failureReason: status === 'failed' ? 'Mailbox not found' : null,
        resendId: status !== 'queued' ? seededId('re') : null,
        createdAt: sentDate,
      });
    }
  });

  return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const mockEmailLogs: EmailLog[] = generateEmailLogs();

// Email helper functions
export function getEmailTemplates(): EmailTemplate[] {
  return mockEmailTemplates;
}

export function getEmailTemplate(id: string): EmailTemplate | null {
  return mockEmailTemplates.find(t => t.id === id) || null;
}

export function getEmailLogs(filters?: { memberId?: string; templateType?: EmailTemplateType | 'all'; status?: EmailStatus | 'all' }): EmailLog[] {
  let results = mockEmailLogs;

  if (filters?.memberId) {
    results = results.filter(e => e.memberId === filters.memberId);
  }

  if (filters?.templateType && filters.templateType !== 'all') {
    results = results.filter(e => e.templateType === filters.templateType);
  }

  if (filters?.status && filters.status !== 'all') {
    results = results.filter(e => e.status === filters.status);
  }

  return results;
}

// Email formatters - re-exported from utils/formatters
export { getEmailTemplateTypeLabel, getEmailStatusVariant } from "@/lib/utils/formatters";

// Note: Billing service is imported separately from '@/lib/mock-data/billing-service'
// to avoid circular dependencies
