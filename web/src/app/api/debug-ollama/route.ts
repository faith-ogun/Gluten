// TEMPORARY DEBUG ROUTE — delete after diagnosing the 401.
// Returns whether OLLAMA_API_KEY is present, its length, first/last
// 4 chars, and whether a live request to Ollama Cloud succeeds.
// Never logs the full key.
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const raw = process.env.OLLAMA_API_KEY ?? "";
  const trimmed = raw.trim();
  const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const model = process.env.TWIN_MODEL ?? "(unset)";

  const tail4 = trimmed.slice(-4);
  const head4 = trimmed.slice(0, 4);

  // Live test against Ollama Cloud
  let probe: { code: number; body: string } = { code: 0, body: "" };
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${trimmed}`,
      },
      body: JSON.stringify({
        model: "gemma4:31b-cloud",
        messages: [{ role: "user", content: "ping" }],
        stream: false,
      }),
    });
    const text = await res.text();
    probe = { code: res.status, body: text.slice(0, 200) };
  } catch (e) {
    probe = { code: -1, body: e instanceof Error ? e.message : String(e) };
  }

  return Response.json({
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hasTrailingNewline: raw !== trimmed,
    head4,
    tail4,
    url,
    model,
    probe,
  });
}
