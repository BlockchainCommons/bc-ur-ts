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
import { WORD_INDEX, decodeBytewordsOrReason } from "./bytewords-decode.js";
import { expectBytes, expectChoice, expectString } from "./domain.js";

const BYTEWORDS_STYLES = ["standard", "uri", "minimal"] as const;
const IDENTIFIER_STYLES = ["standard", "minimal", "bytemoji"] as const;

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

/**
 * Encode `data` followed by its CRC-32 (big-endian) in `style` (default minimal).
 * @throws {URError} `InvalidParameter` unless `data` is a `Uint8Array` and `style` one of the three.
 */
export function encodeBytewords(data: Uint8Array, style: BytewordsStyle = "minimal"): string {
  expectBytes("data", data);
  expectChoice("style", style, BYTEWORDS_STYLES, "minimal");
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
 * single-part UR parser lower-cases a whole UR string before reaching here.
 * @throws {URError} `Bytewords` for non-ASCII input, an odd-length minimal
 * string, an unknown word (an upper-case letter makes one), or a checksum
 * mismatch, checked in that order.
 */
export function decodeBytewords(
  encoded: string,
  style: BytewordsStyle = "minimal",
): Uint8Array<ArrayBuffer> {
  expectString("encoded", encoded);
  expectChoice("style", style, BYTEWORDS_STYLES, "minimal");
  const decoded = decodeBytewordsOrReason(encoded, style);
  if (typeof decoded === "string") throw URError.bytewords(decoded);
  return decoded;
}

/**
 * Checksum-free spelling of `data`: space-separated words (`standard`),
 * concatenated two-letter codes (`minimal`), or space-separated bytemojis.
 * @throws {URError} `InvalidParameter` unless `data` is a `Uint8Array` and the style one of the three.
 */
export function identifier(data: Uint8Array, options?: IdentifierOptions): string {
  expectBytes("data", data);
  const style = expectChoice("style", options?.style, IDENTIFIER_STYLES, "standard");
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
  expectBytes("data", data);
  if (data.length !== 4) {
    throw URError.invalidParameter("data", data.length, "exactly 4 bytes");
  }
  return identifier(data, options);
}

/** Whether `emoji` is one of the 256 bytemojis. @throws {URError} `InvalidParameter` for a non-string. */
export function isValidBytemoji(emoji: string): boolean {
  return BYTEMOJI_SET.has(expectString("emoji", emoji));
}

/**
 * The full byteword for a token given as a whole word, its first+last
 * letters, or its first or last three letters (ASCII letters in any case);
 * `undefined` if it names none.
 * @throws {URError} `InvalidParameter` for a non-string.
 */
export function canonicalizeByteword(token: string): string | undefined {
  expectString("token", token);
  // The reference lower-cases ASCII letters only and looks the token up in
  // ASCII-keyed tables, so a token with any non-ASCII character names nothing.
  let lower = "";
  for (let i = 0; i < token.length; i++) {
    const c = token.charCodeAt(i);
    if (c > 0x7f) return undefined;
    lower += c >= 0x41 && c <= 0x5a ? String.fromCharCode(c + 32) : token[i];
  }
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
