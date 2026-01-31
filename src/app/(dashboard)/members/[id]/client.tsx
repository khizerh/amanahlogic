"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentDetailsSheet } from "@/components/payments/payment-details-sheet";
import { RecordMemberDuesDialog } from "@/components/payments/record-member-dues-dialog";
import { CollectPaymentDialog } from "@/components/payments/collect-payment-dialog";
import { ChargeCardSheet } from "@/components/payments/charge-card-sheet";
import { SendPaymentLinkDialog } from "@/components/payments/send-payment-link-dialog";
import { ChangeFrequencySheet } from "@/components/payments/change-frequency-sheet";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  formatStatus,
  getStatusVariant,
  getEmailTemplateTypeLabel,
  getEmailStatusVariant,
} from "@/lib/mock-data";
import { formatPhoneNumber } from "@/lib/utils";
import { MemberWithMembership, Payment, EmailLog, CommunicationLanguage, Agreement } from "@/lib/types";
import { PhoneInput } from "@/components/ui/phone-input";
import { PaymentWithDetails } from "@/lib/database/payments";
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Send,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Pause,
  Play,
  DollarSign,
  CreditCard,
  Calendar,
  Download,
  Shield,
  Edit,
  X,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface MemberDetailClientProps {
  initialMember: MemberWithMembership;
  initialPayments: Payment[];
  initialEmails: EmailLog[];
  initialAgreement: Agreement | null;
  agreementTemplateUrl: string | null;
  agreementSignUrl: string | null;
}

