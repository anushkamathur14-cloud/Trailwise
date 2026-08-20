"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDateTime } from "@/lib/utils";
import { hashPii } from "@/lib/privacy/hash";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

type LiveItem = {
  id: string;
  eventId: string;
  eventName: string;
  timestamp: string;
  platform: string;
  personId: string;
  sessionId?: string | null;
  anonymousId?: string | null;
  userId?: string | null;
  displayName?: string | null;
  isTester?: boolean;
  source?: string | null;
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
};

const TRACKING_IDEAS = [
  "Screen / page views with referrer",
  "Feature flags exposure",
  "Experiment assignment",
  "Push notification open",
  "Crash / non-fatal error",
  "Search queries (redacted)",
  "Share / invite actions",
  "Offline → online sync",
];

export default function LivePage() {
  const { workspaceId, workspace } = useWorkspace();
  const [events, setEvents] = useState<LiveItem[]>([]);
  const [selected, setSelected] = useState<LiveItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events?workspace=${workspaceId}&limit=80`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setEvents(json.events ?? []);
      });
    const source = new EventSource(`/api/live?workspace=${workspaceId}`);
    source.onmessage = (message) => {
      const payload = JSON.parse(message.data) as LiveItem & { type?: string };
      if (payload.type === "hello" || !payload.eventName) return;
      setEvents((current) => [payload, ...current].slice(0, 120));
    };
    const poll = setInterval(() => {
      fetch(`/api/events?workspace=${workspaceId}&limit=30`)
        .then((r) => r.json())
        .then((json) => {
          setEvents((current) => {
            const incoming = (json.events ?? []) as LiveItem[];
            const ids = new Set(current.map((item) => item.eventId));
            const fresh = incoming.filter((item) => !ids.has(item.eventId));
            return [...fresh, ...current].slice(0, 120);
          });
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      cancelled = true;
      source.close();
      clearInterval(poll);
    };
  }, [workspaceId]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.eventName, (counts.get(event.eventName) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name: name.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [events]);

  const lastEvent = events[0] ?? null;

  return (
    <div>
      <PageHeader
        title="Live activity"
        description={`Real-time ${workspace.productName} stream. Summary first, then the detailed event feed — no full refresh needed.`}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Last event</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {lastEvent ? (
              <>
                <div className="font-medium">{lastEvent.eventName.replace(/_/g, " ")}</div>
                <div className="text-muted-foreground">{formatDateTime(lastEvent.timestamp)}</div>
                <div className="mt-1 text-xs">{hashPii(lastEvent.userId || lastEvent.anonymousId)} · {lastEvent.platform}</div>
              </>
            ) : (
              <p className="text-muted-foreground">Waiting for events…</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stream volume</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="text-2xl font-semibold">{events.length}</div>
            <div className="text-muted-foreground">events in the live buffer</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Also worth tracking</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {TRACKING_IDEAS.slice(0, 5).map((idea) => (
                <li key={idea}>· {idea}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>Activity by event</CardTitle></CardHeader>
        <CardContent className="h-64">
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <RTooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Detailed stream</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {events.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Waiting for events…</p>
            ) : (
              events.map((event) => (
                <button
                  key={event.eventId}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/60"
                  onClick={() => setSelected(event)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{event.eventName.replace(/_/g, " ")}</span>
                      {event.isTester && <Badge>tester</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {hashPii(event.userId || event.anonymousId)} · session {event.sessionId?.slice(0, 8)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{formatDateTime(event.timestamp)}</div>
                    <div>
                      {String(
                        (event.context as { screenName?: string; pageTitle?: string }).screenName ||
                          (event.context as { pageTitle?: string }).pageTitle ||
                          event.platform,
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold">Event payload</h3>
            {selected ? (
              <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(
                  {
                    ...selected,
                    anonymousId: hashPii(selected.anonymousId),
                    userId: selected.userId ? hashPii(selected.userId) : null,
                    displayName: selected.displayName ? hashPii(selected.displayName) : null,
                  },
                  null,
                  2,
                )}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Select an event to inspect its payload (PII hashed in the viewer).</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
