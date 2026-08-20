import { json } from "@/lib/http";
import { aiCookieName, encryptSecret, resolveAiKey } from "@/lib/ai/session";

export async function GET(request: Request) {
  const status = resolveAiKey(request.headers.get("cookie"));
  return json({ enabled: status.enabled, source: status.source });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { key?: string; forget?: boolean } | null;
  if (body?.forget) {
    const response = json({ enabled: Boolean(process.env.AI_API_KEY), source: process.env.AI_API_KEY ? "env" : "none" });
    response.cookies.set(aiCookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  }
  const key = body?.key?.trim();
  if (!key || key.length < 12) return json({ error: "Provide a valid API key" }, 400);
  const response = json({ enabled: true, source: "session" });
  response.cookies.set(aiCookieName(), encryptSecret(key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
