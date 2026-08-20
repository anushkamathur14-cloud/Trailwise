import type { WorkspaceId } from "@/lib/workspace";
import type { PreviewId } from "@/lib/studio/variants";

export type StudioMode = "original" | "recommended";

export type StudioState = {
  workspaceId: WorkspaceId;
  mode: StudioMode;
  /** null when mode is original */
  variantId: PreviewId | null;
  testerSessionId: string | null;
  deviceOrPlatform: string;
};

export const WEB_VARIANTS: PreviewId[] = [
  "earlier-wearable-help",
  "friend-invite-prompt",
  "error-recovery",
  "simplified-signup",
];

export const APP_VARIANTS: PreviewId[] = ["delayed-paywall", "first-session-nudge", "permission-fallback"];

export function variantsForWorkspace(workspaceId: WorkspaceId): PreviewId[] {
  return workspaceId === "web-demo" ? WEB_VARIANTS : APP_VARIANTS;
}

export function defaultVariantFor(workspaceId: WorkspaceId): PreviewId {
  return workspaceId === "web-demo" ? "earlier-wearable-help" : "delayed-paywall";
}

export function isValidVariant(workspaceId: WorkspaceId, variantId: string | null | undefined): variantId is PreviewId {
  if (!variantId || variantId === "original") return false;
  return variantsForWorkspace(workspaceId).includes(variantId as PreviewId);
}

/** Build authoritative studio state. Original always forces variantId null. */
export function resolveStudioState(input: {
  workspaceId: WorkspaceId;
  mode?: StudioMode | string | null;
  variantId?: string | null;
  testerSessionId?: string | null;
  deviceOrPlatform?: string;
  urlPreview?: string | null;
}): StudioState {
  const workspaceId = input.workspaceId;
  const urlPreview = input.urlPreview ?? null;
  let mode: StudioMode = input.mode === "original" ? "original" : "recommended";
  let variantId: PreviewId | null = null;

  const candidate = input.variantId ?? (urlPreview && urlPreview !== "original" ? urlPreview : null);

  if (mode === "original") {
    variantId = null;
  } else if (isValidVariant(workspaceId, candidate)) {
    variantId = candidate;
  } else if (isValidVariant(workspaceId, urlPreview)) {
    variantId = urlPreview;
    mode = "recommended";
  } else {
    // Invalid / cross-workspace preview → reset to workspace default recommended
    variantId = defaultVariantFor(workspaceId);
    mode = "recommended";
  }

  return {
    workspaceId,
    mode,
    variantId: mode === "original" ? null : variantId,
    testerSessionId: input.testerSessionId ?? null,
    deviceOrPlatform: input.deviceOrPlatform ?? "",
  };
}

export function switchWorkspace(state: StudioState, workspaceId: WorkspaceId): StudioState {
  return resolveStudioState({
    workspaceId,
    mode: "recommended",
    variantId: defaultVariantFor(workspaceId),
    testerSessionId: null,
    deviceOrPlatform: "",
  });
}

export function setMode(state: StudioState, mode: StudioMode): StudioState {
  if (mode === "original") {
    return { ...state, mode: "original", variantId: null };
  }
  return {
    ...state,
    mode: "recommended",
    variantId: state.variantId && isValidVariant(state.workspaceId, state.variantId)
      ? state.variantId
      : defaultVariantFor(state.workspaceId),
  };
}

export function setVariant(state: StudioState, variantId: PreviewId | "original"): StudioState {
  if (variantId === "original") {
    return { ...state, mode: "original", variantId: null };
  }
  if (!isValidVariant(state.workspaceId, variantId)) {
    return resolveStudioState({ ...state, mode: "recommended", variantId: defaultVariantFor(state.workspaceId) });
  }
  return { ...state, mode: "recommended", variantId };
}

/** Effective preview id for rendering */
export function activePreviewId(state: StudioState): PreviewId {
  if (state.mode === "original" || !state.variantId) return "original";
  return state.variantId;
}
