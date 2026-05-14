/**
 * Unit tests for the de-identification engine.
 *
 * Runs against Node's built-in test runner (no extra deps).
 *
 *   npx tsx --test web/src/lib/deidentify.test.ts
 *
 * If `tsx` is not installed, run with the helper:
 *
 *   node --import tsx --test web/src/lib/deidentify.test.ts
 *
 * These tests are the contract for what the contribution endpoint
 * promises. If you add a new field to `ContributionDraft`, add a test
 * that proves either it gets through unmodified (because it's already
 * structured + non-identifying) or it gets bucketed / dropped.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  deidentify,
  assertNoPHI,
  PHIDetectedError,
  bucketAge,
  bucketTTG,
  bucketIEL,
  bucketGFD,
  type ContributionDraft,
} from "./deidentify";

/* ---------------- bucketing helpers ---------------- */

test("bucketAge bins by decade and tops out at 80+", () => {
  assert.equal(bucketAge(0), "0-9");
  assert.equal(bucketAge(9), "0-9");
  assert.equal(bucketAge(10), "10-19");
  assert.equal(bucketAge(28), "20-29");
  assert.equal(bucketAge(35), "30-39");
  assert.equal(bucketAge(79), "70-79");
  assert.equal(bucketAge(80), "80+");
  assert.equal(bucketAge(102), "80+");
  assert.equal(bucketAge(undefined), undefined);
  assert.equal(bucketAge(-1), undefined);
  assert.equal(bucketAge(Number.NaN), undefined);
});

test("bucketTTG bins clinical serology thresholds", () => {
  assert.equal(bucketTTG(0), "<20");
  assert.equal(bucketTTG(19.9), "<20");
  assert.equal(bucketTTG(20), "20-50");
  assert.equal(bucketTTG(49), "20-50");
  assert.equal(bucketTTG(50), "50-100");
  assert.equal(bucketTTG(99.9), "50-100");
  assert.equal(bucketTTG(100), ">100");
  assert.equal(bucketTTG(540), ">100");
  assert.equal(bucketTTG(undefined), undefined);
});

test("bucketIEL bins Marsh-relevant IEL counts", () => {
  assert.equal(bucketIEL(10), "<25");
  assert.equal(bucketIEL(24), "<25");
  assert.equal(bucketIEL(25), "25-40");
  assert.equal(bucketIEL(40), "25-40");
  assert.equal(bucketIEL(41), ">40");
  assert.equal(bucketIEL(undefined), undefined);
});

test("bucketGFD bins time-on-GFD into clinical windows", () => {
  assert.equal(bucketGFD(0), "0");
  assert.equal(bucketGFD(1), "1-3");
  assert.equal(bucketGFD(3), "1-3");
  assert.equal(bucketGFD(4), "4-6");
  assert.equal(bucketGFD(6), "4-6");
  assert.equal(bucketGFD(12), "7-12");
  assert.equal(bucketGFD(18), "13-24");
  assert.equal(bucketGFD(36), ">24");
});

/* ---------------- deidentify() end-to-end ---------------- */

test("deidentify: exact age → age bucket, with diff row", () => {
  const { output, diff } = deidentify({ age: 28 });
  assert.equal(output.ageBucket, "20-29");
  assert.equal((output as Record<string, unknown>).age, undefined);
  const row = diff.find((d) => d.field === "age");
  assert.ok(row, "expected an age diff row");
  assert.equal(row!.before, "28");
  assert.equal(row!.after, "20-29");
  assert.equal(row!.reason, "exact_value_bucketed");
});

test("deidentify: exact tTG → bin, with diff row", () => {
  const { output, diff } = deidentify({ tTG: 84 });
  assert.equal(output.tTG_bin, "50-100");
  assert.equal((output as Record<string, unknown>).tTG, undefined);
  assert.ok(diff.find((d) => d.field === "tTG-IgA"));
});

test("deidentify: clinician notes are always dropped, even if benign", () => {
  const { output, diff } = deidentify({
    age: 35,
    notes: "Patient is doing well on diet.",
  });
  assert.equal(
    (output as Record<string, unknown>).notes,
    undefined,
    "notes must not survive into output",
  );
  const dropRow = diff.find((d) => d.field === "Clinician notes");
  assert.ok(dropRow, "expected a notes drop row");
  assert.equal(dropRow!.reason, "free_text_dropped");
});

test("deidentify: empty/whitespace notes do not produce a diff row", () => {
  const { diff } = deidentify({ age: 35, notes: "   " });
  assert.equal(diff.find((d) => d.field === "Clinician notes"), undefined);
});

test("deidentify: unknown flags are dropped, known flags pass through", () => {
  const { output, diff } = deidentify({
    flags: ["iron_deficiency", "patient_name_jane_doe", "T1D", "rxcui12345"],
  });
  assert.deepEqual(output.flags.sort(), ["iron_deficiency", "t1d"].sort());
  const dropped = diff.filter((d) => d.reason === "unknown_flag_dropped");
  assert.equal(dropped.length, 2);
});

