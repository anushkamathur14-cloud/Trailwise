"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { useState } from "react";

export default function SourcesPage() {
  const { workspace, workspaceId } = useWorkspace();
  const [status, setStatus] = useState<string | null>(null);

  async function reset() {
    setStatus("Resetting seeded data…");
    const response = await fetch("/api/demo/reset", { method: "POST" });
    const json = await response.json();
    setStatus(`Reset complete: ${json.people} people, ${json.events} events.`);
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const snippet = [
    `<script src="${origin}/tracker.js"></script>`,
    "<script>",
    '  trailwise.page("home");',
    '  trailwise.track("cta_clicked", { location: "hero" });',
    '  trailwise.identify("user_123", { plan: "trial" });',
    "</script>",
  ].join("\n");

  return (
    <div>
      <PageHeader
        title="Data sources"
        description="How this demo collects events. The browser snippet and mobile TypeScript client both call the same ingestion API."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{workspace.productName} · {workspace.platform}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Workspace id: {workspaceId}</p>
            <p>Primary goal: {workspace.primaryGoal.description}</p>
            <p>Secondary goal: {workspace.secondaryGoal.description}</p>
            <p>Do not send passwords, tokens, payment details, or health information. The ingest layer redacts obvious secrets and honors a property denylist.</p>
            <Button onClick={reset}>Reset demo data</Button>
            {status && <p className="text-muted-foreground">{status}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Browser snippet</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{snippet}</pre>
            <p className="mt-2 text-xs text-muted-foreground">Supports track, identify, page, reset, and disable. Honors Do Not Track unless you opt out.</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mobile client shape</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{`import { createMobileClient } from "@/lib/tracking/client";

const analytics = createMobileClient({ anonymousId: "anon_mobile_1" });
analytics.screen("Home");
analytics.track("session_completed", { durationSec: 60 });
analytics.identify("user_99", { goal: "sleep" });`}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