export function MemberDetailClient({
  initialMember,
  initialPayments,
  initialEmails,
  initialAgreement,
  agreementTemplateUrl,
  agreementSignUrl,
}: MemberDetailClientProps) {
  const router = useRouter();
  const memberData = initialMember;
  const recentPayments = initialPayments.slice(0, 10);
  const memberEmails = initialEmails;

  // State for payment details sheet
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);

  // State for payment collection flow
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [chargeCardOpen, setChargeCardOpen] = useState(false);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);

  // State for email details sheet
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);

  // State for change frequency sheet
  const [changeFrequencyOpen, setChangeFrequencyOpen] = useState(false);

  // State for agreement dialog
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const agreementUrl = initialAgreement?.pdfUrl || agreementTemplateUrl || null;

  // State for sending agreement
  const [isSendingAgreement, setIsSendingAgreement] = useState(false);
  const [currentSignUrl, setCurrentSignUrl] = useState<string | null>(agreementSignUrl);

  // State for sending portal link
  const [isSendingPortalLink, setIsSendingPortalLink] = useState(false);

  // State for switching to manual payments
  const [isSwitchingToManual, setIsSwitchingToManual] = useState(false);

  // State for setting up recurring payment
  const [isSettingUpAutopay, setIsSettingUpAutopay] = useState(false);

  // State for resending Stripe payment link
  const [isResendingPaymentLink, setIsResendingPaymentLink] = useState(false);

  // State for pausing/resuming subscription
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  // State for sending portal invite
  const [isSendingPortalInvite, setIsSendingPortalInvite] = useState(false);

  // State for inline editing
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    email: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    preferredLanguage: CommunicationLanguage;
    emergencyName: string;
    emergencyPhone: string;
  }>({
    email: memberData.email,
    phone: memberData.phone,
    street: memberData.address.street,
    city: memberData.address.city,
    state: memberData.address.state,
    zip: memberData.address.zip,
    preferredLanguage: memberData.preferredLanguage,
    emergencyName: memberData.emergencyContact.name,
    emergencyPhone: memberData.emergencyContact.phone,
  });

  // Callback to refresh data after payment is recorded
  const handlePaymentRecorded = useCallback(() => {
    // Revalidate the page to fetch fresh data from the server
    router.refresh();
  }, [router]);

  const { membership, plan } = memberData;

  // Send agreement to member
  const handleSendAgreement = useCallback(async () => {
    if (!membership) return;

    setIsSendingAgreement(true);
    try {
      const response = await fetch("/api/agreements/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          memberId: memberData.id,
          language: memberData.preferredLanguage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send agreement");
      }

      // Store the new sign URL
      if (result.signUrl) {
        setCurrentSignUrl(result.signUrl);
      }

      if (result.emailSent) {
        toast.success("Agreement sent! Check member's email.");
      } else {
        toast.success("Agreement created", {
          description: "Email not configured - copy the sign link manually.",
          action: {
            label: "Copy Link",
            onClick: () => {
              navigator.clipboard.writeText(result.signUrl);
              toast.info("Sign link copied to clipboard");
            },
          },
        });
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send agreement");
    } finally {
      setIsSendingAgreement(false);
    }
  }, [membership, memberData.id, memberData.preferredLanguage, router]);

  // Send Stripe portal link to member
  const handleSendPortalLink = useCallback(async () => {
    if (!membership) return;

    setIsSendingPortalLink(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          memberId: memberData.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send portal link");
      }

      if (result.emailSent) {
        toast.success("Portal link sent! Member can now update their payment method.");
      } else {
        toast.success("Portal link generated", {
          description: "Email not configured - copy the link manually.",
          action: {
            label: "Copy Link",
            onClick: () => {
              navigator.clipboard.writeText(result.portalUrl);
              toast.info("Portal link copied to clipboard");
            },
          },
        });
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send portal link");
    } finally {
      setIsSendingPortalLink(false);
    }
  }, [membership, memberData.id, router]);

  // Send portal invite to member
  const handleSendPortalInvite = useCallback(async () => {
    setIsSendingPortalInvite(true);
    try {
      const response = await fetch("/api/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: memberData.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invite");
      }

      toast.success("Portal invite created!", {
        description: "Copy the invite link to share with the member.",
        action: {
          label: "Copy Link",
          onClick: () => {
            navigator.clipboard.writeText(result.inviteUrl);
            toast.info("Invite link copied to clipboard");
          },
        },
      });

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsSendingPortalInvite(false);
    }
  }, [memberData.id, router]);

  // Switch from Stripe recurring payments to manual payments
  const handleSwitchToManual = useCallback(async () => {
    if (!membership) return;

    setIsSwitchingToManual(true);
    try {
      const response = await fetch("/api/memberships/switch-to-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to switch to manual payments");
      }

      if (result.alreadyManual) {
        toast.info("Member is already on manual payments");
      } else {
        toast.success("Switched to manual payments", {
          description: result.subscriptionCanceled
            ? "Stripe subscription has been cancelled. You can now record manual payments."
            : "Autopay has been disabled.",
        });
      }

      if (result.stripeWarning) {
        toast.warning("Stripe warning", { description: result.stripeWarning });
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch to manual payments");
    } finally {
      setIsSwitchingToManual(false);
    }
  }, [membership, router]);

  // Set up recurring payment (redirect to Stripe Checkout)
  const handleSetupAutopay = useCallback(async () => {
    if (!membership) return;

    setIsSettingUpAutopay(true);
    try {
      const response = await fetch("/api/stripe/setup-autopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          memberId: memberData.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to set up autopay");
      }

      // Redirect to payment setup page
      window.location.href = result.paymentUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set up autopay");
      setIsSettingUpAutopay(false);
    }
    // Don't setIsSettingUpAutopay(false) on success - we're redirecting
  }, [membership, memberData.id]);

  // Resend Stripe payment link to member via email
  const handleResendPaymentLink = useCallback(async () => {
    if (!membership) return;

    setIsResendingPaymentLink(true);
    try {
      const response = await fetch("/api/stripe/send-payment-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          memberId: memberData.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send payment link");
      }

      toast.success("Payment link sent!", {
        description: "The member will receive an email with a Stripe checkout link.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send payment link");
    } finally {
      setIsResendingPaymentLink(false);
    }
  }, [membership, memberData.id]);

  // Pause or resume subscription
  const handleSubscriptionAction = useCallback(async (action: "pause" | "resume") => {
    if (!membership) return;

    setIsManagingSubscription(true);
    try {
      const response = await fetch("/api/stripe/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: membership.id,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} subscription`);
      }

      toast.success(
        action === "pause" ? "Subscription paused" : "Subscription resumed",
        {
          description: action === "pause"
            ? "Billing has been paused. No charges will be made until resumed."
            : "Billing has resumed. Charges will continue as normal.",
        }
      );

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} subscription`);
    } finally {
      setIsManagingSubscription(false);
    }
  }, [membership, router]);

  const handleStartEdit = () => {
    setEditForm({
      email: memberData.email,
      phone: formatPhoneNumber(memberData.phone),
      street: memberData.address.street,
      city: memberData.address.city,
      state: memberData.address.state,
      zip: memberData.address.zip,
      preferredLanguage: memberData.preferredLanguage,
      emergencyName: memberData.emergencyContact.name,
      emergencyPhone: formatPhoneNumber(memberData.emergencyContact.phone),
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    // In real app, this would call an API
    toast.success("Contact information updated");
    setIsEditing(false);
  };

  // Transform to PaymentWithDetails for the sheet
  const handleViewPayment = (payment: Payment) => {
    if (!membership) return;
    const paymentWithDetails: PaymentWithDetails = {
      ...payment,
      member: {
        id: memberData.id,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        email: memberData.email,
      },
      membership: {
        id: membership.id,
        status: membership.status,
        paidMonths: membership.paidMonths,
        billingFrequency: membership.billingFrequency,
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          type: plan.type,
        } : null,
      },
    };
    setSelectedPayment(paymentWithDetails);
    setDetailsSheetOpen(true);
  };

  const handleViewEmail = (email: EmailLog) => {
    setSelectedEmail(email);
    setEmailSheetOpen(true);
  };

  const getEmailStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "sent":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "bounced":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "queued":
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
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

  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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

  const getPaymentMethodBadge = (method: string | null) => {
    if (!method) return <Badge variant="outline">-</Badge>;
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
                <h1 className="text-3xl font-bold">
                  {memberData.firstName} {memberData.lastName}
                </h1>
                {membership && (
                  <Badge
                    variant={getStatusVariant(membership.status)}
                    className="mt-2"
                  >
                    {formatStatus(membership.status)}
                  </Badge>
                )}
              </div>
              <Button variant="default" onClick={() => setCollectPaymentOpen(true)}>
                Collect Payment
              </Button>
            </div>
          </div>

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
            {/* Membership Card */}
            {membership && plan && (
              <Card>
                <CardHeader>
                  <CardTitle>Membership</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <Badge variant={getPlanBadgeVariant(plan.type)}>{plan.name}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Join Date</p>
                      <p className="font-medium">{formatDate(membership.joinDate)}</p>
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
                      <p className="text-sm text-muted-foreground">Agreement</p>
                      <div className="flex items-center gap-2">
                        {membership.agreementSignedAt ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <button
                              onClick={() => setAgreementDialogOpen(true)}
                              className="text-sm font-medium text-green-700 hover:underline"
                            >
                              Signed
                            </button>
                          </>
                        ) : (
                          <div className="space-y-2 w-full">
                            <span className="text-sm font-medium text-amber-700">Awaiting Signature</span>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSendAgreement}
                                disabled={isSendingAgreement}
                                className="h-7 text-xs"
                              >
                                {isSendingAgreement ? (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  "Resend Link"
                                )}
                              </Button>
                              {currentSignUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(currentSignUrl);
                                    toast.success("Sign link copied to clipboard");
                                  }}
                                  className="h-7 text-xs"
                                >
                                  Copy Link
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Covered Members */}
                  {(memberData.spouseName || memberData.children.length > 0) && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Covered Members</p>
                      <div className="space-y-1">
                        {memberData.spouseName && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{memberData.spouseName}</span>
                            <span className="text-muted-foreground">Spouse</span>
                          </div>
                        )}
                        {memberData.children.map((child) => {
                          const age = calculateAge(child.dateOfBirth);
                          return (
                            <div key={child.id} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{child.name}</span>
                              <span className="text-muted-foreground">
                                {age} {age === 1 ? "yr" : "yrs"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact Information Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Contact Information</CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="icon" onClick={handleStartEdit}>
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!isEditing ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{memberData.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{formatPhoneNumber(memberData.phone)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Preferred Language</p>
                        <p className="font-medium">
                          {memberData.preferredLanguage === "fa" ? "Farsi" : "English"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium">{memberData.address.street}</p>
                        <p className="font-medium">
                          {memberData.address.city}, {memberData.address.state}{" "}
                          {memberData.address.zip}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Emergency Contact</p>
                        <p className="font-medium">{memberData.emergencyContact.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(memberData.emergencyContact.phone)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <PhoneInput
                          id="phone"
                          value={editForm.phone}
                          onChange={(value) => setEditForm({ ...editForm, phone: value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="language">Preferred Language</Label>
                        <Select
                          value={editForm.preferredLanguage}
                          onValueChange={(value) => setEditForm({ ...editForm, preferredLanguage: value as "en" | "fa" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="fa">Farsi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input
                          id="street"
                          value={editForm.street}
                          onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-2 col-span-1">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={editForm.city}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={editForm.state}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zip">Zip</Label>
                          <Input
                            id="zip"
                            value={editForm.zip}
                            onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Emergency Contact</Label>
                        <Input
                          placeholder="Name"
                          value={editForm.emergencyName}
                          onChange={(e) => setEditForm({ ...editForm, emergencyName: e.target.value })}
                          className="mb-2"
                        />
                        <PhoneInput
                          placeholder="Phone"
                          value={editForm.emergencyPhone}
                          onChange={(value) => setEditForm({ ...editForm, emergencyPhone: value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Billing & Payments */}
          {membership && plan && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Billing & Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Eligibility Progress */}
                <div className="mb-6 pb-6 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Eligibility Progress</span>
                    {isEligible ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Eligible since {formatDate(membership.eligibleDate)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {monthsRemaining} months to go
                      </span>
                    )}
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-sm font-medium mt-2">{membership.paidMonths}/60 months</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {/* Payment Method */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    {membership.autoPayEnabled && membership.paymentMethod ? (
                      <div>
                        <p className="font-medium">
                          {membership.paymentMethod.type === 'card'
                            ? `${membership.paymentMethod.brand?.toUpperCase()} **** ${membership.paymentMethod.last4}`
                            : `${membership.paymentMethod.bankName} **** ${membership.paymentMethod.last4}`}
                        </p>
                        {membership.paymentMethod.type === 'card' && membership.paymentMethod.expiryMonth && (
                          <p className="text-xs text-muted-foreground">
                            Expires {membership.paymentMethod.expiryMonth}/{membership.paymentMethod.expiryYear}
                          </p>
                        )}
                      </div>
                    ) : membership.stripeCustomerId ? (
                      <div>
                        <p className="font-medium">Stripe</p>
                        <p className="text-xs text-muted-foreground">Awaiting checkout completion</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Manual Payments</p>
                        <p className="text-xs text-muted-foreground">Cash, Check, or Zelle</p>
                      </div>
                    )}
                  </div>

                  {/* Billing Frequency & Amount */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Frequency & Amount</p>
                    <div>
                      <p className="font-medium">{getBillingLabel(membership.billingFrequency)}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(duesAmount)} per cycle</p>
                    </div>
                  </div>

                  {/* Billing Day */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Billing Day</p>
                    <p className="font-medium">{membership.billingAnniversaryDay}{getOrdinalSuffix(membership.billingAnniversaryDay || 1)} of month</p>
                  </div>

                  {/* Next Payment Due */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Next Payment Due</p>
                    <p className="font-medium">{formatDate(membership.nextPaymentDue)}</p>
                  </div>

                  {/* Subscription Status (for recurring payments) */}
                  {membership.autoPayEnabled && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Subscription</p>
                      <div className="flex items-center gap-2">
                        {membership.subscriptionStatus === 'active' && (
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="font-medium text-green-700">Active</span>
                          </>
                        )}
                        {membership.subscriptionStatus === 'paused' && (
                          <>
                            <div className="h-2 w-2 rounded-full bg-amber-500" />
                            <span className="font-medium text-amber-700">Paused</span>
                          </>
                        )}
                        {membership.subscriptionStatus === 'past_due' && (
                          <>
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                            <span className="font-medium text-red-700">Past Due</span>
                          </>
                        )}
                        {membership.subscriptionStatus === 'canceled' && (
                          <>
                            <div className="h-2 w-2 rounded-full bg-gray-500" />
                            <span className="font-medium text-gray-700">Canceled</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
                  {membership.autoPayEnabled ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendPortalLink}
                        disabled={isSendingPortalLink}
                      >
                        {isSendingPortalLink ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Portal Link
                          </>
                        )}
                      </Button>
                      {membership.subscriptionStatus === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSubscriptionAction("pause")}
                          disabled={isManagingSubscription}
                        >
                          {isManagingSubscription ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Pausing...
                            </>
                          ) : (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause Subscription
                            </>
                          )}
                        </Button>
                      ) : membership.subscriptionStatus === 'paused' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSubscriptionAction("resume")}
                          disabled={isManagingSubscription}
                        >
                          {isManagingSubscription ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Resuming...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Resume Subscription
                            </>
                          )}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSwitchToManual}
                        disabled={isSwitchingToManual}
                      >
                        {isSwitchingToManual ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Switching...
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Switch to Manual
                          </>
                        )}
                      </Button>
                    </>
                  ) : membership.stripeCustomerId ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResendPaymentLink}
                        disabled={isResendingPaymentLink}
                      >
                        {isResendingPaymentLink ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Resend Payment Link
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSwitchToManual}
                        disabled={isSwitchingToManual}
                      >
                        {isSwitchingToManual ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Switching...
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Switch to Manual
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSetupAutopay}
                      disabled={isSettingUpAutopay}
                    >
                      {isSettingUpAutopay ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Set Up Auto-Pay
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangeFrequencyOpen(true)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Change Frequency
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendPortalInvite}
                    disabled={isSendingPortalInvite}
                  >
                    {isSendingPortalInvite ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Invite to Portal
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment History */}
          <Card className="mb-6">
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

          {/* Email History */}
          <Card>
            <CardHeader>
              <CardTitle>Email History</CardTitle>
            </CardHeader>
            <CardContent>
              {memberEmails.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No emails sent yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberEmails.map((email) => (
                        <TableRow
                          key={email.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewEmail(email)}
                        >
                          <TableCell className="whitespace-nowrap">
                            {formatDate(email.sentAt || email.createdAt)}
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate">
                            {email.subject}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getEmailTemplateTypeLabel(email.templateType)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={email.language === "fa" ? "info" : "inactive"}>
                              {email.language === "fa" ? "FA" : "EN"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getEmailStatusIcon(email.status)}
                              <Badge variant={getEmailStatusVariant(email.status)}>
                                {email.status}
                              </Badge>
                            </div>
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

      {/* Collect Payment Dialog - Entry Point */}
      <CollectPaymentDialog
        member={memberData}
        plan={plan}
        open={collectPaymentOpen}
        onOpenChange={setCollectPaymentOpen}
        onSelectManual={() => setRecordPaymentOpen(true)}
        onSelectChargeCard={() => setChargeCardOpen(true)}
        onSelectSendLink={() => setSendLinkOpen(true)}
      />

      {/* Record Manual Payment Dialog */}
      <RecordMemberDuesDialog
        member={memberData}
        plan={plan}
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Charge Card Sheet */}
      <ChargeCardSheet
        member={memberData}
        plan={plan}
        open={chargeCardOpen}
        onOpenChange={setChargeCardOpen}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Send Payment Link Dialog */}
      <SendPaymentLinkDialog
        member={memberData}
        plan={plan}
        open={sendLinkOpen}
        onOpenChange={setSendLinkOpen}
      />

      {/* Change Frequency Sheet */}
      <ChangeFrequencySheet
        member={memberData}
        plan={plan}
        open={changeFrequencyOpen}
        onOpenChange={setChangeFrequencyOpen}
        onFrequencyChanged={handlePaymentRecorded}
      />

      {/* Email Details Sheet */}
      <Sheet open={emailSheetOpen} onOpenChange={setEmailSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Email Details</SheetTitle>
            <SheetDescription>
              {selectedEmail && formatDate(selectedEmail.sentAt || selectedEmail.createdAt)}
            </SheetDescription>
          </SheetHeader>

          {selectedEmail && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                {getEmailStatusIcon(selectedEmail.status)}
                <Badge variant={getEmailStatusVariant(selectedEmail.status)} className="text-sm">
                  {selectedEmail.status}
                </Badge>
                <Badge variant="outline">
                  {getEmailTemplateTypeLabel(selectedEmail.templateType)}
                </Badge>
              </div>

              {/* Subject */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subject</p>
                <p className="font-medium">{selectedEmail.subject}</p>
              </div>

              {/* Language */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Language</p>
                <Badge variant={selectedEmail.language === "fa" ? "info" : "inactive"}>
                  {selectedEmail.language === "fa" ? "Farsi" : "English"}
                </Badge>
              </div>

              {/* Preview */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Preview</p>
                <div
                  className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap"
                  dir={selectedEmail.language === "fa" ? "rtl" : "ltr"}
                >
                  {selectedEmail.bodyPreview}
                </div>
              </div>

              {/* Failure Reason */}
              {selectedEmail.failureReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800">Failure Reason</p>
                  <p className="text-sm text-red-600">{selectedEmail.failureReason}</p>
                </div>
              )}

              {/* Technical Details */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Email ID: {selectedEmail.id}</p>
                {selectedEmail.resendId && <p>Resend ID: {selectedEmail.resendId}</p>}
                <p>Created: {formatDate(selectedEmail.createdAt)}</p>
                {selectedEmail.sentAt && <p>Sent: {formatDate(selectedEmail.sentAt)}</p>}
                {selectedEmail.deliveredAt && <p>Delivered: {formatDate(selectedEmail.deliveredAt)}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" disabled>
                  <Send className="h-4 w-4 mr-2" />
                  Resend
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Agreement Dialog */}
      <Dialog open={agreementDialogOpen} onOpenChange={setAgreementDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Membership Agreement
            </DialogTitle>
            <DialogDescription>
              {membership?.agreementSignedAt
                ? `Signed by ${memberData.firstName} ${memberData.lastName}`
                : "Agreement details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Agreement preview */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Agreement document</p>
              {agreementUrl ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    src={`${agreementUrl}#view=FitH`}
                    className="w-full h-[500px]"
                    title="Agreement PDF"
                  />
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  No agreement document available yet.
                </div>
              )}
            </div>

            {/* Agreement Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Agreement ID</p>
                <p className="font-mono text-sm">{initialAgreement?.id || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Template Version</p>
                <p className="font-medium">{initialAgreement?.templateVersion || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={initialAgreement?.signedAt ? "success" : "info"}>
                  {initialAgreement?.signedAt ? "Signed" : "Pending"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Signed At</p>
                <p className="font-medium">
                  {initialAgreement?.signedAt ? formatDate(initialAgreement.signedAt) : "—"}
                </p>
              </div>
            </div>

            {/* Audit Trail */}
            {initialAgreement?.ipAddress && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Audit Trail</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-lg p-3">
                  <p>IP Address: {initialAgreement.ipAddress}</p>
                  <p>User Agent: {initialAgreement.userAgent || "—"}</p>
                  <p>Consent checkbox: {initialAgreement.consentChecked ? "Yes" : "No"}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (agreementUrl) {
                    window.open(agreementUrl, "_blank");
                  } else {
                    toast.info("No agreement to download yet");
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => toast.info("Send copy to member - coming soon")}
              >
                <Send className="h-4 w-4 mr-2" />
                Email Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
