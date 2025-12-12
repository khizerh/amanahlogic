"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Building2, CreditCard, Users, Settings as SettingsIcon } from "lucide-react";
import { getOrganization } from "@/lib/mock-data";
import { toast } from "sonner";

export default function SettingsPage() {
  const organization = getOrganization();
  const [formData, setFormData] = useState({
    name: organization.name,
    email: organization.email,
    phone: organization.phone,
    street: organization.address.street,
    city: organization.address.city,
    state: organization.address.state,
    zip: organization.address.zip,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would save to the database
    toast.success("Organization settings saved successfully");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your organization settings and preferences
            </p>
          </div>

          <Tabs defaultValue="organization" className="space-y-6">
            <TabsList>
              <TabsTrigger value="organization" className="gap-2">
                <Building2 className="h-4 w-4" />
                Organization
              </TabsTrigger>
              <TabsTrigger value="plans" className="gap-2">
                <SettingsIcon className="h-4 w-4" />
                Plans
              </TabsTrigger>
              <TabsTrigger value="stripe" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-2">
                <Users className="h-4 w-4" />
                Admins
              </TabsTrigger>
            </TabsList>

            {/* Organization Tab */}
            <TabsContent value="organization">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                  <CardDescription>
                    Update your organization details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSave} className="space-y-6">
                    {/* Organization Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter organization name"
                      />
                    </div>

                    {/* Contact Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email">Contact Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="admin@organization.org"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Address</h3>

                      <div className="space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input
                          id="street"
                          name="street"
                          value={formData.street}
                          onChange={handleChange}
                          placeholder="123 Main Street"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            placeholder="Houston"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            placeholder="TX"
                            maxLength={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            name="zip"
                            value={formData.zip}
                            onChange={handleChange}
                            placeholder="77001"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Plans Tab */}
            <TabsContent value="plans">
              <Card>
                <CardHeader>
                  <CardTitle>Plan Management</CardTitle>
                  <CardDescription>
                    Configure membership plans and pricing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Manage your membership plans in detail
                    </p>
                    <Link href="/settings/plans">
                      <Button>Go to Plan Management</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stripe Tab */}
            <TabsContent value="stripe">
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Integration</CardTitle>
                  <CardDescription>
                    Configure payment processing with Stripe Connect
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Stripe Connect Status</p>
                        <p className="text-sm text-muted-foreground">
                          {organization.stripeOnboarded
                            ? "Connected and ready to accept payments"
                            : "Not connected"}
                        </p>
                      </div>
                      <div>
                        {organization.stripeOnboarded ? (
                          <Button variant="outline">Manage Account</Button>
                        ) : (
                          <Button>Connect Stripe</Button>
                        )}
                      </div>
                    </div>

                    {organization.stripeConnectId && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Account ID</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {organization.stripeConnectId}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Platform Fee</p>
                      <p className="text-sm text-muted-foreground">
                        ${organization.platformFee.toFixed(2)} per transaction
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admins Tab */}
            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                  <CardDescription>
                    Manage administrator access and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Admin user management coming soon
                    </p>
                    <Button disabled>Add Admin User</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
