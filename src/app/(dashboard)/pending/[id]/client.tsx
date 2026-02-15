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
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/utils";
import type { ReturningApplicationWithPlan } from "@/lib/types";

interface ApplicationDetailClientProps {
  application: ReturningApplicationWithPlan;
}

export function ApplicationDetailClient({ application }: ApplicationDetailClientProps) {
  const router = useRouter();
  const isPending = application.status === "pending";

  // Editable fields
  const [paidMonthsValue, setPaidMonthsValue] = useState(application.paidMonths);
  const [enrollmentFeeValue, setEnrollmentFeeValue] = useState(application.enrollmentFeeStatus);
  const [adminNotesValue, setAdminNotesValue] = useState(application.adminNotes || "");

  // Edit mode toggles
  const [isEditingPaidMonths, setIsEditingPaidMonths] = useState(false);
  const [isEditingEnrollmentFee, setIsEditingEnrollmentFee] = useState(false);

  // Loading states
  const [isSavingPaidMonths, setIsSavingPaidMonths] = useState(false);
  const [isSavingEnrollmentFee, setIsSavingEnrollmentFee] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleSavePaidMonths = useCallback(async () => {
    setIsSavingPaidMonths(true);
    try {
      const response = await fetch(`/api/returning-applications/${application.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidMonths: paidMonthsValue }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update");
      }
      toast.success("Paid months updated");
      setIsEditingPaidMonths(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSavingPaidMonths(false);
    }
  }, [application.id, paidMonthsValue, router]);

  const handleSaveEnrollmentFee = useCallback(async () => {
    setIsSavingEnrollmentFee(true);
    try {
      const response = await fetch(`/api/returning-applications/${application.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentFeeStatus: enrollmentFeeValue }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update");
      }
      toast.success("Enrollment fee status updated");
      setIsEditingEnrollmentFee(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSavingEnrollmentFee(false);
    }
  }, [application.id, enrollmentFeeValue, router]);

  const handleSaveNotes = useCallback(async () => {
    setIsSavingNotes(true);
    try {
      const response = await fetch(`/api/returning-applications/${application.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNotesValue || null }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update");
      }
      toast.success("Admin notes saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  }, [application.id, adminNotesValue, router]);

  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/returning-applications/${application.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (response.status === 409) {
        toast.error(result.error || "Application already processed");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to approve");
      }

      toast.success("Application approved", {
        description: "Member created and onboarding started.",
      });
      router.push("/pending");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setIsApproving(false);
    }
  }, [application.id, router]);

  const handleReject = useCallback(async () => {
    setIsRejecting(true);
    try {
      const response = await fetch(`/api/returning-applications/${application.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: adminNotesValue || undefined }),
      });
      const result = await response.json();

      if (response.status === 409) {
        toast.error(result.error || "Application already processed");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to reject");
      }

      toast.success("Application rejected");
      router.push("/pending");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setIsRejecting(false);
    }
  }, [application.id, adminNotesValue, router]);

  const fullName = `${application.firstName} ${application.middleName ? `${application.middleName} ` : ""}${application.lastName}`;

  const getStatusBadge = () => {
    switch (application.status) {
      case "pending":
        return <Badge variant="warning">Pending Review</Badge>;
      case "approved":
        return <Badge variant="success">Approved</Badge>;
      case "rejected":
        return <Badge variant="error">Rejected</Badge>;
    }
  };

  const getEnrollmentFeeBadgeVariant = (status: string) => {
    const variants: Record<string, "success" | "warning" | "secondary"> = {
      paid: "success",
      waived: "secondary",
      unpaid: "warning",
    };
    return variants[status] || "warning";
  };

  const address = application.address;
  const addressStr = [address.street, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumbs */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/pending">Pending</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{fullName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{fullName}</h1>
              <div className="mt-2 flex items-center gap-3">
                {getStatusBadge()}
                <span className="text-sm text-muted-foreground">
                  Submitted {new Date(application.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Personal Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Full Name</Label>
                      <p className="font-medium">{fullName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Email</Label>
                      <p className="font-medium">{application.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-medium">{formatPhoneNumber(application.phone)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Preferred Language</Label>
                      <p className="font-medium">
                        {application.preferredLanguage === "fa" ? "Farsi" : "English"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground text-xs">Address</Label>
                      <p className="font-medium">{addressStr || "Not provided"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Family Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Family Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Spouse Name</Label>
                      <p className="font-medium">{application.spouseName || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Children</Label>
                      {application.children.length === 0 ? (
                        <p className="font-medium">None</p>
                      ) : (
                        <ul className="space-y-1">
                          {application.children.map((child) => (
                            <li key={child.id} className="text-sm">
                              {child.name} (DOB: {child.dateOfBirth})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Name</Label>
                      <p className="font-medium">
                        {application.emergencyContact.name || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-medium">
                        {application.emergencyContact.phone
                          ? formatPhoneNumber(application.emergencyContact.phone)
                          : "Not provided"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column: Membership Details + Actions */}
            <div className="space-y-6">
              {/* Membership Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Membership Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Plan (read-only) */}
                  <div>
                    <Label className="text-muted-foreground text-xs">Plan</Label>
                    <div className="mt-1">
                      <Badge variant="info">{application.plan.name}</Badge>
                    </div>
                  </div>

                  {/* Billing Frequency (read-only) */}
                  <div>
                    <Label className="text-muted-foreground text-xs">Billing Frequency</Label>
                    <p className="font-medium capitalize">{application.billingFrequency}</p>
                  </div>

                  {/* Paid Months (editable) */}
                  <div>
                    <Label className="text-muted-foreground text-xs">Paid Months</Label>
                    {isPending && isEditingPaidMonths ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min={0}
                          max={720}
                          value={paidMonthsValue}
                          onChange={(e) => setPaidMonthsValue(parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                        <Button
                          size="sm"
                          onClick={handleSavePaidMonths}
                          disabled={isSavingPaidMonths}
                        >
                          {isSavingPaidMonths ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPaidMonthsValue(application.paidMonths);
                            setIsEditingPaidMonths(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-medium">{paidMonthsValue}</p>
                        {isPending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-6 px-2"
                            onClick={() => setIsEditingPaidMonths(true)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Enrollment Fee Status (editable) */}
                  <div>
                    <Label className="text-muted-foreground text-xs">Enrollment Fee</Label>
                    {isPending && isEditingEnrollmentFee ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Select
                          value={enrollmentFeeValue}
                          onValueChange={(v) =>
                            setEnrollmentFeeValue(v as "unpaid" | "paid" | "waived")
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="waived">Waived</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={handleSaveEnrollmentFee}
                          disabled={isSavingEnrollmentFee}
                        >
                          {isSavingEnrollmentFee ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEnrollmentFeeValue(application.enrollmentFeeStatus);
                            setIsEditingEnrollmentFee(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getEnrollmentFeeBadgeVariant(enrollmentFeeValue)}>
                          {enrollmentFeeValue.charAt(0).toUpperCase() + enrollmentFeeValue.slice(1)}
                        </Badge>
                        {isPending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-6 px-2"
                            onClick={() => setIsEditingEnrollmentFee(true)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Admin Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Admin Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add notes about this application..."
                    value={adminNotesValue}
                    onChange={(e) => setAdminNotesValue(e.target.value)}
                    rows={3}
                    disabled={!isPending}
                  />
                  {isPending && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                    >
                      {isSavingNotes ? "Saving..." : "Save Notes"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              {isPending && (
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={handleApprove}
                      disabled={isApproving || isRejecting}
                    >
                      {isApproving ? "Approving..." : "Approve & Start Onboarding"}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full"
                          disabled={isApproving || isRejecting}
                        >
                          Reject Application
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject Application</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to reject the application from{" "}
                            <strong>{fullName}</strong>? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleReject}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isRejecting ? "Rejecting..." : "Reject"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
