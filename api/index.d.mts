import { Cbor, CborCodec, CborTagged, TagValue, ToCbor } from "@blockchaincommons/dcbor";
//#region src/error.d.ts
/**
 * Machine-readable discriminant for a {@link URError}. Eight codes are the
 * reference's variant names; `InvalidParameter` (an argument the
 * reference's types could not receive) and `TagUnnamed` (a point where the
 * reference panics) are JS-only.
 */
type URErrorCode = "InvalidScheme" | "TypeUnspecified" | "InvalidType" | "NotSinglePart" | "UnexpectedType" | "Bytewords" | "Cbor" | "Decoder" | "InvalidParameter" | "TagUnnamed";
/**
 * The structured payload of a {@link URError}, discriminated by `code`:
 * `e.details.code === "UnexpectedType"` narrows to `{ expected, found }`.
 */
type URErrorDetails = {
  /** A code that carries no payload. */
  readonly code: Exclude<URErrorCode, "UnexpectedType" | "InvalidParameter" | "TagUnnamed">;
} | {
  /** The UR's type is not the one expected. */
  readonly code: "UnexpectedType";
  /** The type that was expected. */
  readonly expected: string;
  /** The type the UR carries. */
  readonly found: string;
} | {
  /** An argument outside its domain (JS-only): a wrong type, or a number or bigint outside its width. */
  readonly code: "InvalidParameter";
  /** The argument, e.g. `"maxFragmentLength"`. */
  readonly parameter: string;
  /** The value received (the length for `shortIdentifier`'s data, the index for `mixFragments`). */
  readonly value: unknown;
} | {
  /** A dcbor tag without a registered name cannot name a UR type (JS-only). */
  readonly code: "TagUnnamed";
  /** The tag's number; `undefined` when the codec has no tag at all. */
  readonly tag: TagValue | undefined;
};
/** A result that either holds a value or a {@link URError}. */
type URResult<T> = {
  /** The operation succeeded. */
  readonly ok: true;
  /** The value. */
  readonly value: T;
} | {
  /** The operation failed. */
  readonly ok: false;
  /** Why. */
  readonly error: URError;
};
/**
 * Thrown for malformed UR strings (`InvalidScheme`, `TypeUnspecified`,
 * `InvalidType`, `NotSinglePart`), a type other than the one expected
 * (`UnexpectedType`), a bytewords failure in `decodeBytewords`
 * (`Bytewords`), CBOR failures (`Cbor`), anything the reference's `ur`
 * crate rejects inside a UR string or a part (`Decoder`: bytewords inside a
 * UR string, the header, the part CBOR, the fountain decoder), an argument
 * outside its domain (`InvalidParameter`) and a tag with no name to build a
 * UR type from (`TagUnnamed`). Codes and messages are the reference's
 * wherever it has an outcome; branch on `code`.
 *
 * Instances come from the static factories only; a wrapped CBOR or part
 * error is the `cause`.
 *
 * @example
 * ```ts
 * try {
 *   UR.parse(s);
 * } catch (e) {
 *   if (URError.isURError(e) && e.is("UnexpectedType")) {
 *     // e.details.expected, e.details.found
 *   }
 * }
 * ```
 */
export declare class URError extends Error {
  /** Always `"URError"`; the cross-copy identity {@link URError.isURError} checks. */
  override readonly name = "URError";
  /** The discriminant; equals `details.code`. */
  readonly code: URErrorCode;
  /** The structured payload, discriminated by `code`. */
  readonly details: URErrorDetails;
  private constructor();
  /** Type guard for a `URError`, including one from another copy of this package. */
  static isURError(value: unknown): value is URError;
  /** `true` when `code` is this error's code. */
  is(code: URErrorCode): boolean;
  /** The string does not start with `ur:`. */
  static invalidScheme(): URError;
  /** The string has no `/` after the scheme, so no type. */
  static typeUnspecified(): URError;
  /** The type uses a character outside `[a-z0-9-]`. */
  static invalidType(): URError;
  /** A well-formed multipart header where a single-part UR was required. */
  static notSinglePart(): URError;
  /** The UR's type is `found` where `expected` was required. */
  static unexpectedType(expected: string, found: string): URError;
  /** A `decodeBytewords` failure, in the reference's words. */
  static bytewords(message: string): URError;
  /** A CBOR failure; the dcbor error is the `cause` when one was caught. */
  static cbor(message: string, cause?: unknown): URError;
  /** Anything the reference's `ur` crate rejects, in its words (its `Error::UR`). */
  static decoder(message: string, cause?: unknown): URError;
  /** `parameter` must be `requirement`; `value` is what was received, rendered exactly. */
  static invalidParameter(parameter: string, value: unknown, requirement: string): URError;
  /** `tag` has no registered name, or (`undefined`) the codec has no tag at all. */
  static tagUnnamed(tag: TagValue | undefined): URError;
}
//#endregion
//#region src/ur-type.d.ts
/**
 * A UR type: lowercase letters, digits and hyphens, as the reference's
 * `URType::new` accepts them. The empty string is accepted, so `ur:/…` is
 * a valid UR, although BCR-2020-005 asks for one or more characters.
 */
