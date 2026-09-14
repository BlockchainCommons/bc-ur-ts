/**
 * Single-part Uniform Resources.
 *
 * @module ur
 */
import { type Cbor, cborEquals, decodeCbor } from "@blockchaincommons/dcbor";
import { URError } from "./error.js";
import { URType } from "./ur-type.js";
import { encodeBytewords } from "./bytewords.js";
import { decodeBytewordsOrReason } from "./bytewords-decode.js";
import { isMultipartHeader } from "./header.js";
import { expectBytes, expectString } from "./domain.js";

/**
 * A UR: a {@link URType} and a CBOR payload, spelled
 * `ur:<type>/<minimal bytewords of the CBOR>`.
 */
export class UR {
  readonly #type: URType;
  readonly #cbor: Cbor;

  /** A UR from an already-validated type and a decoded CBOR value. */
  constructor(type: URType, cbor: Cbor) {
    this.#type = type;
    this.#cbor = cbor;
  }

  /** A UR of `type` over `cbor`. @throws {URError} `InvalidType` for a malformed type string. */
  static from(type: string | URType, cbor: Cbor): UR {
    return new UR(URType.from(type), cbor);
  }

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
  static parse(urString: string): UR {
    const { type, bytes } = UR.decodeBytes(urString);
    let cbor: Cbor;
    try {
      cbor = decodeCbor(bytes);
    } catch (error) {
      throw URError.cbor(error instanceof Error ? error.message : String(error), error);
    }
    return new UR(type, cbor);
  }

  /** The string for already-encoded CBOR bytes. @throws {URError} `InvalidType`; `InvalidParameter` for a non-`Uint8Array`. */
  static encodeBytes(type: string | URType, cborBytes: Uint8Array): string {
    const urType = URType.from(type);
    expectBytes("cborBytes", cborBytes);
    return `ur:${urType.name}/${encodeBytewords(cborBytes, "minimal")}`;
  }

  /**
   * The type and CBOR bytes of a single-part UR string, without decoding
   * the CBOR; the checks and their order are those of {@link UR.parse}.
   */
  static decodeBytes(urString: string): {
    /** The UR type. */
    type: URType;
    /** The CBOR bytes, not yet decoded. */
    bytes: Uint8Array<ArrayBuffer>;
  } {
    const s = expectString("urString", urString).toLowerCase();
    if (!s.startsWith("ur:")) throw URError.invalidScheme();
    const body = s.slice(3);
    const slash = body.indexOf("/");
    if (slash === -1) throw URError.typeUnspecified();
    const type = new URType(body.slice(0, slash));
    const payload = body.slice(slash + 1);
    // The reference's `ur::decode`: everything up to the last slash is a
    // multipart header, checked before the payload; a bytewords failure
    // inside a UR string is its `Error::UR`.
    const lastSlash = payload.lastIndexOf("/");
    if (lastSlash !== -1 && !isMultipartHeader(payload.slice(0, lastSlash))) {
      throw URError.decoder("Invalid indices");
    }
    const bytes = decodeBytewordsOrReason(payload.slice(lastSlash + 1), "minimal");
    if (typeof bytes === "string") throw URError.decoder(bytes);
    if (lastSlash !== -1) throw URError.notSinglePart();
    return { type, bytes };
  }

  /** The UR type. */
  get type(): URType {
    return this.#type;
  }

  /** The payload. */
  get cbor(): Cbor {
    return this.#cbor;
  }

  /** `ur:<type>/<bytewords>` */
  toString(): string {
    return UR.encodeBytes(this.#type, this.#cbor.toData());
  }

  /** Upper-case form for alphanumeric QR encoding. */
  toQRString(): string {
    return this.toString().toUpperCase();
  }

  /** UTF-8 bytes of `toQRString`. */
  toQRBytes(): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(this.toQRString());
  }

  /** Whether the UR's type is `type`. @throws {URError} `InvalidParameter` for anything but a string or `URType`. */
  isType(type: string | URType): boolean {
    if (type instanceof URType) return this.#type.equals(type);
    return this.#type.name === expectString("type", type);
  }

  /** Throws unless the UR's type is `type`. @throws {URError} `UnexpectedType` */
  expectType(type: string | URType): void {
    const expected = URType.from(type);
    if (!this.#type.equals(expected)) throw URError.unexpectedType(expected.name, this.#type.name);
  }

  /** Same type and structurally equal CBOR, as the reference's `PartialEq` compares them. */
  equals(other: UR): boolean {
    return this.#type.equals(other.#type) && cborEquals(this.#cbor, other.#cbor);
  }
}
