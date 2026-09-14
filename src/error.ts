/**
 * The single error type thrown by this package.
 *
 * @module error
 */
import type { TagValue } from "@blockchaincommons/dcbor";

/**
 * Machine-readable discriminant for a {@link URError}. Eight codes are the
 * reference's variant names; `InvalidParameter` (an argument the
 * reference's types could not receive) and `TagUnnamed` (a point where the
 * reference panics) are JS-only.
 */
export type URErrorCode =
  | "InvalidScheme"
  | "TypeUnspecified"
  | "InvalidType"
  | "NotSinglePart"
  | "UnexpectedType"
  | "Bytewords"
  | "Cbor"
  | "Decoder"
  | "InvalidParameter"
  | "TagUnnamed";

/**
 * The structured payload of a {@link URError}, discriminated by `code`:
 * `e.details.code === "UnexpectedType"` narrows to `{ expected, found }`.
 */
export type URErrorDetails =
  | {
      /** A code that carries no payload. */
      readonly code: Exclude<URErrorCode, "UnexpectedType" | "InvalidParameter" | "TagUnnamed">;
    }
  | {
      /** The UR's type is not the one expected. */
      readonly code: "UnexpectedType";
      /** The type that was expected. */
      readonly expected: string;
      /** The type the UR carries. */
      readonly found: string;
    }
  | {
      /** An argument outside its domain (JS-only): a wrong type, or a number or bigint outside its width. */
      readonly code: "InvalidParameter";
      /** The argument, e.g. `"maxFragmentLength"`. */
      readonly parameter: string;
      /** The value received (the length for `shortIdentifier`'s data, the index for `mixFragments`). */
      readonly value: unknown;
    }
  | {
      /** A dcbor tag without a registered name cannot name a UR type (JS-only). */
      readonly code: "TagUnnamed";
      /** The tag's number; `undefined` when the codec has no tag at all. */
      readonly tag: TagValue | undefined;
    };

/** The received value of an `InvalidParameter`, rendered so that no two values read alike. */
function render(value: unknown): string {
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "number") {
    return Number.isInteger(value) && !Number.isSafeInteger(value)
      ? BigInt(value).toString()
      : String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "function") return "function";
  if (Array.isArray(value)) return "Array";
  if (typeof value === "object" && value !== null) {
    const name = (value as { constructor?: { name?: unknown } }).constructor?.name;
    return typeof name === "string" && name !== "" ? name : "object";
  }
  return String(value);
}

/** A result that either holds a value or a {@link URError}. */
export type URResult<T> =
  | {
      /** The operation succeeded. */
      readonly ok: true;
      /** The value. */
      readonly value: T;
    }
  | {
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
export class URError extends Error {
  /** Always `"URError"`; the cross-copy identity {@link URError.isURError} checks. */
  override readonly name = "URError";
  /** The discriminant; equals `details.code`. */
  readonly code: URErrorCode;
  /** The structured payload, discriminated by `code`. */
  readonly details: URErrorDetails;

  private constructor(message: string, details: URErrorDetails, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.code = details.code;
    this.details = details;
  }

  /** Type guard for a `URError`, including one from another copy of this package. */
  static isURError(value: unknown): value is URError {
    return value instanceof Error && value.name === "URError" && "code" in value;
  }

  /** `true` when `code` is this error's code. */
  is(code: URErrorCode): boolean {
    return this.code === code;
  }

  /** The string does not start with `ur:`. */
  static invalidScheme(): URError {
    return new URError("invalid UR scheme", { code: "InvalidScheme" });
  }
  /** The string has no `/` after the scheme, so no type. */
  static typeUnspecified(): URError {
    return new URError("no UR type specified", { code: "TypeUnspecified" });
  }
  /** The type uses a character outside `[a-z0-9-]`. */
  static invalidType(): URError {
    return new URError("invalid UR type", { code: "InvalidType" });
  }
  /** A well-formed multipart header where a single-part UR was required. */
  static notSinglePart(): URError {
    return new URError("UR is not a single-part", { code: "NotSinglePart" });
  }
  /** The UR's type is `found` where `expected` was required. */
  static unexpectedType(expected: string, found: string): URError {
    return new URError(`expected UR type ${expected}, but found ${found}`, {
      code: "UnexpectedType",
      expected,
      found,
    });
  }
  /** A `decodeBytewords` failure, in the reference's words. */
  static bytewords(message: string): URError {
    return new URError(`Bytewords error (${message})`, { code: "Bytewords" });
  }
  /** A CBOR failure; the dcbor error is the `cause` when one was caught. */
  static cbor(message: string, cause?: unknown): URError {
    return new URError(`CBOR error (${message})`, { code: "Cbor" }, cause);
  }
  /** Anything the reference's `ur` crate rejects, in its words (its `Error::UR`). */
  static decoder(message: string, cause?: unknown): URError {
    return new URError(`UR decoder error (${message})`, { code: "Decoder" }, cause);
  }
  /** `parameter` must be `requirement`; `value` is what was received, rendered exactly. */
  static invalidParameter(parameter: string, value: unknown, requirement: string): URError {
    return new URError(`${parameter} must be ${requirement}, got ${render(value)}`, {
      code: "InvalidParameter",
      parameter,
      value,
    });
  }
  /** `tag` has no registered name, or (`undefined`) the codec has no tag at all. */
  static tagUnnamed(tag: TagValue | undefined): URError {
    return new URError(
      tag === undefined
        ? "the codec has no tags; a UR type needs a named tag"
        : `CBOR tag ${String(tag)} must have a name; register the tags first`,
      { code: "TagUnnamed", tag },
    );
  }
}
