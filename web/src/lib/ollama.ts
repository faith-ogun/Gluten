/**
 * Thin typed client for Ollama's HTTP API.
 *
 * Used server-side only (Next.js route handlers under /api/gemma/*).
 * Ollama is expected to be running on OLLAMA_URL (default http://localhost:11434).
 *
 * Supports:
 *   - /api/chat  — multi-turn chat with optional JSON-mode response
 *   - /api/embed — vector embeddings for the PubMed RAG pipeline
 *
 * We don't stream; responses are small (FHIR JSON / short narratives) and the
 * twin flow runs step-by-step in the wizard, not in a chat UI.
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
// Trim because Secret Manager files often end with a trailing newline
// — without trim, the Bearer header would be `Bearer <key>\n` and
// Ollama Cloud rejects it as malformed with 401.
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY?.trim();

/**
 * Auth header sent to Ollama. Local Ollama ignores it (no API key
 * needed for localhost). Ollama Cloud + the `gemma4:31b-cloud` model
 * require `Authorization: Bearer <token>`. Setting both code paths
 * lets the same web app talk to local Ollama in dev and Ollama Cloud
 * in production with no code branching, just env vars.
 */
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (OLLAMA_API_KEY) h.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  return h;
}

export const GEMMA_E4B_MODEL = process.env.GEMMA_E4B_MODEL ?? "gemma4:e4b";
export const GEMMA_31B_MODEL = process.env.GEMMA_31B_MODEL ?? "gemma4:31b-cloud";

export type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: OllamaMessage[];
  format?: "json" | Record<string, unknown>;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
    seed?: number;
  };
};

export type ChatResponse = {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
};

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...req, stream: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }
  return (await res.json()) as ChatResponse;
}

/**
 * Ask Gemma for a JSON response matching a schema and parse it.
 * Ollama enforces the schema server-side (structured outputs), so the
 * returned string is guaranteed to parse and match the shape.
 */
export async function chatJson<T>(
  req: Omit<ChatRequest, "format"> & { schema: Record<string, unknown> },
): Promise<T> {
  const { schema, ...rest } = req;
  const res = await chat({ ...rest, format: schema });
  // Defensive: Gemma-family models occasionally wrap structured output
  // in markdown fences when the schema is deeply nested, even with
  // format enforcement on. Strip the fences before parsing.
  let raw = res.message.content.trim();
  const fenced = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced) raw = fenced[1].trim();
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    // Log the raw content so we can diagnose what the model emitted
    // when it fails to match the schema. Visible in the dev server logs.
    console.error("[chatJson] parse failed for model", req.model);
    console.error("[chatJson] raw content (first 2000 chars):", raw.slice(0, 2000));
    throw e;
  }
}

export type EmbedRequest = { model: string; input: string | string[] };
export type EmbedResponse = { embeddings: number[][] };

export async function embed(req: EmbedRequest): Promise<EmbedResponse> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }
  return (await res.json()) as EmbedResponse;
}

export async function health(): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { headers: authHeaders() });
    if (!res.ok) return { ok: false, error: `tags ${res.status}` };
    const data = (await res.json()) as { models: { name: string }[] };
    return { ok: true, models: data.models.map((m) => m.name) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
