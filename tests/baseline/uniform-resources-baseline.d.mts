import { Cbor, CborTaggedDecodable, CborTaggedEncodable } from "@blockchaincommons/dcbor-compat";
//#region src/error.d.ts
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Error type for UR encoding/decoding operations.
 */
declare class URError extends Error {
  constructor(message: string);
}
/**
 * Error type for invalid UR schemes.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `invalid UR scheme`.
 */
declare class InvalidSchemeError extends URError {
  constructor();
}
/**
 * Error type for unspecified UR types.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `no UR type specified`.
 */
declare class TypeUnspecifiedError extends URError {
  constructor();
}
/**
 * Error type for invalid UR types.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `invalid UR type`.
 */
declare class InvalidTypeError extends URError {
  constructor();
}
/**
 * Error type for non-single-part URs.
 */
declare class NotSinglePartError extends URError {
  constructor();
}
/**
 * Error type for unexpected UR types.
 *
 * Message matches Rust bc-ur-rust/src/error.rs:
 * `expected UR type {expected}, but found {found}`.
 */
declare class UnexpectedTypeError extends URError {
  constructor(expected: string, found: string);
}
/**
 * Error type for Bytewords encoding/decoding errors.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `Bytewords error ({0})`.
 */
declare class BytewordsError extends URError {
  constructor(message: string);
}
/**
 * Error type for CBOR encoding/decoding errors.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `CBOR error ({0})`.
 */
declare class CBORError extends URError {
  constructor(message: string);
}
/**
 * Error type for UR decoder errors.
 * Matches Rust's Error::UR(String) variant.
 */
declare class URDecodeError extends URError {
  constructor(message: string);
}
type Result<T> = T | Error;
/**
 * Helper function to check if a result is an error.
 */
declare function isError(result: unknown): result is Error;
//#endregion
//#region src/ur-type.d.ts
/**
 * Represents a UR (Uniform Resource) type identifier.
 *
 * Valid UR types contain only lowercase letters, digits, and hyphens.
 *
 * @example
 * ```typescript
 * const urType = new URType('test');
 * console.log(urType.string()); // "test"
 * ```
 */
declare class URType {
  private readonly _type;
  /**
   * Creates a new URType from the provided type string.
   *
   * @param urType - The UR type as a string
   * @throws {InvalidTypeError} If the type contains invalid characters
   *
   * @example
   * ```typescript
   * const urType = new URType('test');
   * ```
   */
  constructor(urType: string);
  /**
   * Returns the string representation of the URType.
   *
   * @example
   * ```typescript
   * const urType = new URType('test');
   * console.log(urType.string()); // "test"
   * ```
   */
  string(): string;
  /**
   * Checks equality with another URType based on the type string.
   */
  equals(other: URType): boolean;
  /**
   * Returns the string representation.
   */
  toString(): string;
  /**
   * Creates a URType from a string, throwing an error if invalid.
   *
   * @param value - The UR type string
   * @returns A new URType instance
   * @throws {InvalidTypeError} If the type is invalid
   */
  static from(value: string): URType;
  /**
   * Safely creates a URType, returning a typed `Result`-shaped
   * discriminated union instead of throwing.
   *
   * Mirrors Rust `impl TryFrom<&str> for URType` /
   * `impl TryFrom<String> for URType` (`bc-ur-rust/src/ur_type.rs`),
   * which return `Result<URType, Error>`. The TS shape is the
   * idiomatic discriminated form so callers can branch on `ok`
   * without `instanceof`:
   *
   * @example
   * ```typescript
   * const r = URType.tryFrom("test");
   * if (r.ok) {
   *   console.log(r.value.string()); // "test"
   * } else {
   *   console.error(r.error.message);
   * }
   * ```
   *
   * @param value - The UR type string
   * @returns A typed Result: `{ ok: true; value: URType }` on success,
   *   `{ ok: false; error: InvalidTypeError }` on failure.
   */
  static tryFrom(value: string): {
    ok: true;
    value: URType;
  } | {
    ok: false;
    error: InvalidTypeError;
  };
}
//#endregion
//#region src/ur.d.ts
/**
 * A Uniform Resource (UR) is a URI-encoded CBOR object.
 *
 * URs are defined in [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).
 *
 * @example
 * ```typescript
 * import { UR } from '@blockchaincommons/uniform-resources';
 * import { CBOR } from '@blockchaincommons/dcbor-compat';
 *
 * // Create a UR from a CBOR object
 * const cbor = CBOR.fromArray([1, 2, 3]);
 * const ur = UR.new('test', cbor);
 *
 * // Encode to string
 * const urString = ur.string();
 * console.log(urString); // "ur:test/..."
 *
 * // Decode from string
 * const decodedUR = UR.fromURString(urString);
 * console.log(decodedUR.urTypeStr()); // "test"
 * ```
 */
