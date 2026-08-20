"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WORKSPACES } from "@/lib/workspace";

export default function HowItWorksPage() {
  const forge = WORKSPACES["web-demo"];
  const aurelia = WORKSPACES["mobile-demo"];

  return (
    <div>
      <PageHeader
        title="How it works"
        description="Trailwise is a product-analytics demo: collect events, analyze journeys and funnels, surface signals, recommend changes, then preview those changes as a mock end user."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Forge · Web Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{forge.productDescription}</p>
            <p>
              <strong>Primary goal:</strong> {forge.primaryGoal.description}
            </p>
            <p>
              <strong>Secondary goal:</strong> {forge.secondaryGoal.description}
            </p>
            <p>
              <strong>Personas:</strong>{" "}
              {forge.segments.map((s) => s.name).join(", ")}
            </p>
            <Button asChild variant="outline">
              <Link href="/overview">Open Forge workspace metrics</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aurelia · Mobile App Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{aurelia.productDescription}</p>
            <p>
              <strong>Primary goal:</strong> {aurelia.primaryGoal.description}
            </p>
            <p>
              <strong>Secondary goal:</strong> {aurelia.secondaryGoal.description}
            </p>
            <p>
              <strong>Personas:</strong>{" "}
              {aurelia.segments.map((s) => s.name).join(", ")}
            </p>
            <Button asChild variant="outline">
              <Link href="/events">See Aurelia event + SKAN map</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Demo loop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Switch workspace (Forge or Aurelia) in the sidebar.</li>
            <li>Read Overview KPIs and segment definitions — these come from seeded events.</li>
            <li>Inspect Event definitions and SKAN conversion values.</li>
            <li>Open Marketing vs Monetization funnels (each step has a conversion value).</li>
            <li>Explore Journeys: layered paths from start → end without circular Sankey links.</li>
            <li>Create a tester in Experience Studio, click through the preview (heatmap optional).</li>
            <li>Confirm events in Live activity, open the user profile, generate a recommendation, preview it.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
