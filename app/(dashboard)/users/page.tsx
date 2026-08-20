"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/utils";

type PeopleResponse = {
  people: Array<{
    id: string;
    displayName: string | null;
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
  const [q, setQ] = useState("");
  const { data, loading } = useApi<PeopleResponse>(`/api/users?q=${encodeURIComponent(q)}`);

  return (
    <div>
      <PageHeader title="Users" description="Search identified and anonymous profiles. Open a person to see identity merge, timeline, and the current recommendation." />
      <Input placeholder="Search name, email, user id, or anonymous id" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-lg" />
      <Card>
        <CardContent className="p-0">
          {loading || !data ? (
            <p className="p-6 text-sm text-muted-foreground">Loading profiles…</p>
          ) : data.people.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No people match that search.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Person</th>
                  <th>Segment</th>
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
                        {person.displayName || person.userId || person.anonymousId}
                      </Link>
                      <div className="text-xs text-muted-foreground">{person.userId ? "identified" : "anonymous"}</div>
                    </td>
                    <td>{person.segment}</td>
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
