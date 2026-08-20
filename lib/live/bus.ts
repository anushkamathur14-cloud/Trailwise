import { EventEmitter } from "events";

export type LiveEvent = {
  workspaceId: string;
  id: string;
  eventId: string;
  eventName: string;
  timestamp: string;
  platform: string;
  personId: string;
  anonymousId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  displayName?: string | null;
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
};

class LiveBus extends EventEmitter {
  publish(event: LiveEvent) {
    this.emit("event", event);
  }
}

export const liveBus = new LiveBus();
liveBus.setMaxListeners(200);
