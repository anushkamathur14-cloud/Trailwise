import { describe, expect, it } from "vitest";
import { analyticsEventSchema } from "@/lib/ingestion/schema";
import { redactErrorMessage, redactRecord } from "@/lib/ingestion/redact";

describe("event validation", () => {
  it("accepts a well-formed event", () => {
    const parsed = analyticsEventSchema.safeParse({
      eventName: "landing_viewed",
      anonymousId: "anon_1",
      platform: "web",
      timestamp: "2026-08-18T12:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects events without identity", () => {
    const parsed = analyticsEventSchema.safeParse({
      eventName: "landing_viewed",
      platform: "web",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unsafe event names", () => {
    const parsed = analyticsEventSchema.safeParse({
      eventName: "drop table users",
      anonymousId: "anon_1",
      platform: "web",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("redaction", () => {
  it("redacts denylisted and obvious secret fields", () => {
    const result = redactRecord({
      plan: "team",
      password: "hunter2",
      apiKey: "sk-test-1234567890",
      nested: { token: "abc" },
    });
    expect(result.plan).toBe("team");
    expect(result.password).toBe("[redacted]");
    expect(result.apiKey).toBe("[redacted]");
    expect((result.nested as { token: string }).token).toBe("[redacted]");
  });

  it("redacts API keys from error text", () => {
    const message = redactErrorMessage("upstream failed sk-abcdefghijklmnopqrstuvwxyz Authorization: Bearer abc.def");
    expect(message).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(message.toLowerCase()).not.toContain("bearer abc");
  });
});
