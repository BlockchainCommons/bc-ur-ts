/**
 * Differential harness: every corpus recipe is materialised with the frozen
 * baseline bundle (the package's first implementation, with its
 * dcbor-compat inlined) AND the working tree; outcomes, including error
 * codes, must be identical except for the allowed differences listed
 * here, each of which the working tree owes to the Rust reference.
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
import { PARTS, SCAN } from "./corpus/fixtures";
import { currentApi } from "./vectors/modules";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = "efc1c2e929f5569d77a8d28eab2cfe29481156a951f421c0ac6f1d74f3fabd74";

/**
 * The allowed differences. Each names what the tree does as the reference
 * does and what the baseline did instead.
 *
 * - **padding**: a message whose padding bytes are not zero: the tree
 *   completes and `result` throws `Decoder` ("invalid padding"), where the
 *   baseline returned the message.
 * - **wire-fields**: a URL header beyond `u16` is `Decoder` ("Invalid
 *   indices"), and a part with `seqNum` 0 completes into an "expected item"
 *   failure, where the baseline decoded both.
 * - **argument-domain**: a `maxFragmentLength` that is not a safe integer
 *   ≥ 1 (a `bigint`, which the baseline could not take, or a `number` of
 *   2⁵³ or more, which it took although it may have been rounded) and a
 *   short identifier that is not 4 bytes are `InvalidParameter` (a `bigint`
 *   encodes), where the baseline threw a generic error or accepted.
 * - **bytewords-case**: `decodeBytewords` is case-sensitive, as the
 *   reference's `bytewords::decode`; the baseline lower-cased its input.
 * - **single-part-in-multipart**: `MultipartDecoder.add` rejects a
 *   single-part UR (`Decoder`), as the reference does; the baseline
 *   completed on it.
 * - **header-label**: a URL header that disagrees with the part's CBOR is
 *   accepted, as the reference accepts it; the baseline rejected it.
 * - **header-plus**: a `+` in the `seqNum-seqLen` header is read as the
 *   reference's `u16::from_str` reads it; the baseline rejected it.
 * - **last-slash**: `MultipartDecoder.add` splits at the last slash as the
 *   reference does, so `ur:test/1-2/3/…` is "Invalid indices" (`Decoder`)
 *   where the baseline decoded `3/…` as the payload (`Bytewords`).
 * - **fountain-completion**: the fountain decoder completes where the
 *   reference's does: a mixed part is reduced against the fragments known
 *   when it arrives and a buffered part only when a later simple part
 *   comes, so on shuffled or lossy sequences the tree completes on a later
 *   part than the baseline, which re-reduced its buffer after every part,
 *   or stays incomplete.
 * - **multipart-case**: `MultipartDecoder.add` is case-sensitive, as the
 *   reference's `receive`; the baseline lower-cased the part and read an
 *   upper-case QR payload.
 * - **part-cbor**: part CBOR is read as `minicbor` reads it, so non-minimal
 *   integer heads, wider length heads and trailing bytes are accepted; the
 *   baseline required canonical dCBOR.
 * - **no-crc-check**: the reassembled message is not checked against the
 *   parts' checksum field, as the reference never checks it; the baseline
 *   rejected a message whose parts carried a lying checksum.
 * - **dcbor-payload**: the payload of a UR is decoded by the current dcbor:
 *   a text keeps a leading U+FEFF and a float head holding a whole number
 *   is accepted, where the baseline's inlined dcbor stripped the one and
 *   rejected the other.
 * - **parse-codes**: inside `MultipartDecoder.add` and `UR.parse` the codes
 *   follow the reference's `ur::decode`: a string with no type separator
 *   and an unreadable bytewords body are `Decoder` (with the reference's
 *   inner text), where the baseline reported `InvalidType`,
 *   `TypeUnspecified` or `Bytewords`.
 * - **ascii-canonical**: `canonicalizeByteword` lower-cases ASCII letters
 *   only, as the reference's `to_ascii_lowercase`; the baseline mapped
 *   U+212A KELVIN SIGN to `k` and returned a word.
 *
 * Recipe kinds the baseline cannot run (`BASELINE_UNSUPPORTED`) are
 * skipped and counted.
 */
