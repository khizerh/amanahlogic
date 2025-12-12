"use client";

import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { getMembers } from "@/lib/mock-data";

export default function MembersPage() {
  const members = getMembers();

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
            <Link href="/members/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </Link>
          </div>

          {/* DataTable wrapped in Card */}
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                data={members}
                searchColumn="name"
                searchPlaceholder="Search by name, email, or phone..."
                filterColumns={[
                  {
                    column: "status",
                    label: "Status",
                    options: [
                      { label: "All Statuses", value: "all" },
                      { label: "Pending", value: "pending" },
                      { label: "Awaiting Signature", value: "awaiting_signature" },
                      { label: "Waiting Period", value: "waiting_period" },
                      { label: "Active", value: "active" },
                      { label: "Lapsed", value: "lapsed" },
                      { label: "Cancelled", value: "cancelled" },
                    ],
                  },
                  {
                    column: "planType",
                    label: "Plan",
                    options: [
                      { label: "All Plans", value: "all" },
                      { label: "Single", value: "single" },
                      { label: "Married", value: "married" },
                      { label: "Widow", value: "widow" },
                    ],
                  },
                ]}
                pageSize={20}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
