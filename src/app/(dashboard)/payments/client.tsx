"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RecordPaymentSheet } from "@/components/payments/record-payment-sheet";
import { PaymentDetailsSheet } from "@/components/payments/payment-details-sheet";
import { createColumns } from "./columns";
import { createOutstandingColumns, OutstandingPayment } from "./outstanding-columns";
import { createOnboardingColumns } from "./onboarding-columns";
import { PaymentWithDetails, OutstandingPaymentInfo } from "@/lib/database/payments";
import { OnboardingInviteWithMember, MemberWithMembership, Plan } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface AgingBucket {
  range: string;
  count: number;
  totalAmount: number;
}

interface PaymentsPageClientProps {
  initialPayments: PaymentWithDetails[];
  initialOutstandingPayments: OutstandingPaymentInfo[];
  initialAgingBuckets: AgingBucket[];
  initialOnboardingInvites: OnboardingInviteWithMember[];
  pendingInvitesCount: number;
  totalOutstanding: number;
  failedChargesCount: number;
}

const VALID_TABS = ["all", "outstanding", "onboarding"] as const;
type TabValue = typeof VALID_TABS[number];

export function PaymentsPageClient({
  initialPayments,
  initialOutstandingPayments,
  initialAgingBuckets,
  initialOnboardingInvites,
  pendingInvitesCount,
  totalOutstanding,
  failedChargesCount,
}: PaymentsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get tab from URL, default to "all"
  const tabParam = searchParams.get("tab");
  const currentTab: TabValue = VALID_TABS.includes(tabParam as TabValue) ? (tabParam as TabValue) : "all";

  // Payment details sheet state
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);

  // Member selector state
  const [memberSelectorOpen, setMemberSelectorOpen] = useState(false);
  const [membersList, setMembersList] = useState<MemberWithMembership[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Record payment sheet state
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithMembership | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);

  // Fetch members list when selector opens
  useEffect(() => {
    if (memberSelectorOpen && membersList.length === 0) {
      setMembersLoading(true);
      fetch("/api/members")
        .then((res) => res.json())
        .then((data) => {
          setMembersList(data.members || []);
        })
        .catch((err) => {
          toast.error("Failed to load members");
        })
        .finally(() => setMembersLoading(false));
    }
  }, [memberSelectorOpen, membersList.length]);

  // Handle selecting a member from the selector
  const handleSelectMember = async (memberId: string) => {
    setMemberSelectorOpen(false);
    setMemberLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}`);
      if (!res.ok) throw new Error("Failed to fetch member");

      const data = await res.json();
      setSelectedMember(data.member);
      setSelectedPlan(data.plan);
      setRecordSheetOpen(true);
    } catch (err) {
      toast.error("Failed to load member details");
    } finally {
      setMemberLoading(false);
    }
  };

  // Handle recording payment for outstanding item (pre-selected member)
  const handleRecordForOutstanding = async (memberId: string) => {
    setMemberLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}`);
      if (!res.ok) throw new Error("Failed to fetch member");

      const data = await res.json();
      setSelectedMember(data.member);
      setSelectedPlan(data.plan);
      setRecordSheetOpen(true);
    } catch (err) {
      toast.error("Failed to load member details");
    } finally {
      setMemberLoading(false);
    }
  };

  // Handle payment recorded - refresh the page
  const handlePaymentRecorded = () => {
    router.refresh();
  };

  // Handle tab change - update URL
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const newUrl = params.toString() ? `/payments?${params.toString()}` : "/payments";
    router.push(newUrl, { scroll: false });
  };

  const payments = initialPayments;
  const outstandingPayments = initialOutstandingPayments;
  const agingBuckets = initialAgingBuckets;
  const onboardingInvites = initialOnboardingInvites;

  const handleViewDetails = (payment: PaymentWithDetails) => {
    setSelectedPayment(payment);
    setDetailsSheetOpen(true);
  };

  const handleEmailReceipt = (payment: PaymentWithDetails) => {
    toast.success(`Receipt emailed to ${payment.member?.email || "member"}`);
  };

  const columns = useMemo(
    () =>
      createColumns({
        onViewDetails: handleViewDetails,
        onEmailReceipt: handleEmailReceipt,
      }),
    []
  );

  // Outstanding payments handlers
  const handleSendReminder = (payment: OutstandingPayment) => {
    toast.success(`Payment reminder sent to ${payment.memberName}`);
  };

  const handleTogglePauseReminders = (payment: OutstandingPayment) => {
    if (payment.remindersPaused) {
      toast.success(`Reminders resumed for ${payment.memberName}`);
    } else {
      toast.success(`Reminders paused for ${payment.memberName}`);
    }
  };

  const handleRecordOutstandingPayment = (payment: OutstandingPayment) => {
    handleRecordForOutstanding(payment.memberId);
  };

  const handleRetryCharge = (payment: OutstandingPayment) => {
    toast.success(`Retrying charge for ${payment.memberName}`);
  };

  const outstandingColumns = useMemo(
    () =>
      createOutstandingColumns({
        onSendReminder: handleSendReminder,
        onTogglePauseReminders: handleTogglePauseReminders,
        onRecordPayment: handleRecordOutstandingPayment,
        onRetryCharge: handleRetryCharge,
      }),
    []
  );

  // Onboarding invite handlers
  const handleCopyOnboardingLink = (invite: OnboardingInviteWithMember) => {
    if (invite.stripeCheckoutSessionId) {
      navigator.clipboard.writeText(`https://checkout.stripe.com/c/pay/${invite.stripeCheckoutSessionId}`);
      toast.success("Checkout link copied to clipboard");
    } else {
      toast.error("No checkout link available for manual payments");
    }
  };

  const handleResendOnboardingEmail = (invite: OnboardingInviteWithMember) => {
    const emailType = invite.paymentMethod === "stripe" ? "checkout" : "payment instructions";
    toast.success(`${emailType.charAt(0).toUpperCase() + emailType.slice(1)} email resent to ${invite.member.email}`);
  };

  const handleSendNewOnboardingLink = (invite: OnboardingInviteWithMember) => {
    toast.success(`New payment setup link sent to ${invite.member.email}`);
  };

  const handleRecordOnboardingPayment = async (invite: OnboardingInviteWithMember) => {
    // Load member details and open the record payment sheet
    setMemberLoading(true);
    try {
      const res = await fetch(`/api/members/${invite.memberId}`);
      if (!res.ok) throw new Error("Failed to fetch member");

      const data = await res.json();
      setSelectedMember(data.member);
      setSelectedPlan(data.plan);
      setRecordSheetOpen(true);
    } catch (err) {
      toast.error("Failed to load member details");
    } finally {
      setMemberLoading(false);
    }
  };

  const onboardingColumns = useMemo(
    () =>
      createOnboardingColumns({
        onCopyLink: handleCopyOnboardingLink,
        onResendEmail: handleResendOnboardingEmail,
        onSendNewLink: handleSendNewOnboardingLink,
        onRecordPayment: handleRecordOnboardingPayment,
      }),
    []
  );

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Payments</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage payments, track overdue accounts, and onboarding payments
              </p>
            </div>
            <Button onClick={() => setMemberSelectorOpen(true)} disabled={memberLoading}>
              {memberLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">
                All Payments
              </TabsTrigger>
              <TabsTrigger value="outstanding" className="gap-2">
                Outstanding
                {outstandingPayments.length > 0 && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5 bg-red-50 text-red-500 border-red-200">
                    {outstandingPayments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="gap-2">
                Onboarding
                {pendingInvitesCount > 0 && (
                  <Badge variant="warning" className="ml-1 h-5 px-1.5">
                    {pendingInvitesCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* All Payments Tab */}
            <TabsContent value="all">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{payments.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Outstanding
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-400">
                      {outstandingPayments.length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(totalOutstanding)} total
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Failed Charges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {failedChargesCount}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stripe failures
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending Invites
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {pendingInvitesCount}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      awaiting setup
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <DataTable
                    columns={columns}
                    data={payments}
                    searchColumn="member"
                    searchPlaceholder="Search by member name or email..."
                    filterColumns={[
                      {
                        column: "type",
                        label: "Type",
                        options: [
                          { label: "All Types", value: "all" },
                          { label: "Enrollment Fee", value: "enrollment_fee" },
                          { label: "Dues", value: "dues" },
                          { label: "Back Dues", value: "back_dues" },
                        ],
                      },
                      {
                        column: "method",
                        label: "Method",
                        options: [
                          { label: "All Methods", value: "all" },
                          { label: "Stripe", value: "stripe" },
                          { label: "Cash", value: "cash" },
                          { label: "Check", value: "check" },
                          { label: "Zelle", value: "zelle" },
                        ],
                      },
                      {
                        column: "status",
                        label: "Status",
                        options: [
                          { label: "All Statuses", value: "all" },
                          { label: "Completed", value: "completed" },
                          { label: "Pending", value: "pending" },
                          { label: "Overdue", value: "overdue" },
                          { label: "Failed", value: "failed" },
                          { label: "Refunded", value: "refunded" },
                        ],
                      },
                    ]}
                    pageSize={20}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Outstanding Tab */}
            <TabsContent value="outstanding">
              <div className="space-y-6">
                {/* Aging Buckets */}
                <div className="grid grid-cols-5 gap-4">
                  {agingBuckets.map((bucket) => (
                    <Card key={bucket.range}>
                      <CardContent className="py-4">
                        <p className="text-xs text-muted-foreground">{bucket.range}</p>
                        <p className="text-xl font-bold">{bucket.count}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(bucket.totalAmount)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Outstanding Payments DataTable */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      Outstanding Payments ({outstandingPayments.length})
                    </CardTitle>
                    <CardDescription>
                      Members with overdue payments or failed charges that need attention
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={outstandingColumns}
                      data={outstandingPayments}
                      searchColumn="memberName"
                      searchPlaceholder="Search by member name or email..."
                      filterColumns={[
                        {
                          column: "type",
                          label: "Type",
                          options: [
                            { label: "All Types", value: "all" },
                            { label: "Overdue", value: "overdue" },
                            { label: "Failed Charge", value: "failed" },
                          ],
                        },
                        {
                          column: "daysOverdue",
                          label: "Days Overdue",
                          options: [
                            { label: "All", value: "all" },
                            { label: "1-7 days", value: "1-7" },
                            { label: "8-14 days", value: "8-14" },
                            { label: "15-30 days", value: "15-30" },
                            { label: "31-60 days", value: "31-60" },
                            { label: "60+ days", value: "60+" },
                          ],
                        },
                        {
                          column: "planName",
                          label: "Plan",
                          options: [
                            { label: "All Plans", value: "all" },
                            { label: "Single", value: "Single" },
                            { label: "Married", value: "Married" },
                            { label: "Widow/Widower", value: "Widow/Widower" },
                          ],
                        },
                      ]}
                      pageSize={20}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Onboarding Payments Tab */}
            <TabsContent value="onboarding">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Onboarding Payments
                  </CardTitle>
                  <CardDescription>
                    Track initial payment setup for new members (enrollment fee + first dues)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={onboardingColumns}
                    data={onboardingInvites}
                    searchColumn="member"
                    searchPlaceholder="Search by member name or email..."
                    filterColumns={[
                      {
                        column: "paymentMethod",
                        label: "Method",
                        options: [
                          { label: "All Methods", value: "all" },
                          { label: "Stripe", value: "stripe" },
                          { label: "Manual", value: "manual" },
                        ],
                      },
                      {
                        column: "status",
                        label: "Status",
                        options: [
                          { label: "All Statuses", value: "all" },
                          { label: "Pending", value: "pending" },
                          { label: "Completed", value: "completed" },
                          { label: "Expired", value: "expired" },
                          { label: "Canceled", value: "canceled" },
                        ],
                      },
                    ]}
                    pageSize={20}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Member Selector Dialog */}
      <Dialog open={memberSelectorOpen} onOpenChange={setMemberSelectorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Member</DialogTitle>
            <DialogDescription>
              Choose a member to record a payment for
            </DialogDescription>
          </DialogHeader>
          <Command className="rounded-lg border">
            <CommandInput placeholder="Search members..." />
            <CommandList>
              {membersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    {membersList
                      .filter((m) => m.membership) // Only show members with memberships
                      .map((member) => (
                        <CommandItem
                          key={member.id}
                          value={`${member.firstName} ${member.lastName} ${member.email}`}
                          onSelect={() => handleSelectMember(member.id)}
                          className="cursor-pointer"
                        >
                          <User className="mr-2 h-4 w-4" />
                          <div className="flex-1">
                            <p className="font-medium">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                          {member.membership && (
                            <Badge variant="outline" className="ml-2">
                              {member.membership.paidMonths}/60 mo
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Record Payment Sheet */}
      <RecordPaymentSheet
        member={selectedMember}
        plan={selectedPlan}
        open={recordSheetOpen}
        onOpenChange={setRecordSheetOpen}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Payment Details Sheet */}
      <PaymentDetailsSheet
        payment={selectedPayment}
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
      />
    </>
  );
}
