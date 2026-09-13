/**
 * Bytewords (BCR-2020-012): bytes as four-letter words, dash-joined words,
 * or two-letter minimal codes, each with a trailing CRC-32; plus the
 * checksum-free identifier encodings (words, minimal, bytemojis).
 *
 * @module @blockchaincommons/uniform-resources/bytewords
 */
import { crc32 } from "@blockchaincommons/crypto";
import { URError } from "./error.js";
import { BYTEWORDS, BYTEMOJIS } from "./bytewords-tables.js";

export { BYTEWORDS, BYTEMOJIS };

/** The three checksummed encodings. */
export type BytewordsStyle = "standard" | "uri" | "minimal";
/** The three checksum-free identifier encodings. */
export type IdentifierStyle = "standard" | "minimal" | "bytemoji";

/** Options for `identifier` and `shortIdentifier`. */
export interface IdentifierOptions {
  /** Default `"standard"`. */
  readonly style?: IdentifierStyle | undefined;
}

// Precomputed per-byte spellings and reverse lookups.
const MINIMAL: readonly string[] = BYTEWORDS.map((w) => w[0] + w[3]);
const WORD_INDEX: ReadonlyMap<string, number> = new Map(BYTEWORDS.map((w, i) => [w, i]));
// Minimal codes keyed by (first char << 8 | last char); -1 = not a code.
const MINIMAL_INDEX = new Int16Array(65536).fill(-1);
for (let i = 0; i < 256; i++) {
  const w = BYTEWORDS[i];
  MINIMAL_INDEX[(w.charCodeAt(0) << 8) | w.charCodeAt(3)] = i;
}
const BYTEMOJI_SET: ReadonlySet<string> = new Set(BYTEMOJIS);
const FIRST_LAST: ReadonlyMap<string, string> = new Map(BYTEWORDS.map((w) => [w[0] + w[3], w]));
const FIRST_THREE: ReadonlyMap<string, string> = new Map(BYTEWORDS.map((w) => [w.slice(0, 3), w]));
const LAST_THREE: ReadonlyMap<string, string> = new Map(BYTEWORDS.map((w) => [w.slice(1), w]));

function withChecksum(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 4);
  out.set(data);
  new DataView(out.buffer).setUint32(data.length, crc32(data), false);
  return out;
}

/** Encode `data` followed by its CRC-32 (big-endian) in `style` (default minimal). */
export function encodeBytewords(data: Uint8Array, style: BytewordsStyle = "minimal"): string {
  const bytes = withChecksum(data);
  if (style === "minimal") {
    let out = "";
    for (const b of bytes) out += MINIMAL[b];
    return out;
  }
  const words: string[] = [];
  for (const b of bytes) words.push(BYTEWORDS[b]);
  return words.join(style === "standard" ? " " : "-");
}

/**
 * Decode a lower-case bytewords string in `style`, verifying and stripping
 * the CRC-32. Case-sensitive, as the reference's `bytewords::decode`; the
 * UR parsers lower-case a whole UR string before reaching here.
 * @throws {URError} `Bytewords` for non-ASCII input, an unknown word (an
 * upper-case letter makes one), an odd-length minimal string, or a checksum
 * mismatch.
 */
export function decodeBytewords(
  encoded: string,
  style: BytewordsStyle = "minimal",
): Uint8Array<ArrayBuffer> {
  for (let i = 0; i < encoded.length; i++) {
    if (encoded.charCodeAt(i) > 0x7f)
      throw URError.bytewords("bytewords string contains non-ASCII characters");
  }
  // Case-sensitive, as the reference's `bytewords::decode` (its word tables
  // are lower-case only). UR parsing lower-cases the whole UR string first,
  // as `UR::from_ur_string` does; a bare bytewords string is not a UR.
  const s = encoded;
  let bytes: Uint8Array;
  if (style === "minimal") {
    if (s.length % 2 !== 0) throw URError.bytewords("invalid length");
    bytes = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length; i += 2) {
      const index = MINIMAL_INDEX[(s.charCodeAt(i) << 8) | s.charCodeAt(i + 1)];
      if (index < 0) throw URError.bytewords("invalid word");
      bytes[i / 2] = index;
    }
  } else {
    const words = s.split(style === "standard" ? " " : "-");
    bytes = new Uint8Array(words.length);
    for (let i = 0; i < words.length; i++) {
      const index = WORD_INDEX.get(words[i]);
      if (index === undefined) throw URError.bytewords("invalid word");
      bytes[i] = index;
    }
  }
  if (bytes.length < 4) throw URError.bytewords("invalid checksum");
  const data = bytes.slice(0, -4);
  const expected = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4).getUint32(
    0,
    false,
  );
  if (crc32(data) !== expected) throw URError.bytewords("invalid checksum");
  return data;
}

/**
 * Checksum-free spelling of `data`: space-separated words (`standard`),
 * concatenated two-letter codes (`minimal`), or space-separated bytemojis.
 */
export function identifier(data: Uint8Array, options?: IdentifierOptions): string {
  const style = options?.style ?? "standard";
  if (style === "minimal") {
    let out = "";
    for (const b of data) out += MINIMAL[b];
    return out;
  }
  const table = style === "bytemoji" ? BYTEMOJIS : BYTEWORDS;
  const parts: string[] = [];
  for (const b of data) parts.push(table[b]);
  return parts.join(" ");
}

/**
 * `identifier` for exactly four bytes, the form used for the short
 * identifiers of digests and keys.
 * @throws {URError} `InvalidParameter` when `data` is not 4 bytes.
 */
export function shortIdentifier(data: Uint8Array, options?: IdentifierOptions): string {
  if (data.length !== 4) {
    throw URError.invalidParameter("data", data.length, "exactly 4 bytes");
  }
  return identifier(data, options);
}

/** Whether `emoji` is one of the 256 bytemojis. */
export function isValidBytemoji(emoji: string): boolean {
  return BYTEMOJI_SET.has(emoji);
}

/**
 * The full byteword for a token given as a whole word, its first+last
 * letters, or its first or last three letters (any case); `undefined` if it
 * names none.
 */
export function canonicalizeByteword(token: string): string | undefined {
  const lower = token.toLowerCase();
  switch (lower.length) {
    case 4:
      return WORD_INDEX.has(lower) ? lower : undefined;
    case 2:
      return FIRST_LAST.get(lower);
    case 3:
      return FIRST_THREE.get(lower) ?? LAST_THREE.get(lower);
    default:
      return undefined;
  }
}
