/**
 * Deterministic differential corpus. Pure: CBOR inputs are built by a tiny
 * header writer here, never by the package under test.
 */
import type {
  Recipe,
  Bytes,
  Style,
  PlainFn,
  MultipartSpec,
  Num,
  PartFields,
  TagSpec,
} from "../vectors/recipes";
import {
  CRC_12345,
  FOUNTAIN_SCAN,
  FOUNTAIN_SEQUENCES,
  PART_CBOR_ROWS,
  PARTS,
  SCAN,
  STRINGS,
  WOLF_1024_HEX,
} from "./fixtures";

const cyc = (n: number, start = 0): Bytes => ({ cycle: n, start });
const h = (hex: string): Bytes => ({ hex });
export const STYLES: Style[] = ["standard", "uri", "minimal"];
export const PLAIN: PlainFn[] = [
  "words",
  "bytemojis",
  "minimal",
  "identifier",
  "bytemojiIdentifier",
];

// --- minimal dCBOR writer for corpus inputs -------------------------------
const hx = (bytes: number[]): string => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
function head(major: number, n: number): number[] {
  const m = major << 5;
  if (n < 24) return [m | n];
  if (n < 0x100) return [m | 24, n];
  if (n < 0x10000) return [m | 25, n >> 8, n & 0xff];
  return [m | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
const cycleBytes = (n: number, start = 0): number[] =>
  Array.from({ length: n }, (_, i) => (start + i) & 0xff);
/** CBOR byte string of `n` cyclic bytes. */
export const bstr = (n: number, start = 0): Bytes =>
  h(hx([...head(2, n), ...cycleBytes(n, start)]));
const tstr = (s: string): Bytes => {
  const b = [...new TextEncoder().encode(s)];
  return h(hx([...head(3, b.length), ...b]));
};
const uint = (n: number): Bytes => h(hx(head(0, n)));
const nint = (n: number): Bytes => h(hx(head(1, n - 1)));
const arr = (items: Bytes[]): Bytes =>
  h(hx(head(4, items.length)) + items.map((i) => (i as { hex: string }).hex).join(""));
const tagged = (tag: number, item: Bytes): Bytes =>
  h(hx(head(6, tag)) + (item as { hex: string }).hex);
export const CBOR_CORPUS: [string, Bytes][] = [
  ["uint0", uint(0)],
  ["uint1", uint(1)],
  ["uint23", uint(23)],
  ["uint24", uint(24)],
  ["uint255", uint(255)],
  ["uint256", uint(256)],
  ["uint65535", uint(65535)],
  ["uint65536", uint(65536)],
  ["nint1", nint(1)],
  ["nint100", nint(100)],
  ["bstr0", bstr(0)],
  ["bstr1", bstr(1)],
  ["bstr23", bstr(23)],
  ["bstr24", bstr(24)],
  ["bstr255", bstr(255)],
  ["bstr256", bstr(256)],
  ["bstr1024", bstr(1024, 7)],
  ["tstr-empty", tstr("")],
  ["tstr-hello", tstr("hello world")],
  ["tstr-unicode", tstr("héllo ☃")],
  ["arr-empty", arr([])],
  ["arr123", arr([uint(1), uint(2), uint(3)])],
  ["arr-nested", arr([arr([uint(1)]), bstr(3), tstr("x")])],
  ["map", h("a201020304")],
  ["tag1-date", tagged(1, uint(1700000000))],
  ["tag40300-seed", tagged(40300, h("a10150" + hx(cycleBytes(16, 0x10))))],
  ["true", h("f5")],
  ["false", h("f4")],
  ["null", h("f6")],
  ["float-1.5", h("f93e00")],
  ["float-pi", h("fb400921fb54442d18")],
];
export const TYPES: string[] = ["bytes", "test", "crypto-seed", "envelope", "a", "x-1"];

function* bytewords(): Generator<Recipe> {
  for (let n = 0; n <= 300; n++)
    for (const style of STYLES) {
      yield { k: "bwEncode", style, data: cyc(n, n) };
      yield { k: "bwRoundtrip", style, data: cyc(n, 0x80 + n) };
    }
  for (let n = 0; n <= 40; n++)
    for (const fn of PLAIN) yield { k: "bwPlain", fn, data: cyc(n, 3 * n) };
  for (const fn of PLAIN)
    for (const n of [0, 3, 4, 5, 255, 256]) yield { k: "bwPlain", fn, data: cyc(n, 0xf0) };
  // decode: explicit strings
  const s5 = STRINGS.std5;
  yield { k: "bwDecode", style: "standard", s: s5 };
  yield { k: "bwDecode", style: "standard", s: s5.toUpperCase() };
  yield { k: "bwDecode", style: "uri", s: STRINGS.uri5 };
  yield { k: "bwDecode", style: "uri", s: s5 }; // wrong separator
  yield { k: "bwDecode", style: "standard", s: STRINGS.uri5 };
  yield { k: "bwDecode", style: "minimal", s: STRINGS.arr123 };
  yield { k: "bwDecode", style: "minimal", s: STRINGS.arr123.toUpperCase() };
  yield { k: "bwDecode", style: "minimal", s: STRINGS.arr123.slice(0, -1) }; // odd length
  yield { k: "bwDecode", style: "minimal", s: STRINGS.arr123.slice(0, -2) + "zz" }; // bad word
  yield { k: "bwDecode", style: "minimal", s: STRINGS.arr123.slice(0, -2) + "ae" }; // bad checksum
  yield { k: "bwDecode", style: "minimal", s: "" };
  yield { k: "bwDecode", style: "minimal", s: "ae" }; // shorter than a checksum
  yield { k: "bwDecode", style: "minimal", s: "aeaeaeaeae" }; // 1 byte + wrong crc
  yield { k: "bwDecode", style: "standard", s: "" };
  yield { k: "bwDecode", style: "standard", s: "able  acid" }; // double space
  yield { k: "bwDecode", style: "minimal", s: "ñe" + STRINGS.arr123.slice(2) };
  yield { k: "bwDecode", style: "standard", s: "able acid also apex aqua" }; // 5 bytes, crc wrong
  for (const token of [
    "able",
    "ABLE",
    "ae",
    "AE",
    "abl",
    "ble",
    "zoom",
    "zm",
    "zoo",
    "oom",
    "xyz",
    "",
    "a",
    "aeae",
    "abcd",
    "abl3",
    "ab",
    "zz",
    // U+212A KELVIN SIGN, U+0130 and U+017F lower-case to ASCII letters under Unicode rules only.
    "\u212Ap",
    "\u212AEEP",
    "\u212Aee",
    "\u212Aep",
    "\u0130",
    "k\u0130ck",
    "\u017F",
  ])
    yield { k: "canon", token };
}
function* ur(): Generator<Recipe> {
  for (const type of TYPES)
    for (const [, cbor] of CBOR_CORPUS) {
      yield { k: "urEncode", type, cbor };
      yield { k: "urRoundtrip", type, cbor };
    }
  const good = "ur:test/lsadaoaxjygonesw";
  const bad: string[] = [
    "",
    "ur:",
    "ur",
    "UR:TEST/LSADAOAXJYGONESW",
    "ur:test",
    "ur:/lsadaoaxjygonesw",
    "ur:Test/lsadaoaxjygonesw",
    "ur:te_st/lsadaoaxjygonesw",
    "ur:test/",
    "ur:test/lsadaoaxjygonesx",
    "ur:test/lsadaoaxjygones",
    "ur:test/1-2/lsadaoaxjygonesw",
    "ur:test/1-/lsadaoaxjygonesw",
    "ur:test/x-1/lsadaoaxjygonesw",
    "ur:test/1/lsadaoaxjygonesw",
    "ur:test/70000-1/lsadaoaxjygonesw",
    "ur:test/1-2/3/lsadaoaxjygonesw",
    "ur:test/+1-2/lsadaoaxjygonesw",
    "http://test/lsadaoaxjygonesw",
    "ur:test/" + STRINGS.badCborBreak,
    "ur:test/" + STRINGS.badCborTruncated,
    "ur:test/" + STRINGS.nonCanonical,
    "ur:bytes/" + STRINGS.arr123,
    good,
    // A well-formed multipart header: the payload is decoded before NotSinglePart.
    "ur:test/1-2/zz",
    "ur:test/1-2/",
    "ur:Test/1-2/zz",
    "ur:test/1-x/zz",
    // Payloads dcbor decides: a text with a leading U+FEFF, invalid UTF-8, float heads holding whole numbers.
    "ur:test/iewsrkrshsqzjllprp",
    "ur:test/idhszmvwynjkem",
    "ur:test/zsgwaeaeadjotbstce",
    "ur:test/zsgwlaaeaevavewpbk",
  ];
  for (const s of bad) yield { k: "urDecode", s };
}
export const MESSAGE_SIZES: number[] = [1, 30, 31, 100, 256, 1024, 4096];
export const MAX_LENS: number[] = [10, 30, 100, 1000];
/** The reference's own fountain fixture: a 46-byte text as a CBOR byte string, at most 10 bytes per part. */
export const FEAR_SPEC: MultipartSpec = {
  type: "bytes",
  cbor: h(
    "582e546865206f6e6c79207468696e67207765206861766520746f2066656172206973206665617220697473656c662e",
  ),
  maxLen: 10,
  parts: 60,
};
function specs(): MultipartSpec[] {
  const out: MultipartSpec[] = [];
  for (const size of MESSAGE_SIZES)
    for (const maxLen of MAX_LENS) {
      const fragments = Math.ceil(size / maxLen);
      // enough parts to reconstruct through drops: 3× the fragment count, capped
      out.push({
        type: "bytes",
        cbor: bstr(size, size & 0xff),
        maxLen,
        parts: Math.min(50, Math.max(20, 3 * fragments)),
      });
    }
  out.push({
    type: "bytes",
    cbor: h("5901" + "00" + WOLF_1024_HEX.slice(0, 512)),
    maxLen: 30,
    parts: 20,
  }); // Wolf 256
  out.push({ type: "bytes", cbor: h("590400" + WOLF_1024_HEX), maxLen: 100, parts: 40 }); // Wolf 1024
  out.push(FEAR_SPEC);
  out.push({
    type: "crypto-seed",
    cbor: tagged(40300, h("a10150" + hx(cycleBytes(16, 0x10)))),
    maxLen: 5,
    parts: 30,
  });
  return out;
}
export const SPECS: MultipartSpec[] = specs();
function* multipart(): Generator<Recipe> {
  for (const spec of SPECS) yield { k: "mpEncode", ...spec };
  for (const spec of SPECS) {
    yield { k: "mpDecode", from: spec, order: "forward" };
    yield { k: "mpDecode", from: spec, order: "reverse" };
    yield { k: "mpDecode", from: spec, order: { shuffle: 7 } };
    yield { k: "mpDecode", from: spec, order: { shuffle: 11 }, drop: 30 };
    yield { k: "mpDecode", from: spec, order: { shuffle: 23 }, drop: 50 };
  }
  // argument errors
  yield { k: "mpEncode", type: "bytes", cbor: bstr(10), maxLen: 0, parts: 1 };
  yield { k: "mpEncode", type: "bytes", cbor: bstr(0), maxLen: 10, parts: 1 };
  yield { k: "mpEncode", type: "Bad", cbor: bstr(10), maxLen: 10, parts: 1 };
}
function* decodeErrors(): Generator<Recipe> {
  const good = "ur:test/lsadaoaxjygonesw";
  const explicit: string[][] = [
    [good],
    [good, good],
    ["ur:other/lsadaoaxjygonesw", good],
    ["http://x"],
    ["ur:"],
    ["ur:/lsadaoaxjygonesw"],
    ["ur:Bad/lsadaoaxjygonesw"],
    ["ur:test/1-2/lsadaoaxjygonesw"], // multipart header with a single-part payload
    ["ur:test/1-2/" + STRINGS.arr123], // CBOR array but not a part
    ["ur:test/2-2/lsadaoaxjygonesw", "ur:test/1-2/lsadaoaxjygonesw"],
    ["ur:test/1-x/lsadaoaxjygonesw"],
    ["ur:test/abc/lsadaoaxjygonesw"],
    ["ur:test/1-2/3/lsadaoaxjygonesw"],
    [...SCAN.CHECKSUM_WRONG],
    [SCAN.NON_CANONICAL[0]],
  ];
  for (const parts of explicit) yield { k: "mpDecode", parts };
}

/**
 * Decoder acceptance and the JS-only input domain: padding, the empty
 * type, `maxFragmentLength`, part fields (on the wire and hand-built),
 * headers and case.
 */
function* domain(): Generator<Recipe> {
  yield { k: "urEncode", type: "", cbor: h("83010203") };
  yield { k: "urRoundtrip", type: "", cbor: h("83010203") };
  // `maxFragmentLength` (0 is in `multipart`)
  for (const maxLen of ["NaN", 1.5, "Infinity", -1] as Num[])
    yield { k: "mpEncode", type: "bytes", cbor: bstr(20), maxLen, parts: 1 };
  // The reference's `usize` past number precision: a bigint carries it, an unsafe number does not.
  for (const maxLen of [
    9007199254740992,
    "9007199254740992n",
    "18446744073709551615n",
    "18446744073709551616n",
  ] as Num[])
    yield { k: "mpEncode", type: "test", cbor: h("83010203"), maxLen, parts: 1 };
  // Part fields on the wire and hand-built
  const data5: Bytes = { cycle: 5, start: 1 };
  const part = (fields: [Num, Num, Num, Num]): PartFields => ({ fields, data: data5 });
  yield { k: "fountainDecode", part: part([2 ** 40, 1, 5, CRC_12345]), note: "u32-field" };
  yield { k: "fountainDecode", part: part([0, 1, 5, CRC_12345]), note: "seqNum-0" };
  yield { k: "fountainDecode", part: part([1, 1, 5, 2 ** 40]), note: "u32-checksum" };
  yield { k: "fountainDecode", part: part([-1, 1, 5, CRC_12345]), note: "negative" };
  yield { k: "fountainAdd", parts: [part([0, 1, 5, CRC_12345])], note: "seqNum-0" };
  yield { k: "fountainAdd", parts: [part([2 ** 40, 1, 5, CRC_12345])], note: "u32-seqNum" };
  yield { k: "fountainAdd", parts: [part(["NaN", 1, 5, CRC_12345])], note: "NaN" };
  yield { k: "fountainAdd", parts: [part([1.5, 2, 5, CRC_12345])], note: "fraction" };
  yield { k: "fountainAdd", parts: [part([1, 2 ** 40, 5, CRC_12345])], note: "u32-seqLen" };
  yield { k: "fountainAdd", parts: [part([1, 1, 2 ** 40, CRC_12345])], note: "u32-messageLen" };
  yield { k: "fountainAdd", parts: [part([1, 1, 5, 2 ** 40])], note: "u32-checksum" };
  yield { k: "fountainAdd", parts: [part([-1, 1, 5, CRC_12345])], note: "negative" };
  yield { k: "fountainAdd", parts: [part([1, 1, 5, CRC_12345])], note: "valid" };
  yield { k: "mpDecode", parts: [PARTS.U32_FIELD], note: "u32-field" };
  yield { k: "mpDecode", parts: [PARTS.SEQ0_FIELD], note: "seqNum-0" };
  // Padding
  yield { k: "mpDecode", parts: [PARTS.P1, PARTS.PADDED_2], note: "padded" };
  // Headers
  yield { k: "mpDecode", parts: [PARTS.P1_AS_2_2], note: "header-mismatch" };
  yield { k: "mpDecode", parts: [PARTS.BIG_HEADER], note: "oversize-header" };
  yield { k: "mpDecode", parts: [PARTS.PLUS_HEADER], note: "plus-header" };
  // Case: the reference's multipart decoder never lower-cases (its `from_ur_string` does).
  yield { k: "mpDecode", parts: [PARTS.P1.toUpperCase()], note: "upper-case" };
}

/**
 * Decoders observed step by step (every `add` result, `done` and `result`
 * after each part, with error messages), raw part CBOR, and completion
 * from a given start part.
 */
function* decoder(): Generator<Recipe> {
  yield { k: "mpScan", parts: ["ur:bytes/x-y/zz"], note: "malformed-indices-and-payload" };
  yield { k: "mpScan", parts: ["ur:bytes/65536-1/zz"], note: "oversize-index" };
  yield { k: "mpScan", parts: ["ur:test/1-x/zz"], note: "malformed-index" };
  yield { k: "mpScan", parts: [PARTS.P1, PARTS.P2], note: "two-parts" };
  yield {
    k: "mpScan",
    parts: ["ur:/1-1/lpadadahcyztdtdpfefefyadaoaxaabdgspkge"],
    note: "empty-type",
  };
  yield { k: "mpScan", parts: [...SCAN.QUEUE_NOT_DRAINED], note: "queue-not-drained" };
  yield { k: "mpScan", parts: [...SCAN.CHECKSUM_WRONG], note: "checksum-wrong" };
  yield { k: "mpScan", parts: [...SCAN.OVERWRITE_DERIVED], note: "overwrite-derived" };
  yield { k: "mpScan", parts: [...SCAN.EXTRA_FRAGMENT], note: "extra-fragment" };
  yield {
    k: "fountainScan",
    parts: [...FOUNTAIN_SCAN.OVERWRITE_DERIVED],
    note: "overwrite-derived",
  };
  yield {
    k: "fountainScan",
    parts: [...FOUNTAIN_SCAN.REVERSED_DUPLICATE],
    note: "reversed-duplicate",
  };
  for (const seq of FOUNTAIN_SEQUENCES) {
    yield { k: "fountainScan", parts: [...seq.parts], note: seq.name };
  }
  const nonCanonical = [
    "non-minimal-seqNum",
    "non-minimal-checksum",
    "non-minimal-array-length",
    "non-minimal-bytes-length",
    "trailing-byte",
  ];
  for (const [i, part] of SCAN.NON_CANONICAL.entries()) {
    yield { k: "mpScan", parts: [part], note: nonCanonical[i] };
  }
  const malformed = ["indefinite-array", "indefinite-bytes", "array-of-4", "text-data"];
  for (const [i, part] of SCAN.MALFORMED_PART.entries()) {
    yield { k: "mpScan", parts: [part], note: malformed[i] };
  }
  // Case, the reference's check order, and every string after completion.
  yield { k: "mpScan", parts: [PARTS.SINGLE.toUpperCase()], note: "upper-case" };
  yield { k: "mpScan", parts: ["UR:" + PARTS.P1.slice(3)], note: "upper-case-scheme" };
  yield {
    k: "mpScan",
    parts: [PARTS.P1.replace("ur:bytes/", "ur:BYTES/")],
    note: "upper-case-type",
  };
  yield { k: "mpScan", parts: ["ur:Bad/lsadaoaxjygonesw"], note: "invalid-type" };
  yield { k: "mpScan", parts: ["ur:"], note: "scheme-only" };
  yield { k: "mpScan", parts: ["ur:/lsadaoaxjygonesw"], note: "empty-type-single-part" };
  yield { k: "mpScan", parts: ["ur:test"], note: "type-only" };
  yield { k: "mpScan", parts: ["ur:bytes/zz"], note: "single-part-bad-bytewords" };
  yield { k: "mpScan", parts: ["ur:bytes/1-1/zz"], note: "header-then-bad-bytewords" };
  yield { k: "mpScan", parts: ["ur:test/"], note: "single-part-empty-payload" };
  yield { k: "mpScan", parts: ["ur:test/1-2/"], note: "multipart-empty-payload" };
  yield {
    k: "mpScan",
    parts: [
      PARTS.SINGLE,
      "http://x",
      "ur:other/1-1/lpadadahcyztdtdpfefefyadaoaxaabdgspkge",
      "ur:bytes/1-1/zz",
      "ur:bytes/lsadaoaxjygonesw",
      "ur:bytes",
    ],
    note: "after-complete",
  };
  yield {
    k: "mpScan",
    parts: [PARTS.P1, PARTS.PADDED_2, PARTS.PADDED_2, "http://x"],
    note: "padding-then-more",
  };
  yield {
    k: "mpScan",
    parts: [PARTS.BAD_CBOR_MESSAGE, PARTS.BAD_CBOR_MESSAGE],
    note: "bad-cbor-message",
  };
  yield { k: "mpScan", parts: ["ur:aaa/zz", PARTS.SINGLE], note: "failed-first-part-sets-type" };
  yield { k: "mpScan", parts: [...SCAN.SEQ0_THEN_GOOD], note: "seqNum-0-then-good" };
  yield { k: "mpScan", parts: [PARTS.SEQ0_FIELD], note: "seqNum-0-single" };
  yield { k: "mpScan", parts: [...SCAN.LEN_EXCEEDS], note: "len-exceeds" };
  yield { k: "mpScan", parts: [PARTS.INVALID_UTF8_MESSAGE], note: "invalid-utf8-message" };
  yield { k: "mpScan", parts: [PARTS.BOM_MESSAGE], note: "bom-message" };
  for (const row of PART_CBOR_ROWS) {
    yield { k: "fountainDecodeHex", hex: row.hex, note: row.note };
  }
  yield { k: "mpDecodeFrom", from: FEAR_SPEC, skipBefore: 1 };
  yield { k: "mpDecodeFrom", from: FEAR_SPEC, skipBefore: 51 };
  yield { k: "mpDecodeFrom", from: FEAR_SPEC, skipBefore: 101 };
  yield { k: "mpDecodeFrom", from: FEAR_SPEC, skipBefore: 501 };
}

const SEED_TAGS: TagSpec[] = [
  { value: 40300, name: "seed" },
  { value: 300, name: "crypto-seed" },
];
const SEED_UR = "ur:seed/lsadaoaxjygonesw";
/** `expectType`, and the dcbor bridge (`urFor`, `decodeURWith`) including the codecs the reference panics on. */
function* codable(): Generator<Recipe> {
  const good = "ur:test/lsadaoaxjygonesw";
  yield { k: "urCheckType", s: good, type: "test" };
  yield { k: "urCheckType", s: good, type: "other" };
  yield { k: "urCheckType", s: good, type: "Test" };
  yield { k: "urCheckType", s: good, type: "" };
  yield { k: "urFor", tags: SEED_TAGS, content: h("83010203") };
  yield { k: "urFor", tags: [], content: h("83010203") };
  yield { k: "urFor", tags: [{ value: 999 }], content: h("83010203") };
  yield { k: "urFor", tags: [{ value: 40300, name: "Seed" }], content: h("83010203") };
  yield { k: "urFor", tags: [{ value: 40300, name: "" }], content: h("83010203") };
  yield { k: "decodeURWith", tags: SEED_TAGS, s: SEED_UR };
  yield { k: "decodeURWith", tags: SEED_TAGS, s: "ur:crypto-seed/lsadaoaxjygonesw" };
  yield { k: "decodeURWith", tags: SEED_TAGS, s: "ur:other/lsadaoaxjygonesw" };
  yield { k: "decodeURWith", tags: [{ value: 40300, name: "Seed" }], s: SEED_UR };
  yield { k: "decodeURWith", tags: [], s: SEED_UR };
  yield { k: "decodeURWith", tags: [{ value: 999 }], s: SEED_UR };
}

export const categories: Record<string, () => Generator<Recipe>> = {
  bytewords,
  ur,
  multipart,
  decodeErrors,
  domain,
  decoder,
  codable,
};
export function* allRecipes(): Generator<Recipe> {
  for (const g of Object.values(categories)) yield* g();
}
/** Golden subset. */
export function* goldenRecipes(): Generator<Recipe> {
  const lens = new Set([0, 1, 2, 3, 4, 5, 10, 31, 32, 33, 100, 255, 256, 300]);
  for (const r of bytewords()) {
    if (r.k === "bwEncode" || r.k === "bwRoundtrip") {
      if (lens.has((r.data as { cycle: number }).cycle)) yield r;
    } else if (r.k === "bwPlain") {
      if (lens.has((r.data as { cycle: number }).cycle)) yield r;
    } else yield r;
  }
  for (const r of ur()) {
    if ((r.k === "urEncode" || r.k === "urRoundtrip") && !["bytes", "test", "x-1"].includes(r.type))
      continue;
    yield r;
  }
  yield* multipart();
  yield* decodeErrors();
  yield* domain();
  yield* decoder();
  yield* codable();
}
