/**
 * Clinician contribution endpoint.
 *
 * POST → de-identifies the draft, runs a defence-in-depth PHI scan,
 *         writes the result to Firestore (or local fallback), returns
 *         { contributionId, total, mode, diff }.
 * GET  → returns the current global contribution count.
 *
 * Contract: the client never deidentifies. The server does the scrub
 * and writes the scrubbed payload. The `diff` we return is for UI
 * animation; the client should NOT trust it for "this is what got
 * written" — what got written is what `output` contained, not what
 * `diff` says.
 */

import { NextRequest } from "next/server";
import {
  deidentify,
  assertNoPHI,
  type ContributionDraft,
} from "@/lib/deidentify";
import { recordContribution, getTotal, listRecent } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ContributionDraft | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { output, diff } = deidentify(body);

  try {
    assertNoPHI(output);
  } catch (e) {
    return Response.json(
      {
        error: "phi_detected_in_output",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const result = await recordContribution(output);

  return Response.json({
    contributionId: result.contributionId,
    total: result.total,
    mode: result.mode,
    schemaVersion: output.schemaVersion,
    contributedAtYear: output.contributedAtYear,
    diff,
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("list") === "1") {
    const limitParam = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(100, limitParam))
      : 20;
    const { contributions, mode } = await listRecent(limit);
    const { total } = await getTotal();
    return Response.json({ contributions, total, mode });
  }
  const { total, mode } = await getTotal();
  return Response.json({ total, mode });
}