export declare class URType {
  #private;
  /**
   * @throws {URError} `InvalidType` when `name` has a character outside
   * `[a-z0-9-]`; `InvalidParameter` for a non-string.
   */
  constructor(name: string);
  /**
   * `name` itself when it is already a `URType`, else a new one.
   * @throws {URError} `InvalidType`; `InvalidParameter` for anything but a string or `URType`.
   */
  static from(name: string | URType): URType;
  /** Non-throwing `from` for a string. @throws {URError} `InvalidParameter` for a non-string. */
  static tryFrom(name: string): URResult<URType>;
  /**
   * Whether every character of `name` is in `[a-z0-9-]` (the empty string is valid).
   * @throws {URError} `InvalidParameter` for a non-string.
   */
  static isValid(name: string): boolean;
  /** The type string, e.g. `"envelope"`. */
  get name(): string;
  /** Same type string. */
  equals(other: URType): boolean;
  /** The type string. */
  toString(): string;
}
//#endregion
//#region src/ur.d.ts
/**
 * A UR: a {@link URType} and a CBOR payload, spelled
 * `ur:<type>/<minimal bytewords of the CBOR>`.
 */
export declare class UR {
  #private;
  /** A UR from an already-validated type and a decoded CBOR value. */
  constructor(type: URType, cbor: Cbor);
  /** A UR of `type` over `cbor`. @throws {URError} `InvalidType` for a malformed type string. */
  static from(type: string | URType, cbor: Cbor): UR;
  /**
   * Parse a single-part UR string (any case: the whole string is
   * lower-cased first, as the reference's `UR::from_ur_string` does).
   * @throws {URError} In the reference's order: `InvalidScheme` (no `ur:`),
   * `TypeUnspecified` (no `/`), `InvalidType`, then `Decoder` for what the
   * reference's `ur::decode` rejects (a multipart header that is not two
   * `u16`s, "Invalid indices"; or the payload's bytewords, "invalid word" /
   * "invalid checksum" / "invalid length" / non-ASCII), `NotSinglePart` for
   * a well-formed multipart string, and `Cbor`.
   */
  static parse(urString: string): UR;
  /** The string for already-encoded CBOR bytes. @throws {URError} `InvalidType`; `InvalidParameter` for a non-`Uint8Array`. */
  static encodeBytes(type: string | URType, cborBytes: Uint8Array): string;
  /**
   * The type and CBOR bytes of a single-part UR string, without decoding
   * the CBOR; the checks and their order are those of {@link UR.parse}.
   */
  static decodeBytes(urString: string): {
    /** The UR type. */
    type: URType;
    /** The CBOR bytes, not yet decoded. */
    bytes: Uint8Array<ArrayBuffer>;
  };
  /** The UR type. */
  get type(): URType;
  /** The payload. */
  get cbor(): Cbor;
  /** `ur:<type>/<bytewords>` */
  toString(): string;
  /** Upper-case form for alphanumeric QR encoding. */
  toQRString(): string;
  /** UTF-8 bytes of `toQRString`. */
  toQRBytes(): Uint8Array<ArrayBuffer>;
  /** Whether the UR's type is `type`. @throws {URError} `InvalidParameter` for anything but a string or `URType`. */
  isType(type: string | URType): boolean;
  /** Throws unless the UR's type is `type`. @throws {URError} `UnexpectedType` */
  expectType(type: string | URType): void;
  /** Same type and structurally equal CBOR, as the reference's `PartialEq` compares them. */
  equals(other: UR): boolean;
}
//#endregion
//#region src/codable.d.ts
/** Anything that can present itself as a UR. */
interface ToUR {
  /** The value as a UR. */
  toUR(): UR;
}
/**
 * The UR of a tagged dcbor value: the type is the name of its first tag,
 * the payload is the tag's content, as the reference's `UREncodable::ur`.
 * @throws {URError} `TagUnnamed` when the value has no tag or its first tag
 * has no name; `InvalidType` when that name is not a UR type. The
 * reference panics at the same three points.
 * @throws {CborError} when `toCbor()` is not tagged with the first tag
 * (the reference reads `untagged_cbor()` and cannot receive such a value).
 */
