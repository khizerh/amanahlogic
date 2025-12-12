"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { columns } from "./columns";
import Link from "next/link";
import {
  getPayments,
  getOverdueMembers,
  getAutoPayMembers,
  getMembersWithoutAutoPay,
  formatCurrency,
  formatDate,
  formatStatus,
  getStatusColor,
} from "@/lib/mock-data";
import {
  AlertCircle,
  CreditCard,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  const payments = getPayments();
  const overdueMembers = getOverdueMembers(100);
  const autoPayMembers = getAutoPayMembers();
  const noAutoPayMembers = getMembersWithoutAutoPay();

  const handleSendReminder = (memberId: string, memberName: string) => {
    toast.success(`Payment reminder sent to ${memberName}`);
  };

  const handleSendAutoPayInvite = (memberId: string, memberName: string) => {
    toast.success(`Auto-pay setup link sent to ${memberName}`);
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
                View payment history, manage overdue accounts, and auto-pay setup
              </p>
            </div>
            <Button onClick={() => setRecordDialogOpen(true)}>
              Record Payment
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-8">
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
                  Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {overdueMembers.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Auto-Pay Enabled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {autoPayMembers.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  No Auto-Pay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {noAutoPayMembers.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">
                All Payments
              </TabsTrigger>
              <TabsTrigger value="overdue" className="gap-2">
                Overdue
                {overdueMembers.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                    {overdueMembers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="autopay">
                Auto-Pay Setup
              </TabsTrigger>
            </TabsList>

            {/* All Payments Tab */}
            <TabsContent value="all">
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
                          { label: "Card", value: "card" },
                          { label: "ACH", value: "ach" },
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

            {/* Overdue Tab */}
            <TabsContent value="overdue">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Overdue Payments
                  </CardTitle>
                  <CardDescription>
                    Members with missed or late payments that need attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {overdueMembers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p className="text-lg font-medium">No overdue payments!</p>
                      <p className="text-sm">All members are current on their payments.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {overdueMembers.map((membership) => (
                        <div
                          key={membership.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                              <AlertCircle className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                              <Link
                                href={`/members/${membership.member.id}`}
                                className="font-medium hover:underline"
                              >
                                {membership.member.firstName} {membership.member.lastName}
                              </Link>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{membership.member.email}</span>
                                <span>•</span>
                                <Badge className={getStatusColor(membership.status)} variant="secondary">
                                  {formatStatus(membership.status)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                Last Payment
                              </div>
                              <div className="font-medium">
                                {formatDate(membership.lastPaymentDate)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                Due Date
                              </div>
                              <div className="font-medium text-orange-600">
                                {formatDate(membership.nextPaymentDue)}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleSendReminder(
                                  membership.member.id,
                                  `${membership.member.firstName} ${membership.member.lastName}`
                                )
                              }
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send Reminder
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Auto-Pay Setup Tab */}
            <TabsContent value="autopay">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Members with Auto-Pay */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Auto-Pay Enabled ({autoPayMembers.length})
                    </CardTitle>
                    <CardDescription>
                      Members with recurring payments set up
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {autoPayMembers.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">
                        No members have auto-pay enabled yet.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {autoPayMembers.slice(0, 20).map((membership) => (
                          <div
                            key={membership.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <Link
                                  href={`/members/${membership.member.id}`}
                                  className="font-medium text-sm hover:underline"
                                >
                                  {membership.member.firstName} {membership.member.lastName}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  {membership.billingFrequency === "monthly"
                                    ? "Monthly"
                                    : membership.billingFrequency === "biannual"
                                    ? "Bi-Annual"
                                    : "Annual"}{" "}
                                  • Next: {formatDate(membership.nextPaymentDue)}
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          </div>
                        ))}
                        {autoPayMembers.length > 20 && (
                          <p className="text-center text-sm text-muted-foreground pt-2">
                            And {autoPayMembers.length - 20} more...
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Members without Auto-Pay */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-amber-600" />
                      No Auto-Pay ({noAutoPayMembers.length})
                    </CardTitle>
                    <CardDescription>
                      Active members who could benefit from auto-pay setup
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {noAutoPayMembers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>All active members have auto-pay enabled!</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {noAutoPayMembers.slice(0, 20).map((membership) => (
                          <div
                            key={membership.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-amber-600" />
                              </div>
                              <div>
                                <Link
                                  href={`/members/${membership.member.id}`}
                                  className="font-medium text-sm hover:underline"
                                >
                                  {membership.member.firstName} {membership.member.lastName}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  {membership.member.email}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleSendAutoPayInvite(
                                  membership.member.id,
                                  `${membership.member.firstName} ${membership.member.lastName}`
                                )
                              }
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Invite
                            </Button>
                          </div>
                        ))}
                        {noAutoPayMembers.length > 20 && (
                          <p className="text-center text-sm text-muted-foreground pt-2">
                            And {noAutoPayMembers.length - 20} more...
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen} />
    </>
  );
}
