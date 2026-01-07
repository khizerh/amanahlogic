import { headers } from "next/headers";
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
import { AlertTriangle, Receipt, CreditCard, Banknote, DollarSign } from "lucide-react";
import { MemberPortalService } from "@/lib/database/member-portal";
import { formatCurrency } from "@/lib/utils/currency";

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPaymentMethodIcon(method: string) {
  switch (method) {
    case "stripe":
      return <CreditCard className="w-4 h-4" />;
    case "cash":
      return <Banknote className="w-4 h-4" />;
    case "check":
      return <Receipt className="w-4 h-4" />;
    case "zelle":
      return <DollarSign className="w-4 h-4" />;
    default:
      return <CreditCard className="w-4 h-4" />;
  }
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

export default async function MemberPaymentsPage() {
  const headersList = await headers();
  const memberId = headersList.get("x-member-id");
  const organizationId = headersList.get("x-organization-id");

  if (!memberId || !organizationId) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-amber-800">Login Required</h2>
              <p className="text-amber-700 mt-1">Please log in to view your payments.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const paymentHistory = await MemberPortalService.getPaymentHistory(memberId, organizationId);

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
              {paymentHistory.totalMonthsCredited} months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Payments</CardTitle>
          <CardDescription>
            {paymentHistory.payments.length} total payment{paymentHistory.payments.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentHistory.payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Months</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {formatDate(payment.paidAt)}
                      </TableCell>
                      <TableCell>
                        {getPaymentTypeBadge(payment.type)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 capitalize">
                          {getPaymentMethodIcon(payment.method)}
                          <span>{payment.method}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.type === "enrollment_fee" ? "-" : `+${payment.monthsCredited}`}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.amount)}
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
  );
}
