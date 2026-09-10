/**
 * Differential harness (Phase 1.3): every corpus recipe is materialised with
 * the frozen baseline bundle (pre-redesign crypto and dcbor-compat inlined)
 * AND the working tree; outcomes, including error codes, must be identical
 * except for the enumerated tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as baselineMod from "./baseline/uniform-resources-baseline.mjs";
import { materialize, baselineAdapterFor, recipeName, type Recipe } from "./vectors/recipes";
import { currentApi } from "./vectors/modules";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "2334072acdd1d4dd6a1f124ceea1cfce20e2287a482fd272814622d7577b75ab";

/**
 * Tombstones: the only allowed differences. T1: argument-domain errors
 * (`maxFragmentLength < 1`, empty message) are `RangeError` in the redesign,
 * generic `URError` / bare `Error` in the baseline.
 */
const TOMBSTONES: { id: string; landed: boolean; matches: (r: Recipe) => boolean }[] = [
  {
    id: "T1",
    landed: false,
    matches: (r) => r.k === "mpEncode" && (r.maxLen < 1 || r.cbor === undefined),
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
      const diffs: string[] = [];
      const landedHits = new Map<string, number>();
      for (const recipe of gen()) {
        n++;
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
      for (const t of TOMBSTONES)
        if (t.landed && name === "multipart") expect(landedHits.get(t.id) ?? 0).toBeGreaterThan(0);
    });
  }
});
