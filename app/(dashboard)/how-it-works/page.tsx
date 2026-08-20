"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WORKSPACES } from "@/lib/workspace";

export default function HowItWorksPage() {
  const web = WORKSPACES["web-demo"];
  const app = WORKSPACES["mobile-demo"];

  return (
    <div>
      <PageHeader
        title="How it works"
        description="Trailwise is product analytics for Aurelia — one brand across web and app — plus Tester Mode to feel the experience and compare sessions to historic behaviour."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aurelia · Web</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{web.productDescription}</p>
            <p>
              <strong>Primary goal:</strong> {web.primaryGoal.description}
            </p>
            <p>
              <strong>Secondary goal:</strong> {web.secondaryGoal.description}
            </p>
            <p className="text-muted-foreground">
              Personas: {web.segments.map((s) => s.name).join(", ")}
            </p>
            <Button asChild variant="outline">
              <Link href="/overview">Open Aurelia Web metrics</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aurelia · App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{app.productDescription}</p>
            <p>
              <strong>Primary goal:</strong> {app.primaryGoal.description}
            </p>
            <p>
              <strong>Secondary goal:</strong> {app.secondaryGoal.description}
            </p>
            <p className="text-muted-foreground">
              Personas: {app.segments.map((s) => s.name).join(", ")}
            </p>
            <Button asChild variant="outline">
              <Link href="/overview">Switch to Aurelia App in the sidebar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Suggested walkthrough</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Switch workspace (Aurelia Web or Aurelia App) in the sidebar.</li>
            <li>Read Overview TLDR, then open Tester Mode with heatmap on.</li>
            <li>Filter historic comparison by iOS or Android.</li>
            <li>Inspect Journeys (pruned late steps) and Funnels with conversion values.</li>
            <li>Preview a recommendation variant and watch Live activity.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
