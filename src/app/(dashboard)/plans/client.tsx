"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { Plan } from "@/lib/types";
import { toast } from "sonner";

interface PlansPageClientProps {
  initialPlans: Plan[];
}

export function PlansPageClient({ initialPlans }: PlansPageClientProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);

  // Plan management state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);
  const [planFormData, setPlanFormData] = useState({
    name: "",
    description: "",
    monthly: "",
    biannual: "",
    annual: "",
    enrollmentFee: "",
  });

  const handleEditPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setPlanFormData({
      name: plan.name,
      description: plan.description || "",
      monthly: plan.pricing.monthly.toString(),
      biannual: plan.pricing.biannual.toString(),
      annual: plan.pricing.annual.toString(),
      enrollmentFee: plan.enrollmentFee.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleAddPlan = () => {
    setEditingPlanId(null);
    setPlanFormData({
      name: "",
      description: "",
      monthly: "",
      biannual: "",
      annual: "",
      enrollmentFee: "500",
    });
    setAddDialogOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlan(true);

    try {
      const payload = {
        name: planFormData.name,
        description: planFormData.description,
        pricing: {
          monthly: Number(planFormData.monthly) || 0,
          biannual: Number(planFormData.biannual) || 0,
          annual: Number(planFormData.annual) || 0,
        },
        enrollmentFee: Number(planFormData.enrollmentFee) || 0,
      };

      if (editDialogOpen && editingPlanId) {
        // Update existing plan
        const res = await fetch("/api/plans/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingPlanId, ...payload }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to update plan");
        }
        setPlans((prev) => prev.map((p) => (p.id === editingPlanId ? json.plan : p)));
        toast.success("Plan updated successfully");
      } else {
        // Create new plan
        const res = await fetch("/api/plans/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to create plan");
        }
        setPlans((prev) => [...prev, json.plan]);
        toast.success("Plan created successfully");
      }

      setEditDialogOpen(false);
      setAddDialogOpen(false);
      setEditingPlanId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    setTogglingPlanId(plan.id);
    try {
      const res = await fetch("/api/plans/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to toggle plan");
      }
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? json.plan : p)));
      toast.success(`Plan ${json.plan.isActive ? "activated" : "deactivated"} successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle plan");
    } finally {
      setTogglingPlanId(null);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Membership Plans</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Configure plans and pricing options for your members
                </p>
              </div>
              <Button onClick={handleAddPlan} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Plan
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.isActive ? "" : "opacity-60"}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.description && (
                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {togglingPlanId === plan.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      <Switch
                        checked={plan.isActive}
                        onCheckedChange={() => handleToggleActive(plan)}
                        disabled={togglingPlanId === plan.id}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Enrollment Fee</p>
                    <p className="text-lg font-bold">{formatCurrency(plan.enrollmentFee)}</p>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPlan(plan)}
                      className="w-full gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {plans.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No plans configured yet</p>
              <Button onClick={handleAddPlan} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Plan
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>Update plan details and pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePlan}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Plan Name</Label>
                <Input
                  id="edit-name"
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  placeholder="e.g., Single, Married, Family"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Input
                  id="edit-description"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  placeholder="e.g., Individual coverage only"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-monthly">Monthly</Label>
                  <Input
                    id="edit-monthly"
                    type="number"
                    value={planFormData.monthly}
                    onChange={(e) => setPlanFormData({ ...planFormData, monthly: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-biannual">Bi-Annual (6mo)</Label>
                  <Input
                    id="edit-biannual"
                    type="number"
                    value={planFormData.biannual}
                    onChange={(e) => setPlanFormData({ ...planFormData, biannual: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-annual">Annual (12mo)</Label>
                  <Input
                    id="edit-annual"
                    type="number"
                    value={planFormData.annual}
                    onChange={(e) => setPlanFormData({ ...planFormData, annual: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-enrollment">Enrollment Fee</Label>
                <Input
                  id="edit-enrollment"
                  type="number"
                  value={planFormData.enrollmentFee}
                  onChange={(e) => setPlanFormData({ ...planFormData, enrollmentFee: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={savingPlan}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPlan}>
                {savingPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
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
          <form onSubmit={handleSavePlan}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Plan Name</Label>
                <Input
                  id="add-name"
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  placeholder="e.g., Single, Married, Family"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-description">Description (optional)</Label>
                <Input
                  id="add-description"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  placeholder="e.g., Individual coverage only"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-monthly">Monthly</Label>
                  <Input
                    id="add-monthly"
                    type="number"
                    value={planFormData.monthly}
                    onChange={(e) => setPlanFormData({ ...planFormData, monthly: e.target.value })}
                    placeholder="20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-biannual">Bi-Annual (6mo)</Label>
                  <Input
                    id="add-biannual"
                    type="number"
                    value={planFormData.biannual}
                    onChange={(e) => setPlanFormData({ ...planFormData, biannual: e.target.value })}
                    placeholder="120"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-annual">Annual (12mo)</Label>
                  <Input
                    id="add-annual"
                    type="number"
                    value={planFormData.annual}
                    onChange={(e) => setPlanFormData({ ...planFormData, annual: e.target.value })}
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
                  value={planFormData.enrollmentFee}
                  onChange={(e) => setPlanFormData({ ...planFormData, enrollmentFee: e.target.value })}
                  placeholder="500"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)} disabled={savingPlan}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPlan}>
                {savingPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Plan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
