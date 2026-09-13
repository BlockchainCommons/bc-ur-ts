import { Cbor, CborCodec, CborTagged, TagValue, ToCbor } from "@blockchaincommons/dcbor";
//#region src/error.d.ts
/**
 * Machine-readable discriminant for a {@link URError}. Eight codes are the
 * reference's variant names; `InvalidParameter` and `TagUnnamed` are
 * JS-only.
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
  /** A `number` argument outside its domain (JS-only). */
  readonly code: "InvalidParameter";
  /** The argument, e.g. `"maxFragmentLength"`. */
  readonly parameter: string;
  /** The value received (a length for byte-array arguments). */
  readonly value: number;
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
 * (`UnexpectedType`), bytewords failures (`Bytewords`), CBOR failures
 * (`Cbor`), anything the multipart or fountain decoder rejects
 * (`Decoder`), a `number` argument outside its domain (`InvalidParameter`)
 * and a tag with no name to build a UR type from (`TagUnnamed`). Messages
 * match the Rust reference where a variant exists; branch on `code`.
 *
 * Instances come from the static factories only; a wrapped bytewords,
 * CBOR or part error is the `cause`.
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
  /** The type is empty or uses a character outside `[a-z0-9-]`. */
  static invalidType(): URError;
  /** A well-formed multipart header where a single-part UR was required. */
  static notSinglePart(): URError;
  /** The UR's type is `found` where `expected` was required. */
  static unexpectedType(expected: string, found: string): URError;
  /** A bytewords failure; the bytewords error is the `cause` when one was caught. */
  static bytewords(message: string, cause?: unknown): URError;
  /** A CBOR failure; the dcbor error is the `cause` when one was caught. */
  static cbor(message: string, cause?: unknown): URError;
  /** Anything the multipart or fountain decoder rejects. */
  static decoder(message: string, cause?: unknown): URError;
  /** `parameter` must be `requirement`; `value` is what was received. */
  static invalidParameter(parameter: string, value: number, requirement: string): URError;
  /** `tag` has no registered name, or (`undefined`) the codec has no tag at all. */
  static tagUnnamed(tag: TagValue | undefined): URError;
}
//#endregion
//#region src/ur-type.d.ts
/**
 * A UR type: one or more lowercase letters, digits and hyphens
 * (BCR-2020-005). The empty string is rejected (the Rust reference
 * accepts it — divergence D4).
 */
export declare class URType {
  #private;
  /** @throws {URError} `InvalidType` when `name` is empty or has a character outside `[a-z0-9-]`. */
  constructor(name: string);
  /** `name` itself when it is already a `URType`, else a new one. @throws {URError} `InvalidType` */
  static from(name: string | URType): URType;
  /** Non-throwing `from`. */
  static tryFrom(name: string): URResult<URType>;
  /** Whether `name` is one or more of `[a-z0-9-]`. */
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
  /** A UR of `type` over `cbor`. @throws {URError} `InvalidType` for an empty or malformed type string. */
  static from(type: string | URType, cbor: Cbor): UR;
  /**
   * Parse a single-part UR string (any case).
   * @throws {URError} `InvalidScheme`, `TypeUnspecified`, `InvalidType`,
   * `NotSinglePart` (a well-formed multipart header), `Decoder` (a malformed
   * one), `Bytewords`, `Cbor`, checked in that order.
   */
  static parse(urString: string): UR;
  /** The string for already-encoded CBOR bytes. @throws {URError} `InvalidType` */
  static encodeBytes(type: string | URType, cborBytes: Uint8Array): string;
  /** The type and CBOR bytes of a single-part UR string, without decoding the CBOR. */
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
  /** Whether the UR's type is `type`. */
  isType(type: string | URType): boolean;
  /** Throws unless the UR's type is `type`. @throws {URError} `UnexpectedType` */
  expectType(type: string | URType): void;
  /** Same type and identical CBOR bytes. */
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
 * the payload is the tag's content.
 * @throws {URError} `TagUnnamed` when the value has no tag or its first tag
 * has no registered name.
 */
export declare function urFor(value: ToCbor & CborTagged): UR;
/**
 * Decode a UR with a dcbor codec whose first tag names the UR type.
 * @throws {URError} `TagUnnamed` when the codec has no tag or its first tag
 * has no name; `UnexpectedType` when the UR's type is not the codec's.
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
   * Parts of at most `maxFragmentLength` payload bytes each.
   * @throws {URError} `InvalidParameter` unless `maxFragmentLength` is an integer ≥ 1.
   */
  constructor(ur: UR, maxFragmentLength: number);
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
 * Reassembles a UR from part strings in any order. Any case is accepted
 * (the whole string is lower-cased, as `UR::from_ur_string` does). A part
 * is rejected when it is a single-part UR (decode those with `UR.parse`;
 * the reference's `MultipartDecoder` rejects them too), when its URL header
 * is not two `u16`s, when its fields are inconsistent with earlier parts,
 * and — once complete — when the reassembled message's padding is not zero
 * or its checksum fails. The header is otherwise informational: the
 * fountain fields come from the part's CBOR, as in the reference.
 */
export declare class MultipartDecoder {
  #private;
  /**
   * Feed a part (any case). Returns whether it added information.
   * @throws {URError} `InvalidScheme`, `TypeUnspecified`, `InvalidType`,
   * `UnexpectedType` when the type differs from earlier parts, `Bytewords`,
   * `Cbor`, or `Decoder` (a single-part UR — "Can't decode single-part UR as
   * multi-part" —, a header that is not two `u16`s — "Invalid indices" —, a
   * part field outside `u32`, an inconsistent part, and on completion
   * non-zero padding or a checksum mismatch).
   */
  add(part: string): boolean;
  /** Whether the UR has been reassembled. */
  get done(): boolean;
  /** The UR once `done`. */
  get result(): UR | undefined;
  /** Fraction of fragments recovered (1 once done). */
  get progress(): number;
  /** Forget every part received. */
  reset(): void;
}
//#endregion
export type { ToUR, URErrorCode, URErrorDetails, URResult };
//# sourceMappingURL=index.d.mts.map