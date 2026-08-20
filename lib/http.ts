import { NextResponse } from "next/server";
import { isWorkspaceId, type WorkspaceId } from "@/lib/workspace";

export function json<T>(data: T, init?: number | ResponseInit) {
  const options = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, options);
}

export function workspaceFrom(request: Request): WorkspaceId {
  const url = new URL(request.url);
  const query = url.searchParams.get("workspace");
  if (isWorkspaceId(query)) return query;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/trailwise_workspace=([^;]+)/);
  if (match && isWorkspaceId(decodeURIComponent(match[1]))) return match[1] as WorkspaceId;
  return "web-demo";
}

export function rangeFrom(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const ecosystem = url.searchParams.get("ecosystem");
  const deviceParam = url.searchParams.get("device") || undefined;
  const device =
    ecosystem === "ios" || ecosystem === "android" ? ecosystem : deviceParam;
  return {
    from: from ? new Date(from) : new Date("2026-07-21T00:00:00.000Z"),
    to: to ? new Date(to) : new Date("2026-08-18T23:59:59.000Z"),
    channel: url.searchParams.get("channel") || undefined,
    device,
    segment: url.searchParams.get("segment") || undefined,
  };
}
