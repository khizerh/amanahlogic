"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/utils";
import { returningColumns } from "./returning-columns";
import type { ReturningApplicationWithPlan } from "@/lib/types";

interface ReturningApplicationsTableProps {
  applications: ReturningApplicationWithPlan[];
}

export function ReturningApplicationsTable({ applications }: ReturningApplicationsTableProps) {
  const router = useRouter();
  const [selectedApp, setSelectedApp] = useState<ReturningApplicationWithPlan | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Editable fields
  const [paidMonths, setPaidMonths] = useState(0);
  const [waiveEnrollmentFee, setWaiveEnrollmentFee] = useState(false);

  // Loading states
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const openReview = useCallback((app: ReturningApplicationWithPlan) => {
    setSelectedApp(app);
    setPaidMonths(app.paidMonths);
    setWaiveEnrollmentFee(app.enrollmentFeeStatus === "waived");
    setSheetOpen(true);
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selectedApp) return;
    setIsApproving(true);
    try {
      // Save adjusted values first
      const enrollmentFeeStatus = waiveEnrollmentFee ? "waived" : "unpaid";
      const putRes = await fetch(`/api/returning-applications/${selectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidMonths, enrollmentFeeStatus }),
      });
      if (!putRes.ok) {
        const result = await putRes.json();
        throw new Error(result.error || "Failed to save changes");
      }

      // Approve
      const approveRes = await fetch(`/api/returning-applications/${selectedApp.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await approveRes.json();

      if (approveRes.status === 409) {
        toast.error(result.error || "Application already processed");
        setSheetOpen(false);
        router.refresh();
        return;
      }

      if (!approveRes.ok) {
        throw new Error(result.error || "Failed to approve");
      }

      toast.success("Application approved", {
        description: "Member created and onboarding started.",
      });
      setSheetOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setIsApproving(false);
    }
  }, [selectedApp, paidMonths, waiveEnrollmentFee, router]);

  const handleReject = useCallback(async () => {
    if (!selectedApp) return;
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/returning-applications/${selectedApp.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();

      if (res.status === 409) {
        toast.error(result.error || "Application already processed");
        setSheetOpen(false);
        setRejectDialogOpen(false);
        router.refresh();
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || "Failed to reject");
      }

      toast.success("Application rejected");
      setSheetOpen(false);
      setRejectDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setIsRejecting(false);
    }
  }, [selectedApp, router]);

  if (applications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No applications
      </p>
    );
  }

  return (
    <>
      <DataTable
        columns={returningColumns}
        data={applications}
        searchColumn="name"
        searchPlaceholder="Search by name or email..."
        filterColumns={[
          {
            column: "status",
            label: "Status",
            options: [
              { label: "All", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Rejected", value: "rejected" },
            ],
          },
        ]}
        onRowClick={openReview}
        pageSize={20}
      />

      {/* Review Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedApp && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedApp.firstName}{" "}
                  {selectedApp.middleName ? `${selectedApp.middleName} ` : ""}
                  {selectedApp.lastName}
                </SheetTitle>
                <SheetDescription>
                  Submitted {new Date(selectedApp.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-right">{selectedApp.email}</span>
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium text-right">{formatPhoneNumber(selectedApp.phone)}</span>
                    <span className="text-muted-foreground">Language</span>
                    <span className="font-medium text-right">
                      {selectedApp.preferredLanguage === "fa" ? "Farsi" : "English"}
                    </span>
                  </div>
                </div>

                {/* Address */}
                {(selectedApp.address.street || selectedApp.address.city) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Address</h3>
                    <p className="text-sm">
                      {[selectedApp.address.street, selectedApp.address.city, selectedApp.address.state, selectedApp.address.zip]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {/* Family */}
                {(selectedApp.spouseName || selectedApp.children.length > 0) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Family</h3>
                    <div className="text-sm space-y-1">
                      {selectedApp.spouseName && (
                        <p>Spouse: <span className="font-medium">{selectedApp.spouseName}</span></p>
                      )}
                      {selectedApp.children.length > 0 && (
                        <p>Children: <span className="font-medium">{selectedApp.children.map(c => c.name).join(", ")}</span></p>
                      )}
                    </div>
                  </div>
                )}

                {/* Emergency Contact */}
                {selectedApp.emergencyContact.name && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</h3>
                    <p className="text-sm">
                      {selectedApp.emergencyContact.name}
                      {selectedApp.emergencyContact.phone && (
                        <> — {formatPhoneNumber(selectedApp.emergencyContact.phone)}</>
                      )}
                    </p>
                  </div>
                )}

                <div className="border-t" />

                {/* Membership */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Membership</h3>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <Badge variant="info">{selectedApp.plan.name}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Billing</span>
                    <span className="font-medium capitalize">{selectedApp.billingFrequency}</span>
                  </div>

                  {selectedApp.status === "pending" ? (
                    <>
                      {/* Paid Months - plain input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="paidMonths">Paid Months</Label>
                        <Input
                          id="paidMonths"
                          type="number"
                          min={0}
                          max={720}
                          value={paidMonths}
                          onChange={(e) => setPaidMonths(parseInt(e.target.value) || 0)}
                          className="w-full"
                        />
                      </div>

                      {/* Waive Enrollment Fee - checkbox */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="waiveEnrollmentFee"
                          checked={waiveEnrollmentFee}
                          onCheckedChange={(checked) => setWaiveEnrollmentFee(checked === true)}
                        />
                        <Label htmlFor="waiveEnrollmentFee" className="text-sm font-normal cursor-pointer">
                          Waive enrollment fee
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Paid Months</span>
                        <span className="font-medium">{selectedApp.paidMonths}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Enrollment Fee</span>
                        <span className="font-medium capitalize">{selectedApp.enrollmentFeeStatus}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={selectedApp.status === "approved" ? "success" : "error"}>
                          {selectedApp.status === "approved" ? "Approved" : "Rejected"}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                {selectedApp.status === "pending" && (
                  <>
                    <div className="border-t" />

                    {/* Actions */}
                    <div className="flex items-center gap-3 pb-4">
                      <Button
                        className="flex-1"
                        onClick={handleApprove}
                        disabled={isApproving || isRejecting}
                      >
                        {isApproving ? "Approving..." : "Approve & Start Onboarding"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setRejectDialogOpen(true)}
                        disabled={isApproving || isRejecting}
                      >
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Reject Confirmation */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the application from{" "}
              <strong>
                {selectedApp?.firstName} {selectedApp?.lastName}
              </strong>
              ? This cannot be undone.
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
    </>
  );
}
