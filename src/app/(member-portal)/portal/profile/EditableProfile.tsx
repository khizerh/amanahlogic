"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Member } from "@/lib/types";

interface EditableProfileProps {
  member: Member;
}

type EditingField = "phone" | "address" | "language" | "emergency" | null;

export function EditableProfile({ member: initialMember }: EditableProfileProps) {
  const [member, setMember] = useState(initialMember);
  const [editing, setEditing] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);

  // Edit state values
  const [phone, setPhone] = useState(member.phone);
  const [address, setAddress] = useState(member.address);
  const [language, setLanguage] = useState(member.preferredLanguage);
  const [emergency, setEmergency] = useState(member.emergencyContact);

  const startEdit = (field: EditingField) => {
    // Reset to current values
    setPhone(member.phone);
    setAddress(member.address);
    setLanguage(member.preferredLanguage);
    setEmergency(member.emergencyContact);
    setEditing(field);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const saveField = async (field: EditingField) => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};

      if (field === "phone") updates.phone = phone;
      if (field === "address") updates.address = address;
      if (field === "language") updates.preferredLanguage = language;
      if (field === "emergency") updates.emergencyContact = emergency;

      const response = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const { member: updatedMember } = await response.json();
      setMember(updatedMember);
      setEditing(null);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const EditButton = ({ field }: { field: EditingField }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      onClick={() => startEdit(field)}
    >
      <Pencil className="h-3 w-3" />
    </Button>
  );

  const SaveCancelButtons = ({ field }: { field: EditingField }) => (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
        onClick={() => saveField(field)}
        disabled={saving}
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
        onClick={cancelEdit}
        disabled={saving}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name - Not editable */}
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{member.firstName} {member.lastName}</p>
            </div>

            {/* Email - Not editable */}
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{member.email}</p>
            </div>

            {/* Phone - Editable */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Phone</p>
                {editing === "phone" ? (
                  <SaveCancelButtons field="phone" />
                ) : (
                  <EditButton field="phone" />
                )}
              </div>
              {editing === "phone" ? (
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="mt-1"
                />
              ) : (
                <p className="font-medium">{member.phone || "Not provided"}</p>
              )}
            </div>

            {/* Language - Editable */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Preferred Language</p>
                {editing === "language" ? (
                  <SaveCancelButtons field="language" />
                ) : (
                  <EditButton field="language" />
                )}
              </div>
              {editing === "language" ? (
                <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "fa")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fa">Farsi</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{member.preferredLanguage === "fa" ? "Farsi" : "English"}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Address - Editable */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">Address</p>
              {editing === "address" ? (
                <SaveCancelButtons field="address" />
              ) : (
                <EditButton field="address" />
              )}
            </div>
            {editing === "address" ? (
              <div className="space-y-2 mt-2">
                <div>
                  <Label className="text-xs">Street</Label>
                  <Input
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">State</Label>
                    <Input
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ZIP</Label>
                    <Input
                      value={address.zip}
                      onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="font-medium">
                {member.address.street}<br />
                {member.address.city}, {member.address.state} {member.address.zip}
              </p>
            )}
          </div>

          {/* Spouse - Not editable (display only if exists) */}
          {member.spouseName && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Spouse</p>
                <p className="font-medium">{member.spouseName}</p>
              </div>
            </>
          )}

          {/* Children - Not editable (display only if exists) */}
          {member.children && member.children.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Children</p>
                <div className="space-y-1">
                  {member.children.map((child) => (
                    <p key={child.id} className="font-medium">{child.name}</p>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Emergency Contact</CardTitle>
            {editing === "emergency" ? (
              <SaveCancelButtons field="emergency" />
            ) : (
              <EditButton field="emergency" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing === "emergency" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={emergency.name}
                  onChange={(e) => setEmergency({ ...emergency, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={emergency.phone}
                  onChange={(e) => setEmergency({ ...emergency, phone: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{member.emergencyContact.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{member.emergencyContact.phone}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