declare class UR {
  private readonly _urType;
  private readonly _cbor;
  /**
   * Creates a new UR from the provided type and CBOR data.
   *
   * @param urType - The UR type (will be validated)
   * @param cbor - The CBOR data to encode
   * @throws {InvalidTypeError} If the type is invalid
   *
   * @example
   * ```typescript
   * const ur = UR.new('bytes', CBOR.fromString('hello'));
   * ```
   */
  static new(urType: string | URType, cbor: Cbor): UR;
  /**
   * Creates a new UR from a UR string.
   *
   * Mirrors Rust's `UR::from_ur_string` (`bc-ur-rust/src/ur.rs:25-38`):
   * 1. lowercase the entire string.
   * 2. strip the `"ur:"` prefix → {@link InvalidSchemeError} if absent.
   * 3. split on the first `/` → {@link TypeUnspecifiedError} if absent.
   * 4. validate the type via {@link URType} → {@link InvalidTypeError}.
   * 5. delegate the data section to the upstream-style decoder, which
   *    classifies the UR as single- or multi-part. Multi-part input is
   *    rejected with {@link NotSinglePartError}.
   * 6. decode the bytewords payload (CRC32 + minimal mapping) →
   *    {@link BytewordsError} on failure.
   * 7. parse the resulting bytes as CBOR → {@link CBORError} on failure.
   *
   * @param urString - A UR string like "ur:test/..."
   * @throws {InvalidSchemeError} If the string doesn't start with "ur:"
   * @throws {TypeUnspecifiedError} If no `/` separator is present
   * @throws {InvalidTypeError} If the type contains invalid characters
   * @throws {NotSinglePartError} If the UR is multi-part
   * @throws {URDecodeError} For upstream-decoder errors (invalid indices, etc.)
   * @throws {BytewordsError} If bytewords decoding fails
   * @throws {CBORError} If CBOR parsing fails
   *
   * @example
   * ```typescript
   * const ur = UR.fromURString('ur:test/lsadaoaxjygonesw');
   * ```
   */
  static fromURString(urString: string): UR;
  private constructor();
  /**
   * Returns the UR type.
   */
  urType(): URType;
  /**
   * Returns the UR type as a string.
   */
  urTypeStr(): string;
  /**
   * Returns the CBOR data.
   */
  cbor(): Cbor;
  /**
   * Returns the string representation of the UR (lowercase, suitable for display).
   *
   * @example
   * ```typescript
   * const ur = UR.new('test', CBOR.fromArray([1, 2, 3]));
   * console.log(ur.string()); // "ur:test/lsadaoaxjygonesw"
   * ```
   */
  string(): string;
  /**
   * Returns the QR string representation (uppercase, most efficient for QR codes).
   */
  qrString(): string;
  /**
   * Returns the QR data as bytes (uppercase UR string as UTF-8).
   *
   * Mirrors Rust's `UR::qr_data` (`ur.rs:52`) which does
   * `self.qr_string().as_bytes().to_vec()` — the string's UTF-8 byte
   * representation. We use `TextEncoder` rather than per-codepoint
   * truncation so the behaviour stays correct if the QR string ever
   * contains non-ASCII characters.
   */
  qrData(): Uint8Array;
  /**
   * Checks if the UR type matches the expected type.
   *
   * @param expectedType - The expected type
   * @throws {UnexpectedTypeError} If the types don't match
   */
  checkType(expectedType: string | URType): void;
  /**
   * Returns the string representation.
   */
  toString(): string;
  /**
   * Checks equality with another UR.
   *
   * Mirrors Rust's derived `PartialEq for UR` which compares the inner
   * `ur_type` and the inner `cbor` field directly. We compare CBOR
   * bytewise — `Uint8Array` equality, not `Array#toString` (which would
   * coerce to a comma-joined string and could collide on pathological
   * inputs).
   */
  equals(other: UR): boolean;
}
//#endregion
//#region src/ur-encodable.d.ts
/**
 * A type that can be encoded to a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to convert themselves
 * to CBOR data and associate that with a UR type identifier.
 *
 * Mirrors Rust's `UREncodable` trait (`bc-ur-rust/src/ur_encodable.rs`),
 * which has a blanket impl `impl<T> UREncodable for T where T:
 * CBORTaggedEncodable`. TypeScript has no equivalent of blanket impls, so
 * implementers either write `ur()` / `urString()` directly *or* — for a
 * type that already implements `CborTaggedEncodable` — call the helper
 * functions {@link urFromEncodable} / {@link urStringFromEncodable} below
 * to get the same auto-derivation that Rust provides for free.
 *
 * @example
 * ```typescript
 * class MyType implements UREncodable, CborTaggedEncodable {
 *   cborTags(): Tag[] {
 *     return [createTag(40000, "mytype")];
 *   }
 *
 *   untaggedCbor(): Cbor { ... }
 *   taggedCbor(): Cbor { return createTaggedCbor(this); }
 *
 *   // Auto-derived from the first cbor tag's name, just like Rust.
 *   ur(): UR { return urFromEncodable(this); }
 *   urString(): string { return urStringFromEncodable(this); }
 * }
 * ```
 */
