/**
 * POST /api/gemma/twin
 *
 * The six-layer disease twin reasoning engine. See web/src/lib/twin.ts for
 * orchestration. This route is a thin validating wrapper.
 *
 * Expected latency: 15–40 s against gemma4:31b-cloud (Ollama Cloud).
 * Temperature is fixed at 0.2 in the engine — we want consistency across
 * repeated calls on the same patient profile, not creative variety.
 */
import { runTwinEngine, type TwinInputPayload } from "@/lib/twin";

const ANCESTRIES = [
  "african", "black-caribbean", "south-asian", "east-asian",
  "middle-eastern", "hispanic-latino", "white-european", "mixed", "other",
] as const;
const SEXES = ["female", "male", "other"] as const;
const HLAS = ["dq2.5", "dq2.2", "dq8", "negative", "unknown"] as const;
const MARSH = ["0", "1", "2", "3a", "3b", "3c"] as const;
const EMAS = ["positive", "negative", "unknown"] as const;

function asInputOrError(body: unknown): TwinInputPayload | string {
  if (!body || typeof body !== "object") return "body must be an object";
  const b = body as Record<string, unknown>;
  const out: TwinInputPayload = {};

  if (b.age !== undefined) {
    if (typeof b.age !== "number" || b.age < 0 || b.age > 120) return "age must be 0–120";
    out.age = b.age;
  }
  if (b.sex !== undefined) {
    if (typeof b.sex !== "string" || !SEXES.includes(b.sex as (typeof SEXES)[number])) return "sex invalid";
    out.sex = b.sex as TwinInputPayload["sex"];
  }
  if (b.ancestry !== undefined) {
    if (typeof b.ancestry !== "string" || !ANCESTRIES.includes(b.ancestry as (typeof ANCESTRIES)[number])) return "ancestry invalid";
    out.ancestry = b.ancestry as TwinInputPayload["ancestry"];
  }
  if (b.hla !== undefined) {
    if (typeof b.hla !== "string" || !HLAS.includes(b.hla as (typeof HLAS)[number])) return "hla invalid";
    out.hla = b.hla as TwinInputPayload["hla"];
  }
  if (b.marsh !== undefined) {
    if (typeof b.marsh !== "string" || !MARSH.includes(b.marsh as (typeof MARSH)[number])) return "marsh invalid";
    out.marsh = b.marsh as TwinInputPayload["marsh"];
  }
  if (b.tTG !== undefined) {
    if (typeof b.tTG !== "number" || b.tTG < 0) return "tTG must be a non-negative number";
    out.tTG = b.tTG;
  }
  if (b.ema !== undefined) {
    if (typeof b.ema !== "string" || !EMAS.includes(b.ema as (typeof EMAS)[number])) return "ema invalid";
    out.ema = b.ema as TwinInputPayload["ema"];
  }
  if (b.iel !== undefined) {
    if (typeof b.iel !== "number" || b.iel < 0) return "iel must be a non-negative number";
    out.iel = b.iel;
  }
  if (b.gfdMonths !== undefined) {
    if (typeof b.gfdMonths !== "number" || b.gfdMonths < 0) return "gfdMonths must be a non-negative number";
    out.gfdMonths = b.gfdMonths;
  }
  if (b.flags !== undefined) {
    if (!Array.isArray(b.flags) || !b.flags.every((f) => typeof f === "string")) return "flags must be string[]";
    out.flags = b.flags as string[];
  }
  if (b.notes !== undefined) {
    if (typeof b.notes !== "string") return "notes must be a string";
    out.notes = b.notes;
  }

  return out;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = asInputOrError(body);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  try {
    const result = await runTwinEngine(parsed);
    // Server-side diagnostic: if the generation shape is missing the
    // expected top-level blocks, log it so we can tune the prompt/schema.
    const gen = result.generation as Partial<typeof result.generation> | undefined;
    if (!gen || !gen.overall || !gen.layers) {
      console.warn("[twin] model returned unexpected shape. model=%s durationMs=%d", result.model, result.durationMs);
      console.warn("[twin] top-level keys:", gen ? Object.keys(gen) : "(none)");
      console.warn("[twin] generation snippet:", JSON.stringify(gen).slice(0, 1500));
    }
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Ollama Cloud auth errors surface with "401" / "unauthorized" in the
    // body. Pass the message through so the client can surface a clear
    // remediation hint ("run `ollama signin` or set TWIN_MODEL to a local tag").
    const status = /unauthori[sz]ed|401/i.test(msg) ? 401 : 500;
    return Response.json({ error: msg }, { status });
  }
}
