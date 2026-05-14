/**
 * Firestore admin wrapper for contributions.
 *
 * Operates in two modes:
 *   1. **Connected** — `FIREBASE_SERVICE_ACCOUNT_JSON` is set in the
 *      environment. We use the firebase-admin SDK against the real
 *      Firestore. Atomic counter via `FieldValue.increment(1)`.
 *   2. **Local fallback** — env var unset. Persists contributions to a
 *      gitignored `web/.contributions/` JSONL file. Useful for the
 *      hackathon demo when Firebase isn't wired up yet, and for tests.
 *
 * The contract is the same in both modes:
 *   - `recordContribution(deidentified)` returns `{ contributionId, total }`
 *   - `getTotal()` returns the cumulative count
 *
 * Why a fallback? CLAUDE.md §19 allows pre-computed/local fallbacks for
 * demo purposes as long as the pipeline code is verifiable. The Firebase
 * mode is the production path; the file mode keeps the demo green even
 * if Firebase auth flakes at the wrong moment.
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { DeidentifiedContribution } from "./deidentify";

const COLLECTION = "contributions";
const COUNTER_DOC = "meta/counters";
const LOCAL_DIR = path.join(process.cwd(), ".contributions");
const LOCAL_FILE = path.join(LOCAL_DIR, "contributions.jsonl");
const LOCAL_COUNTER = path.join(LOCAL_DIR, "counter.json");

export type ContributionWriteResult = {
  contributionId: string;
  total: number;
  mode: "firestore" | "local";
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function recordContribution(
  payload: DeidentifiedContribution,
): Promise<ContributionWriteResult> {
  const contributionId = hashId(payload);
  if (isFirestoreConfigured()) {
    try {
      const total = await writeFirestore(contributionId, payload);
      return { contributionId, total, mode: "firestore" };
    } catch (e) {
      console.warn(
        "[firestore] write failed, falling back to local file:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  const total = await writeLocal(contributionId, payload);
  return { contributionId, total, mode: "local" };
}

export async function getTotal(): Promise<{ total: number; mode: "firestore" | "local" }> {
  if (isFirestoreConfigured()) {
    try {
      const total = await readFirestoreCounter();
      return { total, mode: "firestore" };
    } catch (e) {
      console.warn(
        "[firestore] counter read failed, falling back to local:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  const total = await readLocalCounter();
  return { total, mode: "local" };
}

export type ContributionRecord = DeidentifiedContribution & {
  contributionId: string;
  createdAt: string | null;
};

export async function listRecent(limit = 20): Promise<{
  contributions: ContributionRecord[];
  mode: "firestore" | "local";
}> {
  if (isFirestoreConfigured()) {
    try {
      const list = await readFirestoreList(limit);
      return { contributions: list, mode: "firestore" };
    } catch (e) {
      console.warn(
        "[firestore] list read failed, falling back to local:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return { contributions: await readLocalList(limit), mode: "local" };
}

/* ------------------------------------------------------------------ */
/* Firestore path                                                      */
/* ------------------------------------------------------------------ */

function isFirestoreConfigured(): boolean {
  // Local dev path: an explicit service-account JSON in the env.
  // Production (App Hosting / Cloud Run) path: Application Default
  // Credentials are auto-injected by the runtime — detect via the
  // standard GCP env vars instead.
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE || // Cloud Run / App Hosting injects this
      process.env.FUNCTION_TARGET || // Cloud Functions
      process.env.GCLOUD_PROJECT, // generic GCP runtime
  );
}

let _firestore: import("firebase-admin/firestore").Firestore | null = null;
async function getFirestore() {
  if (_firestore) return _firestore;
  const admin = await import("firebase-admin");
  const { getFirestore: getFs } = await import("firebase-admin/firestore");
  if (admin.apps.length === 0) {
    const credJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (credJson) {
      // Dev path — explicit JSON env var.
      const credential = admin.credential.cert(
        JSON.parse(credJson) as import("firebase-admin").ServiceAccount,
      );
      admin.initializeApp({ credential });
    } else {
      // GCP path — Application Default Credentials. Works on App
      // Hosting / Cloud Run / Cloud Functions without any explicit
      // service account, picking up the runtime's attached SA.
      admin.initializeApp();
    }
  }
  _firestore = getFs();
  return _firestore;
}

async function writeFirestore(
  contributionId: string,
  payload: DeidentifiedContribution,
): Promise<number> {
  const db = await getFirestore();
  const { FieldValue } = await import("firebase-admin/firestore");
  const batch = db.batch();
  batch.set(db.collection(COLLECTION).doc(contributionId), {
    ...payload,
    contributionId,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    db.doc(COUNTER_DOC),
    {
      total: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
  const snap = await db.doc(COUNTER_DOC).get();
  return (snap.get("total") as number | undefined) ?? 0;
}

async function readFirestoreCounter(): Promise<number> {
  const db = await getFirestore();
  const snap = await db.doc(COUNTER_DOC).get();
  return (snap.get("total") as number | undefined) ?? 0;
}

async function readFirestoreList(limit: number): Promise<ContributionRecord[]> {
  const db = await getFirestore();
  const snap = await db
    .collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const ts = data.createdAt as { toDate?: () => Date } | undefined;
    return {
      ...(data as DeidentifiedContribution),
      contributionId: d.id,
      createdAt: ts && ts.toDate ? ts.toDate().toISOString() : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Local file path                                                     */
/* ------------------------------------------------------------------ */

async function writeLocal(
  contributionId: string,
  payload: DeidentifiedContribution,
): Promise<number> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.appendFile(
    LOCAL_FILE,
    JSON.stringify({
      ...payload,
      contributionId,
      createdAt: new Date().toISOString(),
    }) + "\n",
    "utf-8",
  );
  const current = await readLocalCounter();
  const next = current + 1;
  await fs.writeFile(LOCAL_COUNTER, JSON.stringify({ total: next }), "utf-8");
  return next;
}

async function readLocalCounter(): Promise<number> {
  try {
    const raw = await fs.readFile(LOCAL_COUNTER, "utf-8");
    const { total } = JSON.parse(raw) as { total: number };
    return total ?? 0;
  } catch {
    return 0;
  }
}

async function readLocalList(limit: number): Promise<ContributionRecord[]> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((l) => JSON.parse(l) as ContributionRecord);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function hashId(payload: DeidentifiedContribution): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}