interface UREncodable {
  /**
   * Returns the UR representation of the object.
   */
  ur(): UR;
  /**
   * Returns the UR string representation of the object.
   */
  urString(): string;
}
/**
 * Concrete equivalent of Rust's default `UREncodable::ur` impl
 * (`bc-ur-rust/src/ur_encodable.rs:8-18`):
 *
 * - Reads the first tag returned by `encodable.cborTags()`.
 * - Uses that tag's `name` as the UR type, throwing if no name is set —
 *   matching Rust's `panic!("CBOR tag {} must have a name. Did you call
 *   `register_tags()`?", tag.value())`.
 * - Wraps the encodable's `untaggedCbor()` in a fresh {@link UR} bound to
 *   that type.
 *
 * Use from a class implementing both `UREncodable` and
 * `CborTaggedEncodable` to skip writing the boilerplate yourself.
 */
declare function urFromEncodable(encodable: CborTaggedEncodable): UR;
/**
 * Concrete equivalent of Rust's default `UREncodable::ur_string` impl
 * (`bc-ur-rust/src/ur_encodable.rs:21`): `self.ur().string()`.
 */
declare function urStringFromEncodable(encodable: CborTaggedEncodable): string;
/**
 * Helper function to check if an object implements UREncodable.
 */
declare function isUREncodable(obj: unknown): obj is UREncodable;
//#endregion
//#region src/ur-decodable.d.ts
/**
 * A type that can be decoded from a UR (Uniform Resource).
 *
 * Types implementing this interface should be able to create themselves
 * from a UR containing their data.
 *
 * Mirrors Rust's `URDecodable` trait (`bc-ur-rust/src/ur_decodable.rs`),
 * which has a blanket impl `impl<T> URDecodable for T where T:
 * CBORTaggedDecodable`. TypeScript has no equivalent of blanket impls, so
 * implementers either write `fromUR()` directly *or* — for a type that
 * already implements `CborTaggedDecodable` — call the helper functions
 * {@link decodableFromUR} / {@link decodableFromURString} below to get the
 * same auto-derivation that Rust provides for free.
 *
 * @example
 * ```typescript
 * class MyType implements URDecodable, CborTaggedDecodable<MyType> {
 *   cborTags(): Tag[] {
 *     return [createTag(40000, "mytype")];
 *   }
 *   fromUntaggedCbor(cbor: Cbor): MyType { ... }
 *   fromTaggedCbor(cbor: Cbor): MyType { ... }
 *
 *   // Auto-derived from the first cbor tag's name, matching Rust.
 *   fromUR(ur: UR): MyType { return decodableFromUR(this, ur); }
 *   fromURString(s: string): MyType { return decodableFromURString(this, s); }
 * }
 * ```
 */
