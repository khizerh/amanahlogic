"use client";

import { use } from "react";
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
import Link from "next/link";
import {
  getMembership,
  formatCurrency,
  formatDate,
  formatStatus,
  getStatusColor,
} from "@/lib/mock-data";
import { CheckCircle2, Clock, FileText } from "lucide-react";

interface MembershipDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function MembershipDetailPage({ params }: MembershipDetailPageProps) {
  const { id } = use(params);
  const membership = getMembership(id);

  if (!membership) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Membership not found</p>
              <Button asChild className="mt-4">
                <Link href="/memberships">Back to Memberships</Link>
              </Button>
            </Card>
          </div>
        </div>
      </>
    );
  }

  const progressPercent = Math.min((membership.paidMonths / 60) * 100, 100);
  const monthsRemaining = Math.max(60 - membership.paidMonths, 0);
  const isEligible = membership.paidMonths >= 60;

  const duesAmount =
    membership.billingFrequency === "monthly"
      ? membership.plan.pricing.monthly
      : membership.billingFrequency === "biannual"
      ? membership.plan.pricing.biannual
      : membership.plan.pricing.annual;

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

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case "single":
        return "bg-blue-100 text-blue-800";
      case "married":
        return "bg-purple-100 text-purple-800";
      case "widow":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    switch (type) {
      case "enrollment_fee":
        return <Badge className="bg-indigo-100 text-indigo-800">Enrollment Fee</Badge>;
      case "dues":
        return <Badge className="bg-blue-100 text-blue-800">Dues</Badge>;
      case "back_dues":
        return <Badge className="bg-amber-100 text-amber-800">Back Dues</Badge>;
      default:
        return <Badge>{type}</Badge>;
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

  // Mock timeline events based on membership data
  const timelineEvents = [
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
  ].filter(Boolean);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/memberships">Memberships</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {membership.member.firstName} {membership.member.lastName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {membership.member.firstName} {membership.member.lastName}
                </h1>
                <p className="text-muted-foreground">
                  {membership.member.email} • {membership.member.phone}
                </p>
              </div>
              <Badge className={getStatusColor(membership.status)} style={{ fontSize: "14px", padding: "8px 16px" }}>
                {formatStatus(membership.status)}
              </Badge>
            </div>
          </div>

          {/* Paid Months Progress Section */}
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

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Membership Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Membership Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <Badge className={getPlanBadgeColor(membership.plan.type)}>
                      {membership.plan.name}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing</p>
                    <p className="font-medium">
                      {getBillingLabel(membership.billingFrequency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Amount</p>
                    <p className="font-medium">{formatCurrency(duesAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Join Date</p>
                    <p className="font-medium">{formatDate(membership.joinDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Anniversary Day</p>
                    <p className="font-medium">Day {membership.billingAnniversaryDay}</p>
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

            {/* Member Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Member Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{membership.member.email}</p>
                  <p className="font-medium">{membership.member.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{membership.member.address.street}</p>
                  <p className="font-medium">
                    {membership.member.address.city}, {membership.member.address.state}{" "}
                    {membership.member.address.zip}
                  </p>
                </div>
                {membership.member.spouseName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Spouse</p>
                    <p className="font-medium">{membership.member.spouseName}</p>
                  </div>
                )}
                {membership.member.children.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Children</p>
                    <p className="font-medium">{membership.member.children.length} dependent(s)</p>
                  </div>
                )}
                <div>
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={`/members/${membership.member.id}`}>View Full Profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline/History Card */}
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
                        {event.icon === "eligible" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {event.icon === "agreement" && <FileText className="h-4 w-4 text-blue-600" />}
                        {event.icon === "payment" && <span className="text-xs font-bold text-brand-teal">$</span>}
                        {event.icon === "created" && <span className="text-xs font-bold text-brand-teal">+</span>}
                        {event.icon === "cancelled" && <span className="text-xs font-bold text-red-600">✕</span>}
                      </div>
                      {index < timelineEvents.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-2" style={{ minHeight: "20px" }} />
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

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {membership.recentPayments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No payments yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membership.recentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.paidAt || payment.createdAt)}</TableCell>
                          <TableCell>{getPaymentTypeBadge(payment.type)}</TableCell>
                          <TableCell>{getPaymentMethodBadge(payment.method)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={payment.status === "completed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/payments/${payment.id}`}>View</Link>
                            </Button>
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
    </>
  );
}
