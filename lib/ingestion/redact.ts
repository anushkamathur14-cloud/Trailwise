const DEFAULT_DENYLIST = [
  "password",
  "passwd",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "secret",
  "apiKey",
  "apikey",
  "ssn",
  "creditCard",
  "cardNumber",
  "cvv",
  "health",
  "diagnosis",
];

const SENSITIVE_SUBSTRINGS = [
  "password",
  "token",
  "secret",
  "authorization",
  "ssn",
  "card",
  "cvv",
  "api_key",
  "apikey",
];

export function normalizeDenylist(raw: string[] | undefined): string[] {
  const merged = [...DEFAULT_DENYLIST, ...(raw ?? [])];
  return Array.from(new Set(merged.map((item) => item.toLowerCase())));
}

export function redactRecord(
  input: Record<string, unknown> | undefined,
  denylist: string[] = DEFAULT_DENYLIST,
): Record<string, unknown> {
  if (!input) return {};
  const deny = new Set(normalizeDenylist(denylist));
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const blocked =
      deny.has(key.toLowerCase()) ||
      deny.has(lower) ||
      SENSITIVE_SUBSTRINGS.some((part) => lower.includes(part.replace(/[^a-z0-9]/g, "")));
    if (blocked) {
      output[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redactRecord(value as Record<string, unknown>, denylist);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function redactErrorMessage(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9-_]{10,}/g, "[redacted-key]")
    .replace(/Bearer\s+[A-Za-z0-9-._]+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"' \n]+/gi, "api_key=[redacted]");
}
