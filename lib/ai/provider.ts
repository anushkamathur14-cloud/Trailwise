import { getActiveAiKey, rateLimit, safeAiError } from "@/lib/ai/session";
import { redactErrorMessage } from "@/lib/ingestion/redact";

export type AiEnhanceInput = {
  kind: "product" | "user";
  title: string;
  evidence: string;
  experiment?: string;
};

export async function enhanceRecommendation(
  cookieHeader: string | null,
  input: AiEnhanceInput,
): Promise<{ text: string; source: "ai" | "template" }> {
  const template = templateCopy(input);
  const key = getActiveAiKey(cookieHeader);
  if (!key) return { text: template, source: "template" };
  if (!rateLimit("ai-enhance")) return { text: template, source: "template" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const base = process.env.AI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 280,
        messages: [
          {
            role: "system",
            content:
              "You write concise product-analytics explanations. Never claim causation. Never mention API keys. Keep it under 90 words.",
          },
          {
            role: "user",
            content: `Title: ${input.title}\nEvidence: ${input.evidence}\nExperiment: ${input.experiment ?? "n/a"}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { text: template, source: "template" };
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { text: template, source: "template" };
    if (text.includes(key)) return { text: template, source: "template" };
    return { text: redactErrorMessage(text), source: "ai" };
  } catch (error) {
    safeAiError(error);
    return { text: template, source: "template" };
  } finally {
    clearTimeout(timer);
  }
}

export function templateCopy(input: AiEnhanceInput): string {
  if (input.kind === "user") {
    return `${input.title}. ${input.evidence} This is a deterministic next-best-action, not a causal prediction. Preview the recommended journey to see what would change for this person.`;
  }
  return `${input.title}. ${input.evidence} Suggested next step: ${input.experiment ?? "run a holdout experiment"} before rolling the change out. Correlation is not causation.`;
}
