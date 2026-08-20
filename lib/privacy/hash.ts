/** Sync display hash safe for client and server. Not for security-critical storage. */
export function hashPii(value: string | null | undefined, salt = "trailwise-demo"): string {
  if (!value) return "—";
  const input = `${salt}:${value}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return hashPii(email);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}•••@${domain}`;
}

export function displayPersonLabel(input: {
  displayName?: string | null;
  email?: string | null;
  userId?: string | null;
  anonymousId?: string | null;
}): string {
  if (input.userId) return hashPii(input.userId);
  if (input.anonymousId) return hashPii(input.anonymousId);
  if (input.displayName) return hashPii(input.displayName);
  return "unknown";
}
