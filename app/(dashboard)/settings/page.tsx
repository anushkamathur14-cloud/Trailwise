"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/workspace-provider";

export default function SettingsPage() {
  const { workspaceId } = useWorkspace();
  const [retentionDays, setRetentionDays] = useState(90);
  const [collectionEnabled, setCollectionEnabled] = useState(true);
  const [denylist, setDenylist] = useState("password, token, secret, ssn, creditCard");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiSource, setAiSource] = useState("none");
  const [aiKey, setAiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/settings?workspace=${workspaceId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.settings) {
          setRetentionDays(json.settings.retentionDays);
          setCollectionEnabled(json.settings.collectionEnabled);
          setDenylist((json.settings.denylist ?? []).join(", "));
        }
      });
    fetch("/api/ai")
      .then((r) => r.json())
      .then((json) => {
        setAiEnabled(json.enabled);
        setAiSource(json.source);
      });
  }, [workspaceId]);

  async function saveSettings() {
    await fetch(`/api/settings?workspace=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retentionDays,
        collectionEnabled,
        denylist: denylist.split(",").map((item) => item.trim()).filter(Boolean),
      }),
    });
    setMessage("Privacy settings saved.");
  }

  async function saveKey() {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: aiKey }),
    });
    const json = await response.json();
    setAiKey("");
    setAiEnabled(json.enabled);
    setAiSource(json.source ?? "session");
    setMessage(json.error ?? "API key stored in an httpOnly cookie. It is never rendered back to the page.");
  }

  async function forget() {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forget: true }),
    });
    const json = await response.json();
    setAiEnabled(json.enabled);
    setAiSource(json.source);
    setMessage("Session key forgotten.");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Demo-grade privacy controls and optional AI enhancement. Keys never appear in client bundles, event payloads, or error messages."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Privacy and governance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Automatic collection</Label>
              <Switch checked={collectionEnabled} onCheckedChange={setCollectionEnabled} />
            </div>
            <div>
              <Label>Retention (days)</Label>
              <Input type="number" className="mt-1" value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} />
            </div>
            <div>
              <Label>Property denylist</Label>
              <Input className="mt-1" value={denylist} onChange={(e) => setDenylist(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Trailwise is a demo. Do not collect passwords, tokens, payment details, health details, or other sensitive information. Profiles include a consent state. Use Delete user data on a profile to erase a person.
            </p>
            <Button onClick={saveSettings}>Save privacy settings</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Optional AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Enhancement is {aiEnabled ? "on" : "off"} ({aiSource}). Deterministic recommendations keep working without a key.
            </p>
            <Input type="password" autoComplete="off" placeholder="Paste provider key (stored server-side only)" value={aiKey} onChange={(e) => setAiKey(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={saveKey}>Save key</Button>
              <Button variant="outline" onClick={forget}>
                Forget key
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Prefer AI_API_KEY in the environment for hosted deploys. UI-entered keys are encrypted into an httpOnly cookie using SESSION_SECRET.
            </p>
          </CardContent>
        </Card>
      </div>
      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
