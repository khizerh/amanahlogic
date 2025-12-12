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
  PaymentType,
  PaymentStatus,
  Child,
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
  stripeConnectId: null,
  stripeOnboarded: false,
  platformFee: 1.0,
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
// Helper Functions
// -----------------------------------------------------------------------------

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString();
}

function generateId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(4, '0')}`;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    const hasSpouse = Math.random() > 0.3;
    const childCount = hasSpouse ? randomInt(0, 4) : randomInt(0, 2);

    const children: Child[] = [];
    for (let c = 0; c < childCount; c++) {
      children.push({
        id: `child_${i}_${c}`,
        name: `${randomChoice(firstNames)} ${lastName}`,
        dateOfBirth: randomDate(new Date('2005-01-01'), new Date('2020-12-31')),
      });
    }

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
      createdAt: randomDate(new Date('2019-01-01'), new Date('2024-06-01')),
      updatedAt: randomDate(new Date('2024-01-01'), new Date('2024-12-01')),
    });
  }

  return members;
}

// Generate memberships based on members
function generateMemberships(members: Member[]): Membership[] {
  const statuses: MembershipStatus[] = ['pending', 'awaiting_signature', 'waiting_period', 'active', 'lapsed', 'cancelled'];
  const statusWeights = [0.05, 0.05, 0.50, 0.25, 0.10, 0.05]; // Realistic distribution

  function weightedStatus(): MembershipStatus {
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < statuses.length; i++) {
      cumulative += statusWeights[i];
      if (rand < cumulative) return statuses[i];
    }
    return 'waiting_period';
  }

  return members.map((member, idx) => {
    const status = weightedStatus();
    const hasSpouse = member.spouseName !== null;
    const planType: PlanType = hasSpouse ? (Math.random() > 0.2 ? 'married' : 'widow') : 'single';
    const plan = mockPlans.find(p => p.type === planType)!;
    const billingFrequency: BillingFrequency = randomChoice(['monthly', 'monthly', 'monthly', 'biannual', 'annual']);

    let paidMonths = 0;
    let enrollmentFeePaid = false;
    let agreementSignedAt: string | null = null;

    // Set realistic values based on status
    switch (status) {
      case 'pending':
        paidMonths = 0;
        enrollmentFeePaid = false;
        break;
      case 'awaiting_signature':
        paidMonths = 0;
        enrollmentFeePaid = Math.random() > 0.5;
        break;
      case 'waiting_period':
        paidMonths = randomInt(1, 59);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2020-01-01'), new Date('2024-01-01'));
        break;
      case 'active':
        paidMonths = randomInt(60, 120);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2019-01-01'), new Date('2020-01-01'));
        break;
      case 'lapsed':
        paidMonths = randomInt(20, 80);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2020-01-01'), new Date('2023-01-01'));
        break;
      case 'cancelled':
        paidMonths = randomInt(5, 40);
        enrollmentFeePaid = true;
        agreementSignedAt = randomDate(new Date('2020-01-01'), new Date('2022-01-01'));
        break;
    }

    const joinDate = randomDate(new Date('2019-01-01'), new Date('2024-06-01'));
    const billingDay = randomInt(1, 28);

    // Auto-pay - about 60% of active/waiting members have it set up
    const autoPayEnabled = (status === 'active' || status === 'waiting_period') && Math.random() > 0.4;

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
      nextPaymentDue: status === 'active' || status === 'waiting_period'
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
      stripeSubscriptionId: autoPayEnabled ? `sub_${Math.random().toString(36).substr(2, 14)}` : null,
      stripeCustomerId: autoPayEnabled ? `cus_${Math.random().toString(36).substr(2, 14)}` : null,
      createdAt: joinDate,
      updatedAt: randomDate(new Date('2024-06-01'), new Date('2024-12-01')),
    };
  });
}

// Generate payments
function generatePayments(memberships: Membership[], members: Member[]): Payment[] {
  const payments: Payment[] = [];
  let paymentIdx = 1;

  memberships.forEach((membership) => {
    const member = members.find(m => m.id === membership.memberId)!;
    const plan = mockPlans.find(p => p.id === membership.planId)!;

    // Generate enrollment fee payment if paid
    if (membership.enrollmentFeePaid) {
      payments.push({
        id: generateId('pay', paymentIdx++),
        organizationId: 'org_1',
        membershipId: membership.id,
        memberId: membership.memberId,
        type: 'enrollment_fee',
        method: randomChoice(['card', 'card', 'card', 'ach', 'check'] as PaymentMethod[]),
        status: 'completed',
        amount: 500,
        stripeFee: 14.80,
        platformFee: 1.00,
        totalCharged: 514.80,
        netAmount: 499.00,
        monthsCredited: 0,
        stripePaymentIntentId: `pi_${Math.random().toString(36).substr(2, 24)}`,
        notes: null,
        recordedBy: null,
        createdAt: membership.joinDate,
        paidAt: membership.joinDate,
        refundedAt: null,
      });
    }

    // Generate some dues payments based on paid months
    const numPayments = Math.min(membership.paidMonths, 12); // Last 12 payments max
    for (let i = 0; i < numPayments; i++) {
      const method: PaymentMethod = randomChoice(['card', 'card', 'ach', 'cash', 'check', 'zelle']);
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
        platformFee: 1.00,
        totalCharged,
        netAmount: amount - 1.00,
        monthsCredited,
        stripePaymentIntentId: isManual ? null : `pi_${Math.random().toString(36).substr(2, 24)}`,
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
    activeMembers: memberships.filter(m => m.status === 'active').length,
    waitingPeriod: memberships.filter(m => m.status === 'waiting_period').length,
    lapsed: memberships.filter(m => m.status === 'lapsed').length,
    cancelled: memberships.filter(m => m.status === 'cancelled').length,
    pending: memberships.filter(m => m.status === 'pending' || m.status === 'awaiting_signature').length,
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

// Helper to get overdue members
export function getOverdueMembers(limit: number = 10): MembershipWithDetails[] {
  const now = new Date();
  return getMemberships()
    .filter(m => m.status === 'lapsed' || (m.nextPaymentDue && new Date(m.nextPaymentDue) < now))
    .slice(0, limit);
}

// Helper to get members with auto-pay enabled
export function getAutoPayMembers(): MembershipWithDetails[] {
  return getMemberships().filter(m => m.autoPayEnabled);
}

// Helper to get members without auto-pay (need to set up)
export function getMembersWithoutAutoPay(): MembershipWithDetails[] {
  return getMemberships().filter(m =>
    !m.autoPayEnabled &&
    (m.status === 'active' || m.status === 'waiting_period')
  );
}

// Format helpers
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
}

export function formatStatus(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    pending: 'Pending',
    awaiting_signature: 'Awaiting Signature',
    waiting_period: 'Waiting Period',
    active: 'Active',
    lapsed: 'Lapsed',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

export function getStatusColor(status: MembershipStatus): string {
  const colors: Record<MembershipStatus, string> = {
    pending: 'bg-gray-100 text-gray-800',
    awaiting_signature: 'bg-yellow-100 text-yellow-800',
    waiting_period: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    lapsed: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status];
}

// Returns Badge variant name for proper styling (avoids CSS specificity issues)
export function getStatusVariant(status: MembershipStatus): "success" | "info" | "warning" | "error" | "inactive" | "withdrawn" {
  const variants: Record<MembershipStatus, "success" | "info" | "warning" | "error" | "inactive" | "withdrawn"> = {
    pending: 'inactive',
    awaiting_signature: 'warning',
    waiting_period: 'info',
    active: 'success',
    lapsed: 'withdrawn',
    cancelled: 'error',
  };
  return variants[status];
}