interface URDecodable {
  /**
   * Creates an instance of this type from a UR.
   *
   * @param ur - The UR to decode from
   * @returns An instance of this type
   * @throws If the UR type is wrong or data is malformed
   */
  fromUR(ur: UR): unknown;
  /**
   * Creates an instance of this type from a UR string.
   *
   * This is a convenience method that parses the UR string and then
   * calls fromUR().
   *
   * @param urString - The UR string to decode from (e.g., "ur:type/...")
   * @returns An instance of this type
   * @throws If the UR string is invalid or data is malformed
   */
  fromURString?(urString: string): unknown;
}
/**
 * Concrete equivalent of Rust's default `URDecodable::from_ur` impl
 * (`bc-ur-rust/src/ur_decodable.rs:7-15`):
 *
 *   1. Read the first tag returned by `decodable.cborTags()`.
 *   2. Verify the UR's type matches that tag's name via `UR#checkType`
 *      (this is what Rust's `ur.check_type(...)` does — surface
 *      `UnexpectedTypeError` on mismatch).
 *   3. Delegate to `decodable.fromUntaggedCbor(ur.cbor())`.
 *
 * Use from a class implementing both `URDecodable` and
 * `CborTaggedDecodable<T>` to skip the type-check / delegate boilerplate.
 */
declare function decodableFromUR<T>(decodable: CborTaggedDecodable<T>, ur: UR): T;
/**
 * Concrete equivalent of Rust's default `URDecodable::from_ur_string` impl
 * (`bc-ur-rust/src/ur_decodable.rs:17-22`):
 * `Self::from_ur(UR::from_ur_string(s)?)`.
 */
declare function decodableFromURString<T>(decodable: CborTaggedDecodable<T>, urString: string): T;
/**
 * Helper function to check if an object implements URDecodable.
 */
declare function isURDecodable(obj: unknown): obj is URDecodable;
//#endregion
//#region src/ur-codable.d.ts
/**
 * A type that can be both encoded to and decoded from a UR.
 *
 * This combines the UREncodable and URDecodable interfaces for types
 * that support bidirectional UR conversion.
 *
 * @example
 * ```typescript
 * class MyType implements URCodable {
 *   ur(): UR {
 *     // Encode to UR
 *   }
 *
 *   urString(): string {
 *     // Return UR string
 *   }
 *
 *   fromUR(ur: UR): MyType {
 *     // Decode from UR
 *   }
 *
 *   fromURString(urString: string): MyType {
 *     // Decode from UR string (convenience method)
 *     return this.fromUR(UR.fromURString(urString));
 *   }
 * }
 * ```
 */
interface URCodable extends UREncodable, URDecodable {}
/**
 * Helper function to check if an object implements URCodable.
 */
declare function isURCodable(obj: unknown): obj is URCodable;
//#endregion
//#region src/multipart-encoder.d.ts
/**
 * Encodes a UR as multiple parts using fountain codes.
 *
 * This allows large CBOR structures to be split into multiple UR strings
 * that can be transmitted separately and reassembled. The encoder uses
 * fountain codes for resilient transmission over lossy channels.
 *
 * For single-part URs (small payloads), use the regular UR.string() method.
 *
 * @example
 * ```typescript
 * const ur = UR.new('bytes', cbor);
 * const encoder = new MultipartEncoder(ur, 100);
 *
 * // Generate all pure parts
 * while (!encoder.isComplete()) {
 *   const part = encoder.nextPart();
 *   console.log(part); // "ur:bytes/1-10/..."
 * }
 *
 * // Generate additional rateless parts for redundancy
 * for (let i = 0; i < 5; i++) {
 *   const part = encoder.nextPart();
 *   console.log(part); // "ur:bytes/11-10/..."
 * }
 * ```
 */
declare class MultipartEncoder {
  private readonly _ur;
  private readonly _fountainEncoder;
  private _currentIndex;
  /**
   * Creates a new multipart encoder for the given UR.
   *
   * @param ur - The UR to encode
   * @param maxFragmentLen - Maximum length of each fragment in bytes
   * @throws {URError} If encoding fails
   *
   * @example
   * ```typescript
   * const encoder = new MultipartEncoder(ur, 100);
   * ```
   */
  constructor(ur: UR, maxFragmentLen: number);
  /**
   * Gets the next part of the encoding.
   *
   * Parts 1 through seqLen are "pure" fragments containing one piece each.
   * Parts beyond seqLen are "mixed" fragments using fountain codes for redundancy.
   *
   * @returns The next UR string part
   *
   * @example
   * ```typescript
   * const part = encoder.nextPart();
   * // Returns: "ur:bytes/1-3/lsadaoaxjygonesw"
   * ```
   */
  nextPart(): string;
  /**
   * Encodes a fountain part as a UR string.
   *
   * Always emits the multipart `ur:<type>/<seqNum>-<seqLen>/<bytewords>`
   * format — including for single-part messages (`1-1/...`). This mirrors
   * Rust's `bc_ur::MultipartEncoder::next_part`, which never short-circuits
   * to plain UR. Callers that want plain UR for tiny payloads should use
   * `UR.string()` directly instead of constructing a `MultipartEncoder`.
   */
  private _encodePart;
  /**
   * Encodes part metadata and data as CBOR for bytewords encoding.
   * Format: CBOR array [seqNum, seqLen, messageLen, checksum, data]
   */
  private _encodePartData;
  /**
   * Gets the current part index.
   */
  currentIndex(): number;
  /**
   * Gets the total number of pure parts.
   *
   * Note: Fountain codes can generate unlimited parts beyond this count
   * for additional redundancy.
   */
  partsCount(): number;
}
//#endregion
//#region src/multipart-decoder.d.ts
/**
 * Decodes multiple UR parts back into a single UR.
 *
 * This reassembles multipart URs that were encoded using fountain codes.
 * The decoder can handle out-of-order reception and packet loss.
 *
 * @example
 * ```typescript
 * const decoder = new MultipartDecoder();
 *
 * for (const urPart of urParts) {
 *   decoder.receive(urPart);
 *   if (decoder.isComplete()) {
 *     const ur = decoder.message();
 *     break;
 *   }
 * }
 * ```
 */
