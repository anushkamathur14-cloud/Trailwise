"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace-provider";
import { eventDefinitionsFor, SKAN_POLICY, skanRows } from "@/lib/events/catalog";

export default function EventsPage() {
  const { workspaceId, workspace } = useWorkspace();
  const events = eventDefinitionsFor(workspaceId);
  const skan = skanRows(workspaceId);

  return (
    <div>
      <PageHeader
        title="Event definitions"
        description={`Canonical event dictionary for ${workspace.productName}, including categories and Apple SKAN conversion values where applicable.`}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{SKAN_POLICY.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{SKAN_POLICY.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {SKAN_POLICY.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Conversion value</th>
                  <th className="py-2">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {skan.map((row) => (
                  <tr key={row.name} className="border-t">
                    <td className="py-2 pr-4 font-medium">{row.label}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">CV {row.skanConversionValue}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {events.map((event) => (
          <Card key={event.name}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">{event.label}</CardTitle>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{event.name}</div>
              </div>
              <Badge variant="outline">{event.category}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{event.description}</p>
              <div className="text-xs text-muted-foreground">
                Properties: {event.properties.length ? event.properties.join(", ") : "none required"}
              </div>
              {event.skanConversionValue !== undefined && (
                <Badge variant="secondary">SKAN CV {event.skanConversionValue}</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
