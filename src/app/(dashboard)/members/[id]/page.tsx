"use client";

import { use, useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentDetailsSheet } from "@/components/payments/payment-details-sheet";
import Link from "next/link";
import {
  getMember,
  formatCurrency,
  formatDate,
  formatStatus,
  getStatusVariant,
  mockPayments,
} from "@/lib/mock-data";
import { PaymentWithDetails } from "@/lib/types";
import {
  CheckCircle2,
  Clock,
  FileText,
  Edit,
  Mail,
  Phone,
  MapPin,
  Users,
  AlertCircle,
  Calendar,
} from "lucide-react";

interface MemberDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { id } = use(params);
  const memberData = getMember(id);

  if (!memberData) {
    return (
      <>
        <Header />
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Member not found</p>
              <Button asChild className="mt-4">
                <Link href="/members">Back to Members</Link>
              </Button>
            </Card>
          </div>
        </div>
      </>
    );
  }

  const { membership, plan } = memberData;

  // State for payment details sheet
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);

  // Get recent payments for this member
  const recentPayments = mockPayments
    .filter((p) => p.memberId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Transform to PaymentWithDetails for the sheet
  const handleViewPayment = (payment: typeof recentPayments[0]) => {
    if (!membership) return;
    const paymentWithDetails: PaymentWithDetails = {
      ...payment,
      member: memberData,
      membership: membership,
    };
    setSelectedPayment(paymentWithDetails);
    setDetailsSheetOpen(true);
  };

  const progressPercent = membership ? Math.min((membership.paidMonths / 60) * 100, 100) : 0;
  const monthsRemaining = membership ? Math.max(60 - membership.paidMonths, 0) : 60;
  const isEligible = membership ? membership.paidMonths >= 60 : false;

  const duesAmount = plan
    ? membership?.billingFrequency === "monthly"
      ? plan.pricing.monthly
      : membership?.billingFrequency === "biannual"
      ? plan.pricing.biannual
      : plan.pricing.annual
    : 0;

  const getBillingLabel = (frequency: string) => {
    switch (frequency) {
      case "monthly":
        return "Monthly";
      case "biannual":
        return "Bi-Annual";
      case "annual":
        return "Annual";
      default:
        return frequency;
    }
  };

  const getPlanBadgeVariant = (planType: string): "info" | "refunded" | "warning" | "inactive" => {
    switch (planType) {
      case "single":
        return "info";
      case "married":
        return "refunded";
      case "widow":
        return "warning";
      default:
        return "inactive";
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    switch (type) {
      case "enrollment_fee":
        return <Badge variant="refunded">Enrollment Fee</Badge>;
      case "dues":
        return <Badge variant="info">Dues</Badge>;
      case "back_dues":
        return <Badge variant="warning">Back Dues</Badge>;
      default:
        return <Badge variant="inactive">{type}</Badge>;
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case "card":
        return <Badge variant="outline">Card</Badge>;
      case "ach":
        return <Badge variant="outline">ACH</Badge>;
      case "cash":
        return <Badge variant="outline">Cash</Badge>;
      case "check":
        return <Badge variant="outline">Check</Badge>;
      case "zelle":
        return <Badge variant="outline">Zelle</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  // Build timeline events
  const timelineEvents = membership
    ? [
        membership.cancelledDate && {
          date: membership.cancelledDate,
          title: "Membership Cancelled",
          icon: "cancelled",
        },
        membership.eligibleDate && {
          date: membership.eligibleDate,
          title: "Became Eligible for Benefits",
          icon: "eligible",
        },
        membership.agreementSignedAt && {
          date: membership.agreementSignedAt,
          title: "Agreement Signed",
          icon: "agreement",
        },
        membership.enrollmentFeePaid && {
          date: membership.joinDate,
          title: "Enrollment Fee Paid",
          icon: "payment",
        },
        {
          date: membership.joinDate,
          title: "Membership Created",
          icon: "created",
        },
      ].filter(Boolean)
    : [];

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/members">Members</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {memberData.firstName} {memberData.lastName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {memberData.firstName} {memberData.lastName}
                </h1>
                <p className="text-muted-foreground">
                  {memberData.email} • {memberData.phone}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {membership && (
                  <Badge
                    variant={getStatusVariant(membership.status)}
                    className="text-sm px-4 py-2"
                  >
                    {formatStatus(membership.status)}
                  </Badge>
                )}
                <Button asChild>
                  <Link href={`/members/${id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Eligibility Progress Section */}
          {membership && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Eligibility Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">
                      {membership.paidMonths} / 60 months
                    </span>
                    <span className="text-lg text-muted-foreground">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                </div>
                <div className="pt-2">
                  {isEligible ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">
                        Eligible since {formatDate(membership.eligibleDate)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-700">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">
                        {monthsRemaining} months until eligibility
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Membership Warning */}
          {!membership && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="py-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">No Active Membership</p>
                    <p className="text-sm text-amber-700">
                      This member does not have an active membership yet.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Membership Details Card */}
            {membership && plan && (
              <Card>
                <CardHeader>
                  <CardTitle>Membership Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <Badge variant={getPlanBadgeVariant(plan.type)}>{plan.name}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billing</p>
                      <p className="font-medium">{getBillingLabel(membership.billingFrequency)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-medium">{formatCurrency(duesAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Join Date</p>
                      <p className="font-medium">{formatDate(membership.joinDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Next Payment Due</p>
                      <p className="font-medium">{formatDate(membership.nextPaymentDue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Anniversary Day</p>
                      <p className="font-medium">Day {membership.billingAnniversaryDay}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Enrollment Fee</p>
                      <p className="font-medium">
                        {membership.enrollmentFeePaid ? (
                          <span className="text-green-700">Paid</span>
                        ) : (
                          <span className="text-amber-700">Not Paid</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Agreement Status</p>
                      <div className="flex items-center gap-1">
                        {membership.agreementSignedAt ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Signed</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Member Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{memberData.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{memberData.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{memberData.address.street}</p>
                    <p className="font-medium">
                      {memberData.address.city}, {memberData.address.state}{" "}
                      {memberData.address.zip}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{memberData.emergencyContact.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {memberData.emergencyContact.phone}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Family Information */}
          {(memberData.spouseName || memberData.children.length > 0) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Family Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {memberData.spouseName && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Spouse</p>
                      <p className="font-medium">{memberData.spouseName}</p>
                    </div>
                  )}
                  {memberData.children.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Children ({memberData.children.length})
                      </p>
                      <div className="space-y-2">
                        {memberData.children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                          >
                            <span className="font-medium">{child.name}</span>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(child.dateOfBirth)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline Card */}
          {membership && timelineEvents.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timelineEvents.map((event: any, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center">
                          {event.icon === "eligible" && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {event.icon === "agreement" && (
                            <FileText className="h-4 w-4 text-blue-600" />
                          )}
                          {event.icon === "payment" && (
                            <span className="text-xs font-bold text-brand-teal">$</span>
                          )}
                          {event.icon === "created" && (
                            <span className="text-xs font-bold text-brand-teal">+</span>
                          )}
                          {event.icon === "cancelled" && (
                            <span className="text-xs font-bold text-red-600">✕</span>
                          )}
                        </div>
                        {index < timelineEvents.length - 1 && (
                          <div
                            className="w-0.5 h-full bg-gray-200 mt-2"
                            style={{ minHeight: "20px" }}
                          />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(event.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No payments yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow
                          key={payment.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewPayment(payment)}
                        >
                          <TableCell>{formatDate(payment.paidAt || payment.createdAt)}</TableCell>
                          <TableCell>{getPaymentTypeBadge(payment.type)}</TableCell>
                          <TableCell>{getPaymentMethodBadge(payment.method)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === "completed"
                                  ? "success"
                                  : payment.status === "pending"
                                  ? "warning"
                                  : payment.status === "failed"
                                  ? "error"
                                  : payment.status === "refunded"
                                  ? "refunded"
                                  : "inactive"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Details Sheet */}
      <PaymentDetailsSheet
        payment={selectedPayment}
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
      />
    </>
  );
}