const ALLOWED_DIFFERENCES: { id: string; matches: (r: Recipe) => boolean }[] = [
  {
    id: "padding",
    matches: (r) => r.k === "mpDecode" && "parts" in r && r.parts.includes(PARTS.PADDED_2),
  },
  {
    id: "wire-fields",
    matches: (r) =>
      r.k === "mpDecode" && "parts" in r && (r.note === "seqNum-0" || r.note === "oversize-header"),
  },
  {
    id: "argument-domain",
    matches: (r) =>
      (r.k === "mpEncode" && !(Number.isSafeInteger(num(r.maxLen)) && num(r.maxLen) >= 1)) ||
      (r.k === "bwPlain" &&
        (r.fn === "identifier" || r.fn === "bytemojiIdentifier") &&
        toBytes(r.data).length !== 4),
  },
  {
    id: "bytewords-case",
    matches: (r) => r.k === "bwDecode" && r.s !== r.s.toLowerCase(),
  },
  {
    id: "single-part-in-multipart",
    // The first part is a single-part UR: `ur:<type>/<payload>` with no `n-m/` header.
    matches: (r) =>
      r.k === "mpDecode" &&
      "parts" in r &&
      r.parts.length > 0 &&
      /^ur:[^/]*\/[^/]*$/i.test(r.parts[0]),
  },
  {
    id: "header-label",
    matches: (r) => r.k === "mpDecode" && "parts" in r && r.note === "header-mismatch",
  },
  {
    id: "header-plus",
    matches: (r) =>
      (r.k === "urDecode" && r.s.includes("/+")) ||
      (r.k === "mpDecode" && "parts" in r && r.note === "plus-header"),
  },
  {
    id: "last-slash",
    // More than one slash after the type: the header is everything up to the last one.
    matches: (r) =>
      r.k === "mpDecode" && "parts" in r && r.parts.some((p) => p.split("/").length > 3),
  },
  {
    id: "fountain-completion",
    matches: (r) => r.k === "mpDecode" && "from" in r,
  },
  {
    id: "multipart-case",
    matches: (r) =>
      r.k === "mpDecode" && "parts" in r && r.parts.some((p) => p !== p.toLowerCase()),
  },
  {
    id: "part-cbor",
    matches: (r) =>
      r.k === "mpDecode" &&
      "parts" in r &&
      r.parts.some((p) => (SCAN.NON_CANONICAL as readonly string[]).includes(p)),
  },
  {
    id: "no-crc-check",
    matches: (r) =>
      r.k === "mpDecode" &&
      "parts" in r &&
      r.parts.some((p) => (SCAN.CHECKSUM_WRONG as readonly string[]).includes(p)),
  },
  {
    id: "dcbor-payload",
    matches: (r) =>
      r.k === "urDecode" &&
      [
        "ur:test/iewsrkrshsqzjllprp",
        "ur:test/zsgwaeaeadjotbstce",
        "ur:test/zsgwlaaeaevavewpbk",
      ].includes(r.s),
  },
  {
    id: "parse-codes",
    // A part with nothing after the scheme or no slash after the type; a
    // single-part string with a valid type and an unreadable body.
    matches: (r) =>
      (r.k === "mpDecode" && "parts" in r && r.parts.some((p) => !p.slice(3).includes("/"))) ||
      (r.k === "urDecode" && /^ur:[A-Za-z0-9-]*\/(\+?[0-9]+-\+?[0-9]+\/)?[a-z]*$/.test(r.s)),
  },
  {
    id: "ascii-canonical",
    matches: (r) =>
      r.k === "canon" && Array.from(r.token, (c) => c.charCodeAt(0)).some((c) => c > 0x7f),
  },
];

/**
 * Allowed-difference hits per category, asserted exactly: a difference that
 * stops or starts firing is a change to review, not noise.
 */
const HITS: Record<string, Record<string, number>> = {
  bytewords: { "ascii-canonical": 4, "argument-domain": 90, "bytewords-case": 2 },
  ur: { "dcbor-payload": 3, "header-plus": 1, "parse-codes": 6 },
  multipart: { "fountain-completion": 13 },
  decodeErrors: {
    "last-slash": 1,
    "no-crc-check": 1,
    "parse-codes": 1,
    "part-cbor": 1,
    "single-part-in-multipart": 5,
  },
  domain: {
    "argument-domain": 8,
    "header-label": 1,
    "header-plus": 1,
    "multipart-case": 1,
    padding: 1,
    "wire-fields": 2,
  },
};

/** Recipes per category whose kind the baseline cannot run (`BASELINE_UNSUPPORTED`). */
const SKIPPED: Record<string, number> = { domain: 13, decoder: 84, codable: 15 };

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
      const hitCounts = new Map<string, number>();
      for (const recipe of gen()) {
        n++;
        if (BASELINE_UNSUPPORTED.has(recipe.k)) {
          skipped++;
          continue;
        }
        const a = materialize(baseline, recipe);
        const b = materialize(current, recipe);
        const equal = a === b;
        const allowed = ALLOWED_DIFFERENCES.find((t) => t.matches(recipe));
        if (allowed !== undefined) {
          if (!equal) hitCounts.set(allowed.id, (hitCounts.get(allowed.id) ?? 0) + 1);
        } else if (!equal) {
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 100)} !== ${b.slice(0, 100)}`);
        }
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
      expect(skipped).toBe(SKIPPED[name] ?? 0);
      const hits = Object.fromEntries([...hitCounts].sort(([a], [b]) => a.localeCompare(b)));
      expect(hits).toEqual(HITS[name] ?? {});
    });
  }
});
