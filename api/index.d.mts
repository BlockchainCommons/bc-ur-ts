import { Cbor, CborCodec, CborTagged, ToCbor } from "@blockchaincommons/dcbor";
//#region src/error.d.ts
/**
 * The single error type thrown by this package.
 *
 * @module error
 */
/** Machine-readable discriminant for a {@link URError}. */
type URErrorCode = "InvalidScheme" | "TypeUnspecified" | "InvalidType" | "NotSinglePart" | "UnexpectedType" | "Bytewords" | "Cbor" | "Decoder";
/** A {@link URError} whose `details` are discriminated by its `code`. */
type URErrorTyped<C extends URErrorCode = URErrorCode> = C extends URErrorCode ? URError & {
  readonly code: C;
  readonly details: C extends "UnexpectedType" ? UnexpectedTypeDetails : undefined;
} : never;
/** Details carried by an `UnexpectedType` error. */
interface UnexpectedTypeDetails {
  readonly expected: string;
  readonly found: string;
}
/** A result that either holds a value or a {@link URError}. */
type URResult<T> = {
  readonly ok: true;
  readonly value: T;
} | {
  readonly ok: false;
  readonly error: URError;
};
/**
 * Thrown for malformed UR strings (`InvalidScheme`, `TypeUnspecified`,
 * `InvalidType`, `NotSinglePart`), a type other than the one expected
 * (`UnexpectedType`), bytewords failures (`Bytewords`), CBOR failures
 * (`Cbor`), and anything the multipart decoder rejects (`Decoder`).
 * Messages match the Rust reference; branch on `code`.
 */
declare class URError extends Error {
  readonly code: URErrorCode;
  readonly details: unknown;
  constructor(code: URErrorCode, message: string, details?: unknown, cause?: unknown);
  /** Type guard narrowing to the code-discriminated union. */
  static isURError(value: unknown): value is URErrorTyped;
  static invalidScheme(): URErrorTyped<"InvalidScheme">;
  static typeUnspecified(): URErrorTyped<"TypeUnspecified">;
  static invalidType(): URErrorTyped<"InvalidType">;
  static notSinglePart(): URErrorTyped<"NotSinglePart">;
  static unexpectedType(expected: string, found: string): URErrorTyped<"UnexpectedType">;
  static bytewords(message: string, cause?: unknown): URErrorTyped<"Bytewords">;
  static cbor(message: string, cause?: unknown): URErrorTyped<"Cbor">;
  /** Anything the multipart or fountain decoder rejects. */
  static decoder(message: string, cause?: unknown): URErrorTyped<"Decoder">;
}
//#endregion
//#region src/ur-type.d.ts
/** A UR type: lowercase letters, digits and hyphens. The empty string is accepted here and rejected at parse time. */
declare class URType {
  #private;
  /** @throws {URError} `InvalidType` */
  constructor(name: string);
  /** @throws {URError} `InvalidType` */
  static from(name: string | URType): URType;
  /** Non-throwing `from`. */
  static tryFrom(name: string): URResult<URType>;
  /** Whether `name` uses only `[a-z0-9-]`. */
  static isValid(name: string): boolean;
  get name(): string;
  equals(other: URType): boolean;
  toString(): string;
}
//#endregion
//#region src/ur.d.ts
/**
 * A UR: a {@link URType} and a CBOR payload, spelled
 * `ur:<type>/<minimal bytewords of the CBOR>`.
 */
declare class UR {
  #private;
  constructor(type: URType, cbor: Cbor);
  /** @throws {URError} `InvalidType` */
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
    type: URType;
    bytes: Uint8Array<ArrayBuffer>;
  };
  get type(): URType;
  get cbor(): Cbor;
  /** `ur:<type>/<bytewords>` */
  toString(): string;
  /** Upper-case form for alphanumeric QR encoding. */
  toQRString(): string;
  /** UTF-8 bytes of `toQRString`. */
  toQRBytes(): Uint8Array<ArrayBuffer>;
  isType(type: string | URType): boolean;
  /** @throws {URError} `UnexpectedType` */
  expectType(type: string | URType): void;
  /** Same type and identical CBOR bytes. */
  equals(other: UR): boolean;
}
//#endregion
//#region src/codable.d.ts
/** Anything that can present itself as a UR. */
interface ToUR {
  toUR(): UR;
}
/**
 * The UR of a tagged dcbor value: the type is the name of its first tag,
 * the payload is the tag's content.
 * @throws {Error} when the first tag has no registered name.
 */
declare function urFor(value: ToCbor & CborTagged): UR;
/**
 * Decode a UR with a dcbor codec whose first tag names the UR type.
 * @throws {URError} `UnexpectedType` when the UR's type is not the codec's.
 */
declare function decodeURWith<T>(ur: UR, codec: CborCodec<T>): T;
//#endregion
//#region src/multipart-encoder.d.ts
/**
 * Emits `ur:<type>/<seqNum>-<seqLen>/<bytewords>` part strings forever;
 * iterate it, or call `nextPart` to step.
 */
declare class MultipartEncoder implements Iterable<string> {
  #private;
  /** @throws {RangeError} for `maxFragmentLength < 1`. */
  constructor(ur: UR, maxFragmentLength: number);
  /** Parts produced so far. */
  get index(): number;
  /** Number of fragments; parts beyond it are mixtures. */
  get partCount(): number;
  nextPart(): string;
  [Symbol.iterator](): Iterator<string>;
}
//#endregion
//#region src/multipart-decoder.d.ts
/** Reassembles a UR from part strings in any order; a single-part string completes it at once. */
declare class MultipartDecoder {
  #private;
  /**
   * Feed a part (any case). Returns whether it added information.
   * @throws {URError} `InvalidScheme`, `InvalidType`, `UnexpectedType` when
   * the type differs from earlier parts, `Bytewords`, `Cbor`, or `Decoder`.
   */
  add(part: string): boolean;
  get done(): boolean;
  /** The UR once `done`. */
  get result(): UR | undefined;
  /** Fraction of fragments recovered (1 once done). */
  get progress(): number;
  reset(): void;
}
//#endregion
export { MultipartDecoder, MultipartEncoder, type ToUR, UR, URError, type URErrorCode, type URErrorTyped, type URResult, URType, type UnexpectedTypeDetails, decodeURWith, urFor };
//# sourceMappingURL=index.d.mts.map