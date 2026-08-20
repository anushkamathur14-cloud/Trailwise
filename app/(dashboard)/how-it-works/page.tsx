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
        description="Trailwise is product analytics for Aurelia — web and app workspaces with Experience Studio to compare original versus recommended journeys against historic behaviour."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aurelia · Web</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{web.productDescription}</p>
            <p>
              <strong>Activation:</strong> {web.primaryGoal.description}
            </p>
            <p>
              <strong>Conversion:</strong> {web.secondaryGoal.description}
            </p>
            <p className="text-muted-foreground">Device types: desktop, tablet, mobile web · Personas: {web.segments.map((s) => s.name).join(", ")}</p>
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
              <strong>Activation:</strong> {app.primaryGoal.description}
            </p>
            <p>
              <strong>Conversion:</strong> {app.secondaryGoal.description}
            </p>
            <p className="text-muted-foreground">Platforms: iOS, Android · Personas: {app.segments.map((s) => s.name).join(", ")}</p>
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
            <li>Read the Trailwise insight on Overview, then open Preview change.</li>
            <li>In Experience Studio, compare Original vs Recommended — start a tester session to emit events.</li>
            <li>Filter Web by device type (desktop / tablet / mobile web) or App by iOS / Android.</li>
            <li>Inspect Journeys and Funnels, then confirm Live Activity and the tester profile.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
