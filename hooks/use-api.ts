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
    const url = path.includes("?") ? `${path}&workspace=${workspaceId}` : `${path}?workspace=${workspaceId}`;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        return response.json() as Promise<T>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
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
