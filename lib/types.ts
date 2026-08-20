export type Platform = "web" | "mobile";

export type AnalyticsContext = {
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
  appVersion?: string;
  screenName?: string;
  country?: string;
};

export type AnalyticsEventInput = {
  eventId?: string;
  eventName: string;
  timestamp?: string;
  anonymousId?: string;
  userId?: string;
  sessionId?: string;
  platform: Platform;
  source?: string;
  properties?: Record<string, unknown>;
  context?: AnalyticsContext;
  workspaceId?: string;
};

export type DateRange = {
  from: Date;
  to: Date;
};

export type SegmentFilter = {
  channel?: string;
  device?: string;
  segment?: string;
  country?: string;
};
