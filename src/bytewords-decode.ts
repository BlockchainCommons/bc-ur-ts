/**
 * Bytewords decoding shared by the public `decodeBytewords` and the UR
 * parsers, which report a failure under different error codes (`Bytewords`
 * from `decodeBytewords`, `Decoder` inside a UR string, as the reference's
 * `bytewords::decode` and `ur::decode` do).
 *
 * @internal
 * @module bytewords-decode
 */
import { crc32 } from "@blockchaincommons/crypto";
import { BYTEWORDS } from "./bytewords-tables.js";
import type { BytewordsStyle } from "./bytewords.js";

/** Why a bytewords string does not decode, in the reference's words. */
export type BytewordsFailure =
  | "invalid word"
  | "invalid checksum"
  | "invalid length"
  | "bytewords string contains non-ASCII characters";

/** Byte value by full word. */
export const WORD_INDEX: ReadonlyMap<string, number> = new Map(BYTEWORDS.map((w, i) => [w, i]));
// Minimal codes keyed by (first char << 8 | last char); -1 = not a code.
const MINIMAL_INDEX = new Int16Array(65536).fill(-1);
for (let i = 0; i < 256; i++) {
  const w = BYTEWORDS[i];
  MINIMAL_INDEX[(w.charCodeAt(0) << 8) | w.charCodeAt(3)] = i;
}

/**
 * Decode `encoded` in `style`, verifying and stripping the CRC-32, or
 * return the reason it fails. The checks run in the reference's order:
 * non-ASCII input, an odd-length minimal string, an unknown word, then the
 * checksum, which a string of fewer than four bytes always fails.
 */
export function decodeBytewordsOrReason(
  encoded: string,
  style: BytewordsStyle,
): Uint8Array<ArrayBuffer> | BytewordsFailure {
  for (let i = 0; i < encoded.length; i++) {
    if (encoded.charCodeAt(i) > 0x7f) return "bytewords string contains non-ASCII characters";
  }
  let bytes: Uint8Array<ArrayBuffer>;
  if (style === "minimal") {
    if (encoded.length % 2 !== 0) return "invalid length";
    bytes = new Uint8Array(encoded.length / 2);
    for (let i = 0; i < encoded.length; i += 2) {
      const index = MINIMAL_INDEX[(encoded.charCodeAt(i) << 8) | encoded.charCodeAt(i + 1)];
      if (index < 0) return "invalid word";
      bytes[i / 2] = index;
    }
  } else {
    const words = encoded.split(style === "standard" ? " " : "-");
    bytes = new Uint8Array(words.length);
    for (let i = 0; i < words.length; i++) {
      const index = WORD_INDEX.get(words[i]);
      if (index === undefined) return "invalid word";
      bytes[i] = index;
    }
  }
  if (bytes.length < 4) return "invalid checksum";
  const data = bytes.slice(0, -4);
  const expected = new DataView(bytes.buffer, bytes.length - 4).getUint32(0, false);
  if (crc32(data) !== expected) return "invalid checksum";
  return data;
}
