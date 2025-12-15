import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { MembersService } from "@/lib/database/members";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { ImportMembersDialog } from "@/components/members/import-members-dialog";
import { MembersTable } from "./client";

export default async function MembersPage() {
  const organizationId = await getOrganizationId();
  const members = await MembersService.getAllWithMembership(organizationId);

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Members</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage member information and view membership details
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ImportMembersDialog
                trigger={
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                }
              />
              <Link href="/members/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </Link>
            </div>
          </div>

          {/* Status Reference */}
          <Card className="mb-6 border-l-4 border-l-blue-500 bg-blue-50/50">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">Status Reference</p>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                <li>
                  <strong>Pending:</strong> Onboarding incomplete (missing agreement and/or first payment).
                </li>
                <li>
                  <strong>Current:</strong> Payments up to date - member is in good standing.
                </li>
                <li>
                  <strong>Lapsed:</strong> Behind on payment(s), in grace period.
                </li>
                <li>
                  <strong>Cancelled:</strong> 24+ months unpaid, membership voided.
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                <strong>Eligibility:</strong> Members with 60+ paid months are eligible for burial benefits (shown separately from status).
              </p>
            </CardContent>
          </Card>

          {/* DataTable wrapped in Card */}
          <Card>
            <CardContent className="pt-6">
              <MembersTable members={members} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
