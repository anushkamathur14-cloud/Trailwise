import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { redactErrorMessage } from "@/lib/ingestion/redact";

const COOKIE = "trailwise_ai";

function secret(): Buffer {
  const raw = process.env.SESSION_SECRET || "trailwise-dev-secret";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", secret(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function aiCookieName() {
  return COOKIE;
}

export function maskKey(key: string): string {
  if (key.length < 8) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function keyFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(COOKIE.length + 1));
  return decryptSecret(value);
}

export function resolveAiKey(cookieHeader: string | null): { enabled: boolean; source: "env" | "session" | "none" } {
  if (process.env.AI_API_KEY) return { enabled: true, source: "env" };
  if (keyFromCookieHeader(cookieHeader)) return { enabled: true, source: "session" };
  return { enabled: false, source: "none" };
}

export function getActiveAiKey(cookieHeader: string | null): string | null {
  return process.env.AI_API_KEY || keyFromCookieHeader(cookieHeader);
}

const hits = new Map<string, number[]>();

export function rateLimit(id: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(id, recent);
    return false;
  }
  recent.push(now);
  hits.set(id, recent);
  return true;
}

export function safeAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : "AI request failed";
  return redactErrorMessage(message);
}

export function containsKey(haystack: string, key: string): boolean {
  if (!key) return false;
  const a = Buffer.from(haystack);
  const b = Buffer.from(key);
  if (a.length !== b.length) return haystack.includes(key);
  try {
    return timingSafeEqual(a, b);
  } catch {
    return haystack.includes(key);
  }
}
