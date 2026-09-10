/**
 * The single error type thrown by this package.
 *
 * @module error
 */

/** Machine-readable discriminant for a {@link URError}. */
export type URErrorCode =
  | "InvalidScheme"
  | "TypeUnspecified"
  | "InvalidType"
  | "NotSinglePart"
  | "UnexpectedType"
  | "Bytewords"
  | "Cbor"
  | "Decoder";

/** A {@link URError} whose `details` are discriminated by its `code`. */
export type URErrorTyped<C extends URErrorCode = URErrorCode> = C extends URErrorCode
  ? URError & {
      readonly code: C;
      readonly details: C extends "UnexpectedType" ? UnexpectedTypeDetails : undefined;
    }
  : never;

/** Details carried by an `UnexpectedType` error. */
export interface UnexpectedTypeDetails {
  readonly expected: string;
  readonly found: string;
}

/** A result that either holds a value or a {@link URError}. */
export type URResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: URError };

const captureStackTrace = (
  Error as unknown as { captureStackTrace?: (target: object, ctor: unknown) => void }
).captureStackTrace;

/**
 * Thrown for malformed UR strings (`InvalidScheme`, `TypeUnspecified`,
 * `InvalidType`, `NotSinglePart`), a type other than the one expected
 * (`UnexpectedType`), bytewords failures (`Bytewords`), CBOR failures
 * (`Cbor`), and anything the multipart decoder rejects (`Decoder`).
 * Messages match the Rust reference; branch on `code`.
 */
export class URError extends Error {
  readonly code: URErrorCode;
  readonly details: unknown;

  constructor(code: URErrorCode, message: string, details: unknown = undefined, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "URError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof captureStackTrace === "function") captureStackTrace(this, URError);
  }

  /** Type guard narrowing to the code-discriminated union. */
  static isURError(value: unknown): value is URErrorTyped {
    return value instanceof URError;
  }

  static invalidScheme(): URErrorTyped<"InvalidScheme"> {
    return new URError("InvalidScheme", "invalid UR scheme") as URErrorTyped<"InvalidScheme">;
  }
  static typeUnspecified(): URErrorTyped<"TypeUnspecified"> {
    return new URError(
      "TypeUnspecified",
      "no UR type specified",
    ) as URErrorTyped<"TypeUnspecified">;
  }
  static invalidType(): URErrorTyped<"InvalidType"> {
    return new URError("InvalidType", "invalid UR type") as URErrorTyped<"InvalidType">;
  }
  static notSinglePart(): URErrorTyped<"NotSinglePart"> {
    return new URError("NotSinglePart", "UR is not a single-part") as URErrorTyped<"NotSinglePart">;
  }
  static unexpectedType(expected: string, found: string): URErrorTyped<"UnexpectedType"> {
    return new URError("UnexpectedType", `expected UR type ${expected}, but found ${found}`, {
      expected,
      found,
    }) as URErrorTyped<"UnexpectedType">;
  }
  static bytewords(message: string, cause?: unknown): URErrorTyped<"Bytewords"> {
    return new URError(
      "Bytewords",
      `Bytewords error (${message})`,
      undefined,
      cause,
    ) as URErrorTyped<"Bytewords">;
  }
  static cbor(message: string, cause?: unknown): URErrorTyped<"Cbor"> {
    return new URError("Cbor", `CBOR error (${message})`, undefined, cause) as URErrorTyped<"Cbor">;
  }
  /** Anything the multipart or fountain decoder rejects. */
  static decoder(message: string, cause?: unknown): URErrorTyped<"Decoder"> {
    return new URError(
      "Decoder",
      `UR decoder error (${message})`,
      undefined,
      cause,
    ) as URErrorTyped<"Decoder">;
  }
}
