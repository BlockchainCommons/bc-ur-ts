/**
 * Deterministic differential corpus (Phase 1.3). Pure: CBOR inputs are built
 * by a tiny header writer here, never by the package under test.
 */
import type { Recipe, Bytes, Style, PlainFn, MultipartSpec } from "../vectors/recipes";
import { STRINGS, WOLF_1024_HEX } from "./fixtures";

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
    "http://test/lsadaoaxjygonesw",
    "ur:test/" + STRINGS.badCborBreak,
    "ur:test/" + STRINGS.badCborTruncated,
    "ur:test/" + STRINGS.nonCanonical,
    "ur:bytes/" + STRINGS.arr123,
    good,
  ];
  for (const s of bad) yield { k: "urDecode", s };
}
export const MESSAGE_SIZES: number[] = [1, 30, 31, 100, 256, 1024, 4096];
export const MAX_LENS: number[] = [10, 30, 100, 1000];
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
  out.push({
    type: "bytes",
    cbor: h(
      "582e546865206f6e6c79207468696e67207765206861766520746f2066656172206973206665617220697473656c662e",
    ),
    maxLen: 10,
    parts: 60,
  });
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
  ];
  for (const parts of explicit) yield { k: "mpDecode", parts };
}

export const categories: Record<string, () => Generator<Recipe>> = {
  bytewords,
  ur,
  multipart,
  decodeErrors,
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
}
