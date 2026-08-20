"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeviceFilter } from "@/components/device-filter";
import { useApi } from "@/hooks/use-api";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDateTime } from "@/lib/utils";
import { hashPii, maskEmail } from "@/lib/privacy/hash";

type PeopleResponse = {
  people: Array<{
    id: string;
    displayName: string | null;
    email?: string | null;
    anonymousId: string | null;
    userId: string | null;
    segment: string | null;
    acquisitionChannel: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    activated: boolean;
    converted: boolean;
    isTester: boolean;
    traits: Record<string, unknown>;
  }>;
};

export default function UsersPage() {
  const { workspace, workspaceId } = useWorkspace();
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("");
  const [device, setDevice] = useState("");
  const qs = [`q=${encodeURIComponent(q)}`, segment && `segment=${segment}`, device && `device=${device}`]
    .filter(Boolean)
    .join("&");
  const { data, loading, error } = useApi<PeopleResponse>(`/api/users?${qs}`, qs);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Search profiles by hashed identity. Filter by persona. Display names and emails are hashed/masked — raw PII is not shown in the list."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search hashed id / email fragment"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-lg"
        />
        <select className="h-9 rounded-md border px-2 text-sm" value={segment} onChange={(e) => setSegment(e.target.value)}>
          <option value="">All personas</option>
          {workspace.segments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <DeviceFilter workspaceId={workspaceId} value={device} onChange={setDevice} />
      </div>
      {segment && (
        <p className="mb-3 text-sm text-muted-foreground">
          {workspace.segments.find((s) => s.id === segment)?.description}
        </p>
      )}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading profiles…</p>
          ) : error ? (
            <p className="p-6 text-sm text-rose-700">{error}</p>
          ) : !data || data.people.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No people match that filter.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Person (hashed)</th>
                  <th>Persona</th>
                  <th>Source</th>
                  <th>State</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((person) => (
                  <tr key={person.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/users/${person.id}`} className="font-medium text-primary hover:underline">
                        {hashPii(person.userId || person.anonymousId || person.displayName)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {person.userId ? "identified" : "anonymous"}
                        {person.email ? ` · ${maskEmail(person.email)}` : ""}
                      </div>
                    </td>
                    <td>{workspace.segments.find((s) => s.id === person.segment)?.name ?? person.segment}</td>
                    <td>{person.acquisitionChannel}</td>
                    <td className="space-x-1">
                      {person.activated && <Badge variant="success">activated</Badge>}
                      {person.converted && <Badge>converted</Badge>}
                      {person.isTester && <Badge variant="warning">tester</Badge>}
                    </td>
                    <td className="text-xs text-muted-foreground">{formatDateTime(person.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
