"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDateTime } from "@/lib/utils";

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
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
};

export default function LivePage() {
  const { workspaceId } = useWorkspace();
  const [events, setEvents] = useState<LiveItem[]>([]);
  const [selected, setSelected] = useState<LiveItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events?workspace=${workspaceId}&limit=40`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setEvents(json.events ?? []);
      });
    const source = new EventSource(`/api/live?workspace=${workspaceId}`);
    source.onmessage = (message) => {
      const payload = JSON.parse(message.data) as LiveItem & { type?: string };
      if (payload.type === "hello" || !payload.eventName) return;
      setEvents((current) => [payload, ...current].slice(0, 100));
    };
    const poll = setInterval(() => {
      fetch(`/api/events?workspace=${workspaceId}&limit=20`)
        .then((r) => r.json())
        .then((json) => {
          setEvents((current) => {
            const incoming = (json.events ?? []) as LiveItem[];
            const ids = new Set(current.map((item) => item.eventId));
            const fresh = incoming.filter((item) => !ids.has(item.eventId));
            return [...fresh, ...current].slice(0, 100);
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

  return (
    <div>
      <PageHeader
        title="Live activity"
        description="New events appear here without a full refresh. Tester Mode events are tagged so you can follow a demo user through the stream."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                      {event.displayName || event.userId || event.anonymousId} · session {event.sessionId?.slice(0, 8)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{formatDateTime(event.timestamp)}</div>
                    <div>{String((event.context as { screenName?: string; pageTitle?: string }).screenName || (event.context as { pageTitle?: string }).pageTitle || event.platform)}</div>
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
              <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(selected, null, 2)}</pre>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Select an event to inspect the full payload.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
