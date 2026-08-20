export type TrailwiseClient = {
  track: (eventName: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  disable: () => void;
};

export function createWebClient(options: {
  workspaceId: "web-demo" | "mobile-demo";
  anonymousId?: string;
  userId?: string;
  sessionId?: string;
  disabled?: boolean;
}): TrailwiseClient {
  let anonymousId = options.anonymousId;
  let userId = options.userId;
  let disabled = Boolean(options.disabled);
  const sessionId = options.sessionId;
  const post = (path: string, body: unknown) => {
    if (disabled) return;
    void fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };
  return {
    track(eventName, properties) {
      post("/api/events", {
        eventName,
        anonymousId: userId ? undefined : anonymousId,
        userId,
        sessionId,
        platform: options.workspaceId === "mobile-demo" ? "mobile" : "web",
        source: "studio",
        workspaceId: options.workspaceId,
        properties,
        context:
          options.workspaceId === "web-demo"
            ? { pageTitle: eventName, pageUrl: `https://aurelia.example/${eventName}` }
            : { screenName: eventName, appVersion: "3.4.1" },
      });
    },
    identify(nextUserId, traits) {
      userId = nextUserId;
      post("/api/identify", {
        workspaceId: options.workspaceId,
        userId: nextUserId,
        anonymousId,
        traits,
        platform: options.workspaceId === "mobile-demo" ? "mobile" : "web",
      });
    },
    page(name, properties) {
      this.track("page_viewed", { page: name, ...properties });
    },
    reset() {
      userId = undefined;
      anonymousId = `anon_${Math.random().toString(36).slice(2)}`;
    },
    disable() {
      disabled = true;
    },
  };
}

export type MobileAnalyticsClient = {
  screen: (name: string, properties?: Record<string, unknown>) => void;
  track: (eventName: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
};

export function createMobileClient(options: {
  anonymousId?: string;
  userId?: string;
  sessionId?: string;
}): MobileAnalyticsClient {
  const inner = createWebClient({ ...options, workspaceId: "mobile-demo" });
  return {
    screen(name, properties) {
      inner.track("screen_viewed", { screen: name, ...properties });
    },
    track: inner.track,
    identify: inner.identify,
    reset: inner.reset,
  };
}
