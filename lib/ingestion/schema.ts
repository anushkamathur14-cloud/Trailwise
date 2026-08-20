import { z } from "zod";

const contextSchema = z
  .object({
    pageUrl: z.string().max(2000).optional(),
    pageTitle: z.string().max(500).optional(),
    referrer: z.string().max(2000).optional(),
    deviceType: z.string().max(80).optional(),
    browser: z.string().max(80).optional(),
    operatingSystem: z.string().max(80).optional(),
    appVersion: z.string().max(40).optional(),
    screenName: z.string().max(120).optional(),
    country: z.string().max(8).optional(),
  })
  .strict()
  .optional();

export const analyticsEventSchema = z
  .object({
    eventId: z.string().min(8).max(80).optional(),
    eventName: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z][a-zA-Z0-9_./:-]*$/, "Invalid event name"),
    timestamp: z.string().datetime({ offset: true }).optional(),
    anonymousId: z.string().min(1).max(120).optional(),
    userId: z.string().min(1).max(120).optional(),
    sessionId: z.string().min(1).max(120).optional(),
    platform: z.enum(["web", "mobile"]),
    source: z.string().max(80).optional(),
    properties: z.record(z.unknown()).optional(),
    context: contextSchema,
    workspaceId: z.enum(["web-demo", "mobile-demo"]).optional(),
  })
  .refine((value) => Boolean(value.anonymousId || value.userId), {
    message: "Either anonymousId or userId is required",
  });

export const batchEventSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100),
  workspaceId: z.enum(["web-demo", "mobile-demo"]).optional(),
});

export const identifySchema = z.object({
  workspaceId: z.enum(["web-demo", "mobile-demo"]).optional(),
  anonymousId: z.string().min(1).max(120).optional(),
  userId: z.string().min(1).max(120),
  traits: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  platform: z.enum(["web", "mobile"]).optional(),
});

export const userPropertiesSchema = z.object({
  workspaceId: z.enum(["web-demo", "mobile-demo"]).optional(),
  userId: z.string().min(1).max(120).optional(),
  anonymousId: z.string().min(1).max(120).optional(),
  properties: z.record(z.unknown()),
});

export type ValidatedEvent = z.infer<typeof analyticsEventSchema>;
