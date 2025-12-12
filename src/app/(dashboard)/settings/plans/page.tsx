"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { getPlans, formatCurrency } from "@/lib/mock-data";
import { Plan } from "@/lib/types";
import { toast } from "sonner";

export default function PlansSettingsPage() {
  const plans = getPlans();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "single",
    description: "",
    monthly: "",
    biannual: "",
    annual: "",
    enrollmentFee: "",
  });

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      type: plan.type,
      description: plan.description,
      monthly: plan.pricing.monthly.toString(),
      biannual: plan.pricing.biannual.toString(),
      annual: plan.pricing.annual.toString(),
      enrollmentFee: plan.enrollmentFee.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleAddNew = () => {
    setFormData({
      name: "",
      type: "single",
      description: "",
      monthly: "",
      biannual: "",
      annual: "",
      enrollmentFee: "500",
    });
    setAddDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would save to the database
    toast.success(editDialogOpen ? "Plan updated successfully" : "Plan created successfully");
    setEditDialogOpen(false);
    setAddDialogOpen(false);
  };

  const handleToggleActive = (plan: Plan) => {
    // In a real app, this would update the database
    toast.success(`Plan ${plan.isActive ? "deactivated" : "activated"} successfully`);
  };

  const getPlanTypeBadge = (type: string) => {
    const badges = {
      single: "bg-blue-100 text-blue-800",
      married: "bg-purple-100 text-purple-800",
      widow: "bg-green-100 text-green-800",
    };
    return badges[type as keyof typeof badges] || "bg-gray-100 text-gray-800";
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Plans</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold">Plan Management</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Configure membership plans and pricing options
                </p>
              </div>
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Plan
              </Button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.isActive ? "" : "opacity-60"}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-1">{plan.description}</CardDescription>
                    </div>
                    <Badge className={getPlanTypeBadge(plan.type)}>
                      {plan.type.charAt(0).toUpperCase() + plan.type.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pricing Table */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Pricing</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8">Frequency</TableHead>
                          <TableHead className="h-8 text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="py-2">Monthly</TableCell>
                          <TableCell className="py-2 text-right font-semibold">
                            {formatCurrency(plan.pricing.monthly)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="py-2">Bi-Annual (6mo)</TableCell>
                          <TableCell className="py-2 text-right font-semibold">
                            {formatCurrency(plan.pricing.biannual)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="py-2">Annual (12mo)</TableCell>
                          <TableCell className="py-2 text-right font-semibold">
                            {formatCurrency(plan.pricing.annual)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Enrollment Fee */}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Enrollment Fee</p>
                    <p className="text-lg font-bold">{formatCurrency(plan.enrollmentFee)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(plan)}
                      className="flex-1 gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant={plan.isActive ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggleActive(plan)}
                      className="flex-1 gap-2"
                    >
                      {plan.isActive ? (
                        <>
                          <ToggleLeft className="h-4 w-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className="h-4 w-4" />
                          Activate
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>Update plan details and pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Plan Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Plan Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="widow">Widow/Widower</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-monthly">Monthly</Label>
                  <Input
                    id="edit-monthly"
                    type="number"
                    value={formData.monthly}
                    onChange={(e) => setFormData({ ...formData, monthly: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-biannual">Bi-Annual (6mo)</Label>
                  <Input
                    id="edit-biannual"
                    type="number"
                    value={formData.biannual}
                    onChange={(e) => setFormData({ ...formData, biannual: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-annual">Annual (12mo)</Label>
                  <Input
                    id="edit-annual"
                    type="number"
                    value={formData.annual}
                    onChange={(e) => setFormData({ ...formData, annual: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-enrollment">Enrollment Fee</Label>
                <Input
                  id="edit-enrollment"
                  type="number"
                  value={formData.enrollmentFee}
                  onChange={(e) => setFormData({ ...formData, enrollmentFee: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Plan Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Plan</DialogTitle>
            <DialogDescription>Create a new membership plan</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Plan Name</Label>
                  <Input
                    id="add-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Single"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-type">Plan Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="add-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="widow">Widow/Widower</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-description">Description</Label>
                <Input
                  id="add-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Individual coverage only"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-monthly">Monthly</Label>
                  <Input
                    id="add-monthly"
                    type="number"
                    value={formData.monthly}
                    onChange={(e) => setFormData({ ...formData, monthly: e.target.value })}
                    placeholder="20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-biannual">Bi-Annual (6mo)</Label>
                  <Input
                    id="add-biannual"
                    type="number"
                    value={formData.biannual}
                    onChange={(e) => setFormData({ ...formData, biannual: e.target.value })}
                    placeholder="120"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-annual">Annual (12mo)</Label>
                  <Input
                    id="add-annual"
                    type="number"
                    value={formData.annual}
                    onChange={(e) => setFormData({ ...formData, annual: e.target.value })}
                    placeholder="240"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-enrollment">Enrollment Fee</Label>
                <Input
                  id="add-enrollment"
                  type="number"
                  value={formData.enrollmentFee}
                  onChange={(e) => setFormData({ ...formData, enrollmentFee: e.target.value })}
                  placeholder="500"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
