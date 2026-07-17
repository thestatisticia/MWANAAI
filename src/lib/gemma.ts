import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

function readApiKey(): string | undefined {
  const raw =
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const key = raw?.trim();
  return key || undefined;
}

export function getGemmaModel(generationConfig?: {
  maxOutputTokens?: number;
  temperature?: number;
}) {
  const apiKey = readApiKey();

  if (!apiKey) {
    const onVercel = Boolean(process.env.VERCEL);
    throw new Error(
      onVercel
        ? "Missing GOOGLE_API_KEY on Vercel. In Project Settings → Environment Variables, add GOOGLE_API_KEY for Production, then Redeploy."
        : "Missing GOOGLE_API_KEY. Add it to .env.local (Google AI Studio key).",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      maxOutputTokens: generationConfig?.maxOutputTokens ?? 1024,
      temperature: generationConfig?.temperature ?? 0.4,
    },
  });
}

export async function generateGemmaReply(params: {
  systemPrompt: string;
  userMessage: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  maxOutputTokens?: number;
  temperature?: number;
  /** One-shot call — faster than chat history for tools like summarize */
  fast?: boolean;
}): Promise<string> {
  const model = getGemmaModel({
    maxOutputTokens: params.maxOutputTokens,
    temperature: params.temperature,
  });

  if (params.fast) {
    const result = await model.generateContent(
      `${params.systemPrompt}\n\n${params.userMessage}`,
    );
    const text = result.response.text();
    if (!text?.trim()) throw new Error("Empty response from Gemma");
    return text.trim();
  }

  const history = (params.history || [])
    .filter((m) => m.content.trim().length > 0)
    .slice(-4)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: `SYSTEM INSTRUCTIONS:\n${params.systemPrompt}` }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I am MwanaAI and will follow these tutoring instructions.",
          },
        ],
      },
      ...history,
    ],
  });

  const result = await chat.sendMessage(params.userMessage);
  const text = result.response.text();

  if (!text?.trim()) {
    throw new Error("Empty response from Gemma");
  }

  return text.trim();
}