declare class MultipartDecoder {
  private _urType;
  private _fountainDecoder;
  private _decodedMessage;
  /**
   * Receives a UR part string.
   *
   * @param part - A UR part string (e.g., "ur:bytes/1-10/..." or "ur:bytes/...")
   * @throws {InvalidSchemeError} If the part doesn't start with "ur:"
   * @throws {UnexpectedTypeError} If the type doesn't match previous parts
   */
  receive(part: string): void;
  /**
   * Parses a UR part string to extract type and part info.
   */
  private _parsePart;
  /**
   * Decodes a multipart UR's fountain part data.
   *
   * The multipart body is a CBOR array: [seqNum, seqLen, messageLen, checksum, data]
   */
  private _decodeFountainPart;
  /**
   * Checks if the message is complete.
   */
  isComplete(): boolean;
  /**
   * Gets the decoded UR message.
   *
   * @returns The decoded UR, or null if not yet complete
   */
  message(): UR | null;
}
//#endregion
//#region src/utils.d.ts
/**
 * Checks if a character is a valid UR type character.
 *
 * Mirrors Rust's `URTypeChar::is_ur_type` (`bc-ur-rust/src/utils.rs:6-19`):
 * lowercase a-z, digits 0-9, and the hyphen `-`.
 */
declare function isURTypeChar(char: string): boolean;
/**
 * Checks if a string is a valid UR type.
 *
 * Mirrors Rust's `URTypeString::is_ur_type` (`bc-ur-rust/src/utils.rs:26-32`)
 * which is `self.chars().all(...)` — meaning **the empty string is accepted**
 * (a vacuously-true `all` over no chars). We mirror that here so that
 * `URType::new("")` succeeds in both ports; the round-trip then fails at
 * decode-time with `TypeUnspecified`.
 */
declare function isValidURType(urType: string): boolean;
/**
 * Validates and returns a UR type, or throws an error if invalid.
 */
declare function validateURType(urType: string): string;
/**
 * Bytewords for encoding/decoding bytes as words.
 * See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-004-bytewords.md
 */
declare const BYTEWORDS: string[];
/**
 * Bytemojis for encoding/decoding bytes as emojis.
 * See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-008-bytemoji.md
 */
declare const BYTEMOJIS: string[];
/**
 * Encodes an arbitrary byte slice as a string of space-separated bytewords.
 *
 * Mirrors `bytewords::encode_to_words` in `bc-ur-rust` (≥ v0.19.1). Does not
 * add a CRC32 checksum — use {@link encodeBytewords} for UR-style encoding.
 */
declare function encodeToWords(data: Uint8Array): string;
/**
 * Encodes an arbitrary byte slice as a string of space-separated bytemojis.
 *
 * Mirrors `bytewords::encode_to_bytemojis` in `bc-ur-rust` (≥ v0.19.1).
 */
declare function encodeToBytemojis(data: Uint8Array): string;
/**
 * Encodes an arbitrary byte slice as minimal bytewords (first + last letter of
 * each word, concatenated with no separator).
 *
 * Mirrors `bytewords::encode_to_minimal_bytewords` in `bc-ur-rust`
 * (≥ v0.19.1). Does not add a CRC32 checksum.
 */