test("deidentify: structured clinical fields pass through", () => {
  const draft: ContributionDraft = {
    age: 42,
    sex: "female",
    ancestry: "african",
    hla: "dq2.5",
    marsh: "3b",
    tTG: 84,
    ema: "positive",
    iel: 42,
    gfdMonths: 6,
    flags: ["iron_deficiency", "osteoporosis"],
  };
  const { output } = deidentify(draft);
  assert.equal(output.sex, "female");
  assert.equal(output.ancestry, "african");
  assert.equal(output.hla, "dq2.5");
  assert.equal(output.marsh, "3b");
  assert.equal(output.ema, "positive");
  assert.equal(output.ageBucket, "40-49");
  assert.equal(output.tTG_bin, "50-100");
  assert.equal(output.iel_bin, ">40");
  assert.equal(output.gfdMonths_bin, "4-6");
  assert.deepEqual(output.flags.sort(), ["iron_deficiency", "osteoporosis"].sort());
  assert.equal(output.schemaVersion, "v1");
  assert.ok(output.contributedAtYear >= 2026);
});

test("deidentify: output never carries the source `notes`, `age`, `tTG`, `iel`, `gfdMonths` fields", () => {
  const { output } = deidentify({
    age: 28,
    tTG: 84,
    iel: 42,
    gfdMonths: 6,
    notes: "Dr. Smith reviewed on 2026-04-21",
  });
  const o = output as unknown as Record<string, unknown>;
  assert.equal(o.age, undefined);
  assert.equal(o.tTG, undefined);
  assert.equal(o.iel, undefined);
  assert.equal(o.gfdMonths, undefined);
  assert.equal(o.notes, undefined);
});

/* ---------------- assertNoPHI: defence in depth ---------------- */

test("assertNoPHI: passes through a clean de-identified payload", () => {
  const { output } = deidentify({
    age: 28,
    sex: "female",
    ancestry: "african",
    hla: "dq2.5",
    marsh: "3b",
    tTG: 84,
    flags: ["iron_deficiency"],
  });
  assert.doesNotThrow(() => assertNoPHI(output));
});

test("assertNoPHI: throws on emails", () => {
  assert.throws(
    () => assertNoPHI({ contact: "patient.x@example.com" }),
    PHIDetectedError,
  );
});

test("assertNoPHI: throws on phone numbers", () => {
  assert.throws(() => assertNoPHI({ phone: "+44 20 7946 0958" }), PHIDetectedError);
});

test("assertNoPHI: throws on exact dates", () => {
  assert.throws(() => assertNoPHI({ when: "21/04/2026" }), PHIDetectedError);
  assert.throws(() => assertNoPHI({ when: "2026-04-21" }), PHIDetectedError);
});

test("assertNoPHI: throws on MRN-shaped fields", () => {
  assert.throws(
    () => assertNoPHI({ ref: "MRN: 9847362" }),
    PHIDetectedError,
  );
});

test("assertNoPHI: throws on URLs", () => {
  assert.throws(
    () => assertNoPHI({ link: "https://hospital.example.com/patient/123" }),
    PHIDetectedError,
  );
});

test("assertNoPHI: throws on salutation+name patterns", () => {
  assert.throws(
    () => assertNoPHI({ refBy: "Dr. Jane Smith referred this patient" }),
    PHIDetectedError,
  );
});

test("assertNoPHI: recurses into nested structures", () => {
  assert.throws(
    () =>
      assertNoPHI({
        flags: ["iron_deficiency", "ref-MRN:1234567"],
      }),
    PHIDetectedError,
  );
});

test("assertNoPHI: empty / nullish values do not throw", () => {
  assert.doesNotThrow(() => assertNoPHI(null));
  assert.doesNotThrow(() => assertNoPHI(undefined));
  assert.doesNotThrow(() => assertNoPHI({}));
  assert.doesNotThrow(() => assertNoPHI([]));
});

/* ---------------- integration: a worst-case draft ---------------- */

test("integration: a worst-case draft yields a clean output that passes assertNoPHI", () => {
  const draft: ContributionDraft = {
    age: 28,
    sex: "female",
    ancestry: "african",
    hla: "dq2.5",
    marsh: "3b",
    tTG: 84,
    ema: "positive",
    iel: 42,
    gfdMonths: 6,
    flags: [
      "iron_deficiency",
      "t1d",
      "patient_name_jane_doe", // unknown — should drop
      "0866847238", // unknown — should drop
    ],
    notes:
      "Patient Jane Doe (DOB 1998-04-12) referred by Dr. Mary Smith. " +
      "Email jane.doe@example.com. MRN: 9847362. " +
      "Lives at https://maps.example.com/x. Reviewed 21/04/2026.",
  };
  const { output, diff } = deidentify(draft);

  // The output must be PHI-free.
  assert.doesNotThrow(() => assertNoPHI(output));

  // The notes must have been dropped.
  assert.equal((output as Record<string, unknown>).notes, undefined);

  // Allowed flags survive; unknown ones don't.
  assert.deepEqual(output.flags.sort(), ["iron_deficiency", "t1d"].sort());

  // The diff explains the drops.
  assert.ok(diff.find((d) => d.reason === "free_text_dropped"));
  assert.ok(diff.find((d) => d.reason === "unknown_flag_dropped"));
  assert.ok(diff.find((d) => d.reason === "exact_value_bucketed"));
});