export declare function urFor(value: ToCbor & CborTagged): UR;
/**
 * Decode a UR with a dcbor codec whose first tag names the UR type, as the
 * reference's `URDecodable::from_ur`: the UR's type must be the first tag's
 * name (a codec's other tags do not name accepted UR types), and the codec
 * decodes the content wrapped in that tag.
 * @throws {URError} `TagUnnamed` when the codec has no tag or its first tag
 * has no name (the reference panics there).
 * @throws {CborError} `Custom` when the UR's type is not the first tag's
 * name ("expected UR type <name>, but found <type>") or that name is not a
 * UR type ("invalid UR type"), as `from_ur` returns a `dcbor::Error`; and
 * whatever the codec throws for the content.
 */
export declare function decodeURWith<T>(ur: UR, codec: CborCodec<T>): T;
//#endregion
//#region src/multipart-encoder.d.ts
/**
 * Emits `ur:<type>/<seqNum>-<seqLen>/<bytewords>` part strings forever;
 * iterate it, or call `nextPart` to step.
 *
 * The sequence is infinite by design (a fountain code): `Array.from(encoder)`
 * and `[...encoder]` never return. Iterate with `for … of` and `break` when
 * the receiver is done, or take a prefix with the iterator helpers
 * (`encoder[Symbol.iterator]().take(n)`, Node ≥ 22).
 */
export declare class MultipartEncoder implements Iterable<string> {
  #private;
  /**
   * Parts of at most `maxFragmentLength` payload bytes each. The length is
   * the reference's `usize`: a safe integer `number`, or a `bigint` up to
   * 2⁶⁴ − 1 (a `number` of 2⁵³ or more is not accepted, as it may already
   * have been rounded).
   * @throws {URError} `Decoder` ("expected positive maximum fragment
   * length") for 0; `InvalidParameter` for any other value outside that
   * domain.
   */
  constructor(ur: UR, maxFragmentLength: number | bigint);
  /** Parts produced so far. */
  get index(): number;
  /** Number of fragments; parts beyond it are mixtures. */
  get partCount(): number;
  /** The next part string. */
  nextPart(): string;
  /** Part strings, forever. */
  [Symbol.iterator](): Iterator<string>;
}
//#endregion
//#region src/multipart-decoder.d.ts
/**
 * Reassembles a UR from part strings in any order, as the reference's
 * `MultipartDecoder` over `ur::Decoder::receive` does.
 *
 * Parts are case-sensitive: the reference's `receive` never lower-cases
 * (only `UR::from_ur_string` does), so lower-case a QR payload before
 * `add`. Every string is checked in full, before and after completion:
 * the scheme, the type against the first part's, the `seqNum-seqLen`
 * header, the bytewords and the part CBOR. The header is otherwise
 * informational: the fountain fields come from the part's CBOR. `done`
 * follows the fountain decoder, and `result` reassembles and decodes the
 * message when first read after completion.
 */
export declare class MultipartDecoder {
  #private;
  /**
   * Feed a part. Returns whether it added information: `false` for a
   * repeated index set and once done.
   * @throws {URError} In the reference's order: `InvalidScheme` (no `ur:`,
   * an upper-case scheme included), `InvalidType` (the first component),
   * `UnexpectedType` when the type differs from the first part's, then
   * `Decoder` for what `ur::decode` and the fountain decoder reject: "No
   * type specified" (no slash after the type), "Invalid indices" (a header
   * that is not two `u16`s), the bytewords failure ("invalid word",
   * "invalid checksum", …), "Can't decode single-part UR as multi-part" (no
   * header, once its bytewords decoded), the part codec's messages,
   * "expected non-empty part" and "part is inconsistent with previous ones".
   * `InvalidParameter` for a non-string.
   */
  add(part: string): boolean;
  /** Whether the message is reassembled: the fountain decoder's `done`. */
  get done(): boolean;
  /**
   * The UR once `done`, else `undefined`. The message is reassembled and
   * decoded when first read after completion; that outcome, the UR or the
   * error, is kept and returned or thrown again, as the decoder does not
   * change once done.
   * @throws {URError} `Decoder` for what the fountain decoder's result
   * rejects ("expected item", "invalid padding"); `Cbor` when the message
   * is not valid dCBOR.
   */
  get result(): UR | undefined;
  /** Fraction of fragments decoded (1 once done). */
  get progress(): number;
  /** Forget every part received. */
  reset(): void;
}
//#endregion
export type { ToUR, URErrorCode, URErrorDetails, URResult };
//# sourceMappingURL=index.d.mts.map