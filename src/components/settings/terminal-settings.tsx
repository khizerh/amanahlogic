"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wifi, WifiOff, Plus, Trash2, CreditCard } from "lucide-react";
import { Organization } from "@/lib/types";
import { toast } from "sonner";

interface TerminalReader {
  id: string;
  label: string;
  status: string;
  deviceType: string;
  serialNumber: string | null;
  ipAddress: string | null;
}

interface TerminalSettingsProps {
  organization: Organization;
  onOrganizationUpdate: (org: Organization) => void;
}

export function TerminalSettings({ organization, onOrganizationUpdate }: TerminalSettingsProps) {
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [loadingReaders, setLoadingReaders] = useState(false);
  const [settingUpLocation, setSettingUpLocation] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registrationCode, setRegistrationCode] = useState("");
  const [readerLabel, setReaderLabel] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const isConfigured = !!organization.terminalLocationId;

  const loadReaders = useCallback(async () => {
    if (!isConfigured) return;
    setLoadingReaders(true);
    try {
      const res = await fetch("/api/stripe/terminal/readers");
      const data = await res.json();
      if (data.readers) setReaders(data.readers);
    } catch {
      toast.error("Failed to load readers");
    } finally {
      setLoadingReaders(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    loadReaders();
  }, [loadReaders]);

  const handleSetupLocation = async () => {
    setSettingUpLocation(true);
    try {
      const res = await fetch("/api/stripe/terminal/location", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      onOrganizationUpdate({
        ...organization,
        terminalLocationId: data.locationId,
      });
      toast.success("Terminal location set up");
      // Load readers now that location is configured
      loadReaders();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to set up location";
      toast.error(msg);
    } finally {
      setSettingUpLocation(false);
    }
  };

  const handleRegisterReader = async () => {
    if (!registrationCode.trim()) {
      toast.error("Enter the registration code from the reader");
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch("/api/stripe/terminal/readers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationCode: registrationCode.trim(),
          label: readerLabel.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Reader "${data.reader.label}" registered`);
      setRegistrationCode("");
      setReaderLabel("");
      setShowRegisterForm(false);
      loadReaders();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to register reader";
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteReader = async (readerId: string, label: string) => {
    if (!confirm(`Delete reader "${label}"?`)) return;

    try {
      const res = await fetch("/api/stripe/terminal/readers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Reader deleted");
      loadReaders();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete reader";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Setup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Terminal
          </CardTitle>
          <CardDescription>
            Accept in-person card payments with a Stripe Terminal reader
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConfigured ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Terminal is not set up yet. Click below to create a Terminal location
                  for your organization. This is required before you can register readers.
                </AlertDescription>
              </Alert>
              <Button onClick={handleSetupLocation} disabled={settingUpLocation}>
                {settingUpLocation ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up...</>
                ) : (
                  "Set Up Terminal"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div>
                <p className="font-medium">Terminal Configured</p>
                <p className="text-sm text-muted-foreground">
                  Ready to register readers and accept in-person payments
                </p>
              </div>
              <code className="ml-auto text-xs bg-muted px-2 py-1 rounded">
                {organization.terminalLocationId}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Readers Card */}
      {isConfigured && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Readers</CardTitle>
                <CardDescription>
                  Manage your registered Stripe Terminal readers
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowRegisterForm(!showRegisterForm)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Reader
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Registration Form */}
              {showRegisterForm && (
                <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                  <p className="text-sm font-medium">Register a new reader</p>
                  <p className="text-sm text-muted-foreground">
                    Turn on your M2 reader and enter the registration code shown on screen.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="regCode">Registration Code</Label>
                      <Input
                        id="regCode"
                        placeholder="e.g. sepia-cyan-puce"
                        value={registrationCode}
                        onChange={(e) => setRegistrationCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="readerLabel">Label (optional)</Label>
                      <Input
                        id="readerLabel"
                        placeholder="e.g. Front Desk Reader"
                        value={readerLabel}
                        onChange={(e) => setReaderLabel(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleRegisterReader} disabled={registering} size="sm">
                      {registering ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Registering...</>
                      ) : (
                        "Register"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowRegisterForm(false);
                        setRegistrationCode("");
                        setReaderLabel("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Readers List */}
              {loadingReaders ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading readers...
                </div>
              ) : readers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No readers registered</p>
                  <p className="text-sm">Add a reader to start accepting in-person payments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {readers.map((reader) => (
                    <div
                      key={reader.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {reader.status === "online" ? (
                          <Wifi className="h-5 w-5 text-green-600" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{reader.label || "Reader"}</p>
                          <p className="text-sm text-muted-foreground">
                            {reader.deviceType}
                            {reader.serialNumber && ` · ${reader.serialNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={reader.status === "online" ? "default" : "secondary"}
                        >
                          {reader.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReader(reader.id, reader.label || "Reader")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
