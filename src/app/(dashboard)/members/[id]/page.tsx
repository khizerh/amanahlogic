"use client";

import { useParams } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Edit, Mail, Phone, MapPin, User, Users, Calendar, CreditCard } from "lucide-react";
import { getMember, formatStatus, getStatusColor, formatCurrency, formatDate } from "@/lib/mock-data";
import { mockPayments } from "@/lib/mock-data";

export default function MemberDetailPage() {
  const params = useParams();
  const memberId = params.id as string;

  const memberData = getMember(memberId);

  if (!memberData) {
    return (
      <>
        <Header />
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-muted-foreground">Member not found</h2>
              <Link href="/members">
                <Button className="mt-4">Back to Members</Button>
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const { membership, plan } = memberData;

  // Get recent payments for this member
  const recentPayments = mockPayments
    .filter(p => p.memberId === memberId)
    .slice(0, 5);

  const progressPercentage = membership ? Math.min((membership.paidMonths / 60) * 100, 100) : 0;

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
                <BreadcrumbPage>{memberData.firstName} {memberData.lastName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">
                  {memberData.firstName} {memberData.lastName}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Member ID: {memberData.id}
                </p>
              </div>
              {membership && (
                <Badge className={getStatusColor(membership.status)} variant="secondary">
                  {formatStatus(membership.status)}
                </Badge>
              )}
            </div>
            <Link href={`/members/${memberId}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit Member
              </Button>
            </Link>
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Contact Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{memberData.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{memberData.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">
                        {memberData.address.street}<br />
                        {memberData.address.city}, {memberData.address.state} {memberData.address.zip}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p className="text-sm text-muted-foreground">{memberData.emergencyContact.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{memberData.emergencyContact.phone}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Membership & Family */}
            <div className="lg:col-span-2 space-y-6">
              {/* Membership Details */}
              {membership && plan && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Membership Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium">Plan Type</p>
                        <p className="text-sm text-muted-foreground mt-1 capitalize">{plan.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Billing Frequency</p>
                        <p className="text-sm text-muted-foreground mt-1 capitalize">
                          {membership.billingFrequency}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Join Date</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(membership.joinDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Last Payment</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(membership.lastPaymentDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Next Payment Due</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(membership.nextPaymentDue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Enrollment Fee</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {membership.enrollmentFeePaid ? "Paid" : "Not Paid"}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Paid Months Progress</p>
                        <p className="text-sm font-mono font-medium">
                          {membership.paidMonths}/60 months
                        </p>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                      <p className="text-xs text-muted-foreground mt-2">
                        {membership.paidMonths >= 60
                          ? "Eligible for burial benefit"
                          : `${60 - membership.paidMonths} months until eligible`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Spouse Information */}
              {memberData.spouseName && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Spouse Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      <span className="font-medium">Name: </span>
                      {memberData.spouseName}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Children */}
              {memberData.children.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Children
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {memberData.children.map((child) => (
                        <div key={child.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{child.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              DOB: {formatDate(child.dateOfBirth)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Recent Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No payments recorded
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentPayments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="text-sm">
                                {formatDate(payment.paidAt || payment.createdAt)}
                              </TableCell>
                              <TableCell className="text-sm capitalize">
                                {payment.type.replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-sm capitalize">
                                {payment.method}
                              </TableCell>
                              <TableCell className="text-sm text-right font-mono">
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
          </div>
        </div>
      </div>
    </>
  );
}
