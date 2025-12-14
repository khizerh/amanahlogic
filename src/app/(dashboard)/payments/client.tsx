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
import { PaymentWithDetails, OutstandingPaymentInfo } from "@/lib/database/payments";
import { AutoPayInviteWithMember, MemberWithMembership, Plan } from "@/lib/types";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import {
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Clock,
  Send,
  Copy,
  XCircle,
  Mail,
  RefreshCw,
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
  initialAutoPayInvites: AutoPayInviteWithMember[];
  pendingInvitesCount: number;
  totalOutstanding: number;
  failedChargesCount: number;
}

const VALID_TABS = ["all", "outstanding", "invites"] as const;
type TabValue = typeof VALID_TABS[number];

export function PaymentsPageClient({
  initialPayments,
  initialOutstandingPayments,
  initialAgingBuckets,
  initialAutoPayInvites,
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
  const [inviteFilter, setInviteFilter] = useState<'all' | 'pending' | 'completed' | 'expired'>('all');

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
          console.error("Failed to fetch members:", err);
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
      console.error("Failed to fetch member:", err);
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
      console.error("Failed to fetch member:", err);
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
  const allInvites = initialAutoPayInvites;

  // Filter invites based on selected filter
  const filteredInvites = useMemo(() => {
    if (inviteFilter === 'all') return allInvites;
    return allInvites.filter(i => i.status === inviteFilter);
  }, [allInvites, inviteFilter]);

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

  const handleCopyInviteLink = (invite: AutoPayInviteWithMember) => {
    navigator.clipboard.writeText(`https://checkout.stripe.com/${invite.stripeCheckoutSessionId}`);
    toast.success("Link copied to clipboard");
  };

  const handleResendInvite = (invite: AutoPayInviteWithMember) => {
    toast.success(`Auto-pay setup link resent to ${invite.member.email}`);
  };

  // Get invite status badge
  const getInviteStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'expired':
        return <Badge variant="inactive">Expired</Badge>;
      case 'canceled':
        return <Badge variant="error">Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
                Manage payments, track overdue accounts, and auto-pay invites
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
              <TabsTrigger value="invites" className="gap-2">
                Auto-Pay Invites
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

            {/* Auto-Pay Invites Tab */}
            <TabsContent value="invites">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Auto-Pay Setup Invites
                      </CardTitle>
                      <CardDescription>
                        Track Stripe checkout links sent to members to set up automatic payments
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {(['all', 'pending', 'completed', 'expired'] as const).map((filter) => (
                        <Button
                          key={filter}
                          variant={inviteFilter === filter ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setInviteFilter(filter)}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                          {filter === 'pending' && pendingInvitesCount > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                              {pendingInvitesCount}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Info about what this tab shows */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-muted-foreground">
                      This shows checkout links that have been <strong>sent</strong> to members to set up auto-pay.
                      Links expire after 24 hours. Pending invites are members who received a link but haven&apos;t completed setup yet.
                      To invite a new member, go to their profile and click &quot;Send Payment Link&quot; with auto-pay enabled.
                    </p>
                  </div>

                  {filteredInvites.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No {inviteFilter !== 'all' ? inviteFilter : ''} invites</p>
                      <p className="text-sm">
                        {inviteFilter === 'pending'
                          ? "No pending auto-pay setup invites."
                          : inviteFilter === 'completed'
                          ? "No completed auto-pay setups yet."
                          : inviteFilter === 'expired'
                          ? "No expired invites."
                          : "No auto-pay invites have been sent yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              invite.status === 'completed'
                                ? 'bg-green-100'
                                : invite.status === 'pending'
                                ? 'bg-amber-100'
                                : 'bg-gray-100'
                            }`}>
                              {invite.status === 'completed' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : invite.status === 'pending' ? (
                                <Clock className="h-5 w-5 text-amber-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <Link
                                href={`/members/${invite.memberId}`}
                                className="font-medium hover:underline"
                              >
                                {invite.member.firstName} {invite.member.lastName}
                              </Link>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{invite.plan?.name || "Unknown Plan"}</span>
                                <span>-</span>
                                <span>{formatCurrency(invite.plannedAmount)}/mo</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right text-sm">
                              <div className="text-muted-foreground">
                                Sent: {formatDate(invite.sentAt)}
                              </div>
                              {invite.status === 'completed' && invite.completedAt && (
                                <div className="text-green-600">
                                  Completed: {formatDate(invite.completedAt)}
                                </div>
                              )}
                              {invite.status === 'expired' && invite.expiredAt && (
                                <div className="text-gray-500">
                                  Expired: {formatDate(invite.expiredAt)}
                                </div>
                              )}
                              {invite.status === 'pending' && invite.firstChargeDate && (
                                <div className="text-muted-foreground">
                                  First charge: {formatDate(invite.firstChargeDate)}
                                </div>
                              )}
                            </div>
                            <div>
                              {getInviteStatusBadge(invite.status)}
                            </div>
                            {invite.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyInviteLink(invite)}
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Link
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResendInvite(invite)}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Resend
                                </Button>
                              </div>
                            )}
                            {invite.status === 'expired' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendInvite(invite)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send New Link
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
