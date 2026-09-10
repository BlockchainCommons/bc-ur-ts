//#region src/bytewords-tables.d.ts
/**
 * The 256 bytewords (BCR-2020-012) and the 256 bytemojis, in byte order.
 * Wire: every UR and every bytewords identifier is spelled from these.
 *
 * @module bytewords-tables
 */
/** Byteword for each byte value; four letters, unique first+last pair. */
declare const BYTEWORDS: readonly string[];
/** Bytemoji for each byte value. */
declare const BYTEMOJIS: readonly string[];
//#endregion
//#region src/bytewords.d.ts
/** The three checksummed encodings. */
type BytewordsStyle = "standard" | "uri" | "minimal";
/** The three checksum-free identifier encodings. */
type IdentifierStyle = "standard" | "minimal" | "bytemoji";
/** Options for `identifier` and `shortIdentifier`. */
interface IdentifierOptions {
  /** Default `"standard"`. */
  readonly style?: IdentifierStyle | undefined;
}
/** Encode `data` followed by its CRC-32 (big-endian) in `style` (default minimal). */
declare function encodeBytewords(data: Uint8Array, style?: BytewordsStyle): string;
/**
 * Decode a bytewords string (any case) in `style`, verifying and stripping
 * the CRC-32.
 * @throws {URError} `Bytewords` for non-ASCII input, an unknown word, an
 * odd-length minimal string, or a checksum mismatch.
 */
declare function decodeBytewords(encoded: string, style?: BytewordsStyle): Uint8Array<ArrayBuffer>;
/**
 * Checksum-free spelling of `data`: space-separated words (`standard`),
 * concatenated two-letter codes (`minimal`), or space-separated bytemojis.
 */
declare function identifier(data: Uint8Array, options?: IdentifierOptions): string;
/**
 * `identifier` for exactly four bytes, the form used for the short
 * identifiers of digests and keys.
 * @throws {RangeError} when `data` is not 4 bytes.
 */
declare function shortIdentifier(data: Uint8Array, options?: IdentifierOptions): string;
/** Whether `emoji` is one of the 256 bytemojis. */
declare function isValidBytemoji(emoji: string): boolean;
/**
 * The full byteword for a token given as a whole word, its first+last
 * letters, or its first or last three letters (any case); `undefined` if it
 * names none.
 */
declare function canonicalizeByteword(token: string): string | undefined;
//#endregion
export { BYTEMOJIS, BYTEWORDS, BytewordsStyle, IdentifierOptions, IdentifierStyle, canonicalizeByteword, decodeBytewords, encodeBytewords, identifier, isValidBytemoji, shortIdentifier };
//# sourceMappingURL=bytewords.d.mts.map