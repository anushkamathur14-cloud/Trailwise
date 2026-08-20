"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { WORKSPACES, type WorkspaceId } from "@/lib/workspace";

type Ctx = {
  workspaceId: WorkspaceId;
  setWorkspaceId: (id: WorkspaceId) => void;
  workspace: (typeof WORKSPACES)[WorkspaceId];
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setId] = useState<WorkspaceId>("web-demo");

  useEffect(() => {
    const match = document.cookie.match(/trailwise_workspace=([^;]+)/);
    if (match?.[1] === "mobile-demo") setId("mobile-demo");
  }, []);

  const setWorkspaceId = (id: WorkspaceId) => {
    setId(id);
    document.cookie = `trailwise_workspace=${id}; path=/; max-age=31536000`;
  };

  const value = useMemo(
    () => ({ workspaceId, setWorkspaceId, workspace: WORKSPACES[workspaceId] }),
    [workspaceId],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
