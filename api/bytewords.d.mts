//#region src/bytewords-tables.d.ts
/**
 * The 256 bytewords (BCR-2020-012) and the 256 bytemojis, in byte order.
 * Wire: every UR and every bytewords identifier is spelled from these.
 *
 * @module bytewords-tables
 */
/** Byteword for each byte value; four letters, unique first+last pair. Frozen: the tables are wire. */
export declare const BYTEWORDS: readonly string[];
/** Bytemoji for each byte value. Frozen: the tables are wire. */
export declare const BYTEMOJIS: readonly string[];
//#endregion
//#region src/bytewords.d.ts
/** The three checksummed encodings. */
export type BytewordsStyle = "standard" | "uri" | "minimal";
/** The three checksum-free identifier encodings. */
export type IdentifierStyle = "standard" | "minimal" | "bytemoji";
/** Options for `identifier` and `shortIdentifier`. */
export interface IdentifierOptions {
  /** Default `"standard"`. */
  readonly style?: IdentifierStyle | undefined;
}
/**
 * Encode `data` followed by its CRC-32 (big-endian) in `style` (default minimal).
 * @throws {URError} `InvalidParameter` unless `data` is a `Uint8Array` and `style` one of the three.
 */
export declare function encodeBytewords(data: Uint8Array, style?: BytewordsStyle): string;
/**
 * Decode a lower-case bytewords string in `style`, verifying and stripping
 * the CRC-32. Case-sensitive, as the reference's `bytewords::decode`; the
 * single-part UR parser lower-cases a whole UR string before reaching here.
 * @throws {URError} `Bytewords` for non-ASCII input, an odd-length minimal
 * string, an unknown word (an upper-case letter makes one), or a checksum
 * mismatch, checked in that order.
 */
export declare function decodeBytewords(encoded: string, style?: BytewordsStyle): Uint8Array<ArrayBuffer>;
/**
 * Checksum-free spelling of `data`: space-separated words (`standard`),
 * concatenated two-letter codes (`minimal`), or space-separated bytemojis.
 * @throws {URError} `InvalidParameter` unless `data` is a `Uint8Array` and the style one of the three.
 */
export declare function identifier(data: Uint8Array, options?: IdentifierOptions): string;
/**
 * `identifier` for exactly four bytes, the form used for the short
 * identifiers of digests and keys.
 * @throws {URError} `InvalidParameter` when `data` is not 4 bytes.
 */
export declare function shortIdentifier(data: Uint8Array, options?: IdentifierOptions): string;
/** Whether `emoji` is one of the 256 bytemojis. @throws {URError} `InvalidParameter` for a non-string. */
export declare function isValidBytemoji(emoji: string): boolean;
/**
 * The full byteword for a token given as a whole word, its first+last
 * letters, or its first or last three letters (ASCII letters in any case);
 * `undefined` if it names none.
 * @throws {URError} `InvalidParameter` for a non-string.
 */
export declare function canonicalizeByteword(token: string): string | undefined;
//#endregion
//# sourceMappingURL=bytewords.d.mts.map