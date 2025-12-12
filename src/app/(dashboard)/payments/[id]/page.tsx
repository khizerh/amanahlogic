"use client";

import { use } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import {
  getPayment,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";
import {
  CreditCard,
  Building2,
  Banknote,
  FileText,
  Smartphone,
  User,
  CalendarDays,
} from "lucide-react";

interface PaymentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const { id } = use(params);
  const payment = getPayment(id);

  if (!payment) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Payment not found</p>
              <Button asChild className="mt-4">
                <Link href="/payments">Back to Payments</Link>
              </Button>
            </Card>
          </div>
        </div>
      </>
    );
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "card":
        return <CreditCard className="h-5 w-5" />;
      case "ach":
        return <Building2 className="h-5 w-5" />;
      case "cash":
        return <Banknote className="h-5 w-5" />;
      case "check":
        return <FileText className="h-5 w-5" />;
      case "zelle":
        return <Smartphone className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "card":
        return "Credit/Debit Card";
      case "ach":
        return "ACH Bank Transfer";
      case "cash":
        return "Cash";
      case "check":
        return "Check";
      case "zelle":
        return "Zelle";
      default:
        return method;
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case "enrollment_fee":
        return "Enrollment Fee";
      case "dues":
        return "Membership Dues";
      case "back_dues":
        return "Back Dues";
      default:
        return type;
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "refunded":
        return <Badge className="bg-purple-100 text-purple-800">Refunded</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const isManualPayment = ["cash", "check", "zelle"].includes(payment.method);

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
                  <Link href="/payments">Payments</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Payment #{payment.id.split("_")[1]}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  Payment #{payment.id.split("_")[1]}
                </h1>
                <p className="text-muted-foreground">{getPaymentTypeLabel(payment.type)}</p>
              </div>
              {getStatusBadge(payment.status)}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Payment Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Base Amount</span>
                    <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  </div>
                  {payment.stripeFee > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Processing Fee</span>
                      <span className="font-medium">{formatCurrency(payment.stripeFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Platform Fee</span>
                    <span className="font-medium">{formatCurrency(payment.platformFee)}</span>
                  </div>
                  <div className="border-t pt-2" />
                  <div className="flex justify-between py-2">
                    <span className="font-semibold">Total Charged</span>
                    <span className="font-bold text-lg">{formatCurrency(payment.totalCharged)}</span>
                  </div>
                  <div className="flex justify-between py-2 bg-green-50 -mx-4 px-4 rounded-md">
                    <span className="font-semibold text-green-900">Net to Organization</span>
                    <span className="font-bold text-green-900">
                      {formatCurrency(payment.netAmount)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-3">
                    {getPaymentMethodIcon(payment.method)}
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Method</p>
                      <p className="font-medium">{getPaymentMethodLabel(payment.method)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Type</p>
                      <div className="mt-1">{getPaymentTypeBadge(payment.type)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date Paid</p>
                      <p className="font-medium">
                        {formatDate(payment.paidAt || payment.createdAt)}
                      </p>
                    </div>
                  </div>

                  {payment.monthsCredited > 0 && (
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-sm text-blue-900">
                        <strong>{payment.monthsCredited} month{payment.monthsCredited !== 1 ? "s" : ""}</strong> credited to membership
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Member Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Member Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Member</p>
                    <Link
                      href={`/members/${payment.member.id}`}
                      className="font-medium text-brand-teal hover:underline"
                    >
                      {payment.member.firstName} {payment.member.lastName}
                    </Link>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{payment.member.email}</p>
                  <p className="font-medium">{payment.member.phone}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{payment.member.address.street}</p>
                  <p className="font-medium">
                    {payment.member.address.city}, {payment.member.address.state}{" "}
                    {payment.member.address.zip}
                  </p>
                </div>

                <div className="pt-2">
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={`/memberships/${payment.membership.id}`}>
                      View Membership
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Payment ID</p>
                  <p className="font-mono text-sm">{payment.id}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Membership ID</p>
                  <p className="font-mono text-sm">{payment.membershipId}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">{formatDate(payment.createdAt)}</p>
                </div>

                {payment.paidAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid At</p>
                    <p className="font-medium">{formatDate(payment.paidAt)}</p>
                  </div>
                )}

                {payment.refundedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Refunded At</p>
                    <p className="font-medium text-red-600">{formatDate(payment.refundedAt)}</p>
                  </div>
                )}
              </div>

              {/* Manual Payment Info */}
              {isManualPayment && (
                <div className="mt-6 p-4 bg-amber-50 rounded-md border border-amber-200">
                  <h4 className="font-semibold text-amber-900 mb-2">Manual Payment</h4>
                  {payment.notes && (
                    <div className="mb-2">
                      <p className="text-sm text-amber-900">
                        <strong>Notes:</strong> {payment.notes}
                      </p>
                    </div>
                  )}
                  {payment.recordedBy && (
                    <p className="text-sm text-amber-900">
                      <strong>Recorded by:</strong> {payment.recordedBy}
                    </p>
                  )}
                </div>
              )}

              {/* Stripe Payment Info */}
              {!isManualPayment && payment.stripePaymentIntentId && (
                <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Stripe Payment</h4>
                  <p className="text-sm text-blue-900">
                    <strong>Payment Intent ID:</strong>
                  </p>
                  <p className="font-mono text-sm text-blue-900">{payment.stripePaymentIntentId}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
