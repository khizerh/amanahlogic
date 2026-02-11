import { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Profile | Member Portal",
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users } from "lucide-react";
import { MemberPortalService } from "@/lib/database/member-portal";
import { MembersService } from "@/lib/database/members";
import { StripePortalButton } from "./StripePortalButton";
import { EditableProfile } from "./EditableProfile";
import { formatPhoneNumber } from "@/lib/utils";

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default async function MemberProfilePage() {
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
              <p className="text-amber-700 mt-1">Please log in to view your profile.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const portalData = await MemberPortalService.getMemberById(memberId, organizationId);

  if (!portalData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">Error Loading Profile</h2>
              <p className="text-red-700 mt-1">Unable to load your profile. Please try again later.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { member, membership, plan, organization } = portalData;
  const hasPaymentMethod = membership?.autoPayEnabled && membership?.paymentMethod;

  // Fetch payer name if this member has a payer
  let payerMemberName: string | null = null;
  if (membership?.payerMemberId) {
    const payer = await MembersService.getById(membership.payerMemberId);
    if (payer) {
      payerMemberName = `${payer.firstName} ${payer.lastName}`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your membership information
        </p>
      </div>

      {/* Editable Personal Info & Emergency Contact */}
      <EditableProfile member={member} />

      {/* Membership Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membership Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="font-medium">{plan?.name || "No Plan"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                className={
                  membership?.status === "current"
                    ? "bg-green-100 text-green-800"
                    : membership?.status === "lapsed"
                    ? "bg-yellow-100 text-yellow-800"
                    : membership?.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : ""
                }
              >
                {membership?.status || "N/A"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing Frequency</p>
              <p className="font-medium capitalize">{membership?.billingFrequency || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Months Paid</p>
              <p className="font-medium">{membership?.paidMonths || 0} months</p>
            </div>
          </div>

          {/* Covered Members */}
          {(member.spouseName || (member.children && member.children.length > 0)) && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-3">Covered Members</p>
              <div className="space-y-2">
                {member.spouseName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{member.spouseName}</span>
                    <span className="text-muted-foreground">Spouse</span>
                  </div>
                )}
                {member.children?.map((child) => {
                  const age = child.dateOfBirth ? calculateAge(child.dateOfBirth) : null;
                  return (
                    <div key={child.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{child.name}</span>
                      <span className="text-muted-foreground">
                        {age !== null ? `${age} ${age === 1 ? "yr" : "yrs"}` : "Child"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Settings - Always show if membership exists */}
      {membership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {membership.payerMemberId && payerMemberName ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Paid by {payerMemberName}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your dues are being paid by another member. Contact {organization.name} for details.
                </p>
              </div>
            ) : hasPaymentMethod && membership.paymentMethod ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Payment Method</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {membership.paymentMethod.brand || membership.paymentMethod.type}
                    </Badge>
                    <span className="text-sm font-medium">
                      ending in {membership.paymentMethod.last4}
                    </span>
                    {membership.paymentMethod.expiryMonth && membership.paymentMethod.expiryYear && (
                      <span className="text-sm text-muted-foreground">
                        (expires {membership.paymentMethod.expiryMonth}/{membership.paymentMethod.expiryYear})
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Auto-Pay</p>
                  <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                </div>
                <div className="pt-2">
                  <StripePortalButton />
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>No automatic payment method on file.</p>
                <p className="mt-2">
                  Contact {organization.name} to set up automatic payments.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact for Changes */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Need to change your name or email? Contact {organization.name} at{" "}
            <a href={`mailto:${organization.email}`} className="text-brand-teal hover:underline">
              {organization.email}
            </a>{" "}
            or call{" "}
            <a href={`tel:${organization.phone}`} className="text-brand-teal hover:underline">
              {formatPhoneNumber(organization.phone)}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
