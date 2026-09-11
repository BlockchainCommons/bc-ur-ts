/**
 * Differential harness: every corpus recipe is materialised with the frozen
 * baseline bundle (pre-redesign crypto and dcbor-compat inlined) AND the
 * working tree; outcomes, including error codes, must be identical except
 * for the enumerated tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as baselineMod from "./baseline/uniform-resources-baseline.mjs";
import {
  BASELINE_UNSUPPORTED,
  materialize,
  baselineAdapterFor,
  num,
  recipeName,
  toBytes,
  type Recipe,
} from "./vectors/recipes";
import { PARTS } from "./corpus/fixtures";
import { currentApi } from "./vectors/modules";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "efc1c2e929f5569d77a8d28eab2cfe29481156a951f421c0ac6f1d74f3fabd74";

/**
 * Tombstones: the only allowed differences.
 *
 * - **T2** (padding): the baseline completes on a part whose padding is
 *   not zero; the tree rejects it (`Decoder`).
 * - **T3** (empty type): the baseline round-trips `ur:/…`; the tree
 *   rejects the empty type (`InvalidType`).
 * - **T5**: on-wire parts the baseline accepted and the tree rejects
 *   (`Decoder`): a CBOR `seqNum` of 0 and a URL header beyond `u16`.
 * - **T4** (absorbs the original T1): argument-domain faults —
 *   `maxFragmentLength` not an integer ≥ 1, a short identifier that is not
 *   4 bytes — where the baseline threw a generic error (mapped to
 *   `Decoder`) or silently accepted; the tree throws `URError`
 *   `InvalidParameter`.
 *
 * Recipe kinds the baseline cannot run (`BASELINE_UNSUPPORTED`) are
 * skipped and counted.
 */
const isEmptyType = (r: Recipe): boolean =>
  ((r.k === "urEncode" || r.k === "urRoundtrip") && r.type === "") ||
  (r.k === "urDecode" && r.s.startsWith("ur:/"));
const TOMBSTONES: { id: string; landed: boolean; matches: (r: Recipe) => boolean }[] = [
  {
    id: "T2",
    landed: true,
    matches: (r) => r.k === "mpDecode" && "parts" in r && r.parts.includes(PARTS.PADDED_2),
  },
  { id: "T3", landed: true, matches: isEmptyType },
  {
    id: "T5",
    landed: true,
    matches: (r) =>
      r.k === "mpDecode" && "parts" in r && (r.note === "seqNum-0" || r.note === "oversize-header"),
  },
  {
    id: "T4",
    landed: true,
    matches: (r) =>
      (r.k === "mpEncode" && !(Number.isInteger(num(r.maxLen)) && num(r.maxLen) >= 1)) ||
      (r.k === "bwPlain" &&
        (r.fn === "identifier" || r.fn === "bytemojiIdentifier") &&
        toBytes(r.data).length !== 4),
  },
];

const baseline = baselineAdapterFor(baselineMod);
const current = await currentApi();

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/uniform-resources-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });
  for (const [name, gen] of Object.entries(categories)) {
    it(`category ${name}`, { timeout: 300_000 }, () => {
      let n = 0;
      let skipped = 0;
      const diffs: string[] = [];
      const landedHits = new Map<string, number>();
      for (const recipe of gen()) {
        n++;
        if (BASELINE_UNSUPPORTED.has(recipe.k)) {
          skipped++;
          continue;
        }
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        const equal = a === b;
        const tomb = TOMBSTONES.find((t) => t.matches(recipe));
        if (tomb?.landed === true) {
          if (!equal) landedHits.set(tomb.id, (landedHits.get(tomb.id) ?? 0) + 1);
        } else if (!equal) {
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 100)} !== ${b.slice(0, 100)}`);
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
      if (name === "domain") expect(skipped).toBe(13);
      else expect(skipped).toBe(0);
      const T = Object.fromEntries(TOMBSTONES.map((t) => [t.id, t]));
      if (name === "multipart") expect(landedHits.get("T4") ?? 0).toBeGreaterThan(0);
      if (name === "domain") {
        if (T["T2"]!.landed) expect(landedHits.get("T2") ?? 0).toBe(1);
        if (T["T3"]!.landed) expect(landedHits.get("T3") ?? 0).toBe(2);
        expect(landedHits.get("T5") ?? 0).toBe(2);
      }
      if (name === "ur" && T["T3"]!.landed) expect(landedHits.get("T3") ?? 0).toBe(1);
    });
  }
});
