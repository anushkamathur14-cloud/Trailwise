import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret, maskKey } from "@/lib/ai/session";
import { redactErrorMessage } from "@/lib/ingestion/redact";

describe("API key handling", () => {
  it("round-trips encryption without exposing the key in the mask", () => {
    const key = "sk-demo-super-secret-key-123456";
    const enc = encryptSecret(key);
    expect(enc).not.toContain(key);
    expect(decryptSecret(enc)).toBe(key);
    expect(maskKey(key)).not.toContain("super-secret");
  });

  it("never leaves raw keys in error strings", () => {
    const key = "sk-abcdefghijklmnopqrstuvwxyz1234";
    const redacted = redactErrorMessage(`OpenAI 401 for ${key}`);
    expect(redacted).not.toContain(key);
  });
});
