const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function hasGeminiKey(): boolean {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 0);
}

export async function generateWithGemini(
  prompt: string,
  options?: { jsonMode?: boolean },
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Gemini API key is missing. Add VITE_GEMINI_API_KEY to your .env file.",
    );
  }

  const url = `${BASE_URL}/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  if (options?.jsonMode) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      "application/json";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  return text;
}
