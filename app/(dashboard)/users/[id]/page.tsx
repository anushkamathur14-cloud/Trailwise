"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";

type Profile = {
  person: {
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
    consentState: string;
    traits: Record<string, unknown>;
    aliases: Array<{ previousId: string; kind: string; mergedAt: string }>;
  };
  recommendation: { title: string; experience: string; why: string; previewId: string; confidence: string };
  sessions: Array<{ startedAt: string; events: Array<{ eventName: string; timestamp: string; eventId: string }> }>;
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading } = useApi<Profile>(`/api/users/${id}`, id);

  if (loading || !data) return <p className="text-sm text-muted-foreground">Loading profile…</p>;

  async function remove() {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    window.location.href = "/users";
  }

  return (
    <div>
      <PageHeader
        title={data.person.displayName || data.person.userId || data.person.anonymousId || "Person"}
        description="Identity, consent, computed traits, chronological timeline, and the next-best-action for this profile."
        actions={
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/studio?personId=${id}&preview=${data.recommendation.previewId}`}>Preview recommended journey</Link>
            </Button>
            <Button variant="destructive" onClick={remove}>
              Delete user data
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Anonymous ID: {data.person.anonymousId ?? "—"}</div>
            <div>User ID: {data.person.userId ?? "still anonymous"}</div>
            <div>Segment: {data.person.segment}</div>
            <div>Source: {data.person.acquisitionChannel}</div>
            <div>Consent: {data.person.consentState}</div>
            <div>First seen: {formatDateTime(data.person.firstSeenAt)}</div>
            <div>Last seen: {formatDateTime(data.person.lastSeenAt)}</div>
            <div className="space-x-1">
              {data.person.activated && <Badge variant="success">activated</Badge>}
              {data.person.converted && <Badge>converted</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Identity merge</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.person.aliases.length === 0 ? (
              <p className="text-muted-foreground">No merge recorded. Identify this visitor in Tester Mode to attach an anonymous id to a user id.</p>
            ) : (
              <ul className="space-y-2">
                {data.person.aliases.map((alias) => (
                  <li key={alias.previousId} className="rounded-md bg-muted p-2">
                    {alias.previousId} → {data.person.userId} ({alias.kind}) on {formatDateTime(alias.mergedAt)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current recommendation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-medium">{data.recommendation.title}</div>
            <p className="mt-2 text-muted-foreground">{data.recommendation.why}</p>
            <p className="mt-2">{data.recommendation.experience}</p>
            <Badge className="mt-3">{data.recommendation.confidence} confidence</Badge>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Traits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {Object.entries(data.person.traits).map(([key, value]) => (
            <div key={key} className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">{key}</div>
              <div>{String(value)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {data.sessions.map((session, index) => (
            <div key={index}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Session {index + 1} · {formatDateTime(session.startedAt)}
              </div>
              <ol className="mt-2 space-y-1">
                {session.events.map((event) => (
                  <li key={event.eventId} className="text-sm">
                    <span className="text-muted-foreground">{formatDateTime(event.timestamp)}</span> · {event.eventName.replace(/_/g, " ")}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
