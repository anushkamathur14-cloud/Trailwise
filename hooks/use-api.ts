"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";

export function useApi<T>(path: string, extraKey = "") {
  const { workspaceId } = useWorkspace();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = path.includes("?") ? `${path}&workspace=${workspaceId}` : `${path}?workspace=${workspaceId}`;
    fetch(url)
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          const detail = typeof json?.detail === "string" ? json.detail : typeof json?.error === "string" ? json.error : "Request failed";
          throw new Error(detail);
        }
        return json as T;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setData(null);
          setError(err.message || "Request failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, workspaceId, extraKey]);

  return { data, error, loading, workspaceId };
}
