"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { Payment } from "@/lib/types";
import { MemberPaymentHistory } from "@/lib/database/member-portal";
import { PaymentDetailsSheet } from "./PaymentDetailsSheet";

interface PaymentsClientProps {
  paymentHistory: MemberPaymentHistory;
  organizationName: string;
  isPending?: boolean;
  isManualPayment?: boolean;
  paidMonths?: number;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const dateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPaymentMethodLabel(method: string, stripePaymentMethodType?: string | null): string {
  if (method === "stripe") {
    if (stripePaymentMethodType === "us_bank_account") return "Bank (ACH)";
    if (stripePaymentMethodType === "card") return "Card";
    if (stripePaymentMethodType === "link") return "Link";
    return "Card";
  }
  const labels: Record<string, string> = {
    card: "Card",
    cash: "Cash",
    check: "Check",
    zelle: "Zelle",
    ach: "Bank",
  };
  return labels[method] || method;
}

function getPaymentTypeBadge(type: string) {
  switch (type) {
    case "enrollment_fee":
      return <Badge variant="outline">Enrollment</Badge>;
    case "dues":
      return <Badge className="bg-blue-100 text-blue-800">Dues</Badge>;
    case "back_dues":
      return <Badge className="bg-purple-100 text-purple-800">Back Dues</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    case "processing":
      return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-purple-100 text-purple-800">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function PaymentsClient({ paymentHistory, organizationName, isPending, isManualPayment, paidMonths }: PaymentsClientProps) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="text-muted-foreground mt-1">
          View all your membership payments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Paid</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(paymentHistory.totalPaid)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Months Credited</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {paidMonths ?? paymentHistory.totalMonthsCredited} months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Payments</CardTitle>
          <CardDescription>
            Click on a payment to view receipt details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentHistory.payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payments yet</p>
              {isPending && (
                <p className="text-sm mt-2">
                  {isManualPayment
                    ? `Please contact ${organizationName} to arrange your first payment.`
                    : "Your payments will appear here once your first payment is processed."}
                </p>
              )}
            </div>
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
                  {paymentHistory.payments.map((payment) => (
                    <TableRow
                      key={payment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(payment)}
                    >
                      <TableCell className="font-medium">
                        {formatDate(payment.paidAt)}
                      </TableCell>
                      <TableCell>
                        {getPaymentTypeBadge(payment.type)}
                      </TableCell>
                      <TableCell>
                        {getPaymentMethodLabel(payment.method, payment.stripePaymentMethodType)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.totalCharged || payment.amount)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Sheet */}
      <PaymentDetailsSheet
        payment={selectedPayment}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        organizationName={organizationName}
      />
    </div>
  );
}