declare function encodeToMinimalBytewords(data: Uint8Array): string;
/**
 * Encodes a 4-byte slice as a string of bytewords for identification.
 *
 * Thin wrapper over {@link encodeToWords} that enforces the 4-byte length
 * contract historically used by `bc-ur-rust`'s `bytewords::identifier`.
 */
declare function encodeBytewordsIdentifier(data: Uint8Array): string;
/**
 * Encodes a 4-byte slice as a string of bytemojis for identification.
 *
 * Thin wrapper over {@link encodeToBytemojis} that enforces the 4-byte length
 * contract historically used by `bc-ur-rust`'s `bytewords::bytemoji_identifier`.
 */
declare function encodeBytemojisIdentifier(data: Uint8Array): string;
/**
 * Returns `true` if `emoji` is one of the 256 bytemojis.
 *
 * Mirrors `bytewords::is_valid_bytemoji` in `bc-ur-rust` (≥ v0.19.1).
 */
declare function isValidBytemoji(emoji: string): boolean;
/**
 * Canonicalises a byteword token (2–4 ASCII letters, case-insensitive) to its
 * full 4-letter lowercase form. Returns `undefined` if the token is not a
 * valid byteword or any of its short forms.
 *
 * Mirrors `bytewords::canonicalize_byteword` in `bc-ur-rust` (≥ v0.19.1).
 *
 * - 2-letter tokens are matched against the first + last letter of each
 *   byteword (identical to the minimal bytewords encoding).
 * - 3-letter tokens are matched against the first 3 and the last 3 letters of
 *   each byteword; if both match different entries, the first-3 match wins
 *   (matching rust's `or_else` priority).
 * - 4-letter tokens must exactly match a full byteword (after lower-casing).
 */
declare function canonicalizeByteword(token: string): string | undefined;
/**
 * Bytewords encoding style.
 */
declare enum BytewordsStyle {
  /** Full 4-letter words separated by spaces */
  Standard = "standard",
  /** Full 4-letter words separated by hyphens (URI-safe) */
  Uri = "uri",
  /** First and last character only (minimal) - used by UR encoding */
  Minimal = "minimal"
}
/**
 * Encode data as bytewords with the specified style.
 * Includes CRC32 checksum.
 */
declare function encodeBytewords(data: Uint8Array, style?: BytewordsStyle): string;
/**
 * Decode bytewords string back to data.
 * Validates and removes CRC32 checksum.
 *
 * Errors mirror the upstream Rust `ur::bytewords::Error` enum
 * (`ur-0.4.1/src/bytewords.rs`):
 * - `NonAscii` — input contains non-ASCII characters (checked first).
 * - `InvalidLength` — minimal-style input has odd length.
 * - `InvalidWord` — a token does not map to a byteword index.
 * - `InvalidChecksum` — the trailing 4-byte CRC32 does not match.
 *
 * All variants are surfaced as {@link BytewordsError} with the same default
 * `Display` strings as Rust (e.g. "invalid checksum", "non-ASCII"), so
 * callers can branch on the error class rather than the bare `Error`
 * thrown by earlier revisions of this port.
 */
declare function decodeBytewords(encoded: string, style?: BytewordsStyle): Uint8Array;
declare namespace bytewords_namespace_d_exports {
  export { BYTEMOJIS, BYTEWORDS, BytewordsStyle as Style, encodeBytemojisIdentifier as bytemojiIdentifier, canonicalizeByteword, decodeBytewords as decode, encodeBytewords as encode, encodeToBytemojis, encodeToMinimalBytewords, encodeToWords, encodeBytewordsIdentifier as identifier, isValidBytemoji };
}
//#endregion
export { BYTEMOJIS, BYTEWORDS, BytewordsError, BytewordsStyle, CBORError, InvalidSchemeError, InvalidTypeError, MultipartDecoder, MultipartEncoder, NotSinglePartError, type Result, TypeUnspecifiedError, UR, type URCodable, type URDecodable, URDecodeError, type UREncodable, URError, URType, UnexpectedTypeError, bytewords_namespace_d_exports as bytewords, canonicalizeByteword, decodableFromUR, decodableFromURString, decodeBytewords, encodeBytemojisIdentifier, encodeBytewords, encodeBytewordsIdentifier, encodeToBytemojis, encodeToMinimalBytewords, encodeToWords, isError, isURCodable, isURDecodable, isUREncodable, isURTypeChar, isValidBytemoji, isValidURType, urFromEncodable, urStringFromEncodable, validateURType };
//# sourceMappingURL=index.d.mts.map