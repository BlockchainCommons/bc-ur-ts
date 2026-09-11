/**
 * Single-part Uniform Resources.
 *
 * @module ur
 */
import { type Cbor, decodeCbor } from "@blockchaincommons/dcbor";
import { URError } from "./error.js";
import { URType } from "./ur-type.js";
import { encodeBytewords, decodeBytewords } from "./bytewords.js";

const DIGITS = /^\d+$/;

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

  /** A UR of `type` over `cbor`. @throws {URError} `InvalidType` for an empty or malformed type string. */
  static from(type: string | URType, cbor: Cbor): UR {
    return new UR(URType.from(type), cbor);
  }

  /**
   * Parse a single-part UR string (any case).
   * @throws {URError} `InvalidScheme`, `TypeUnspecified`, `InvalidType`,
   * `NotSinglePart` (a well-formed multipart header), `Decoder` (a malformed
   * one), `Bytewords`, `Cbor`, checked in that order.
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

  /** The string for already-encoded CBOR bytes. @throws {URError} `InvalidType` */
  static encodeBytes(type: string | URType, cborBytes: Uint8Array): string {
    return `ur:${URType.from(type).name}/${encodeBytewords(cborBytes, "minimal")}`;
  }

  /** The type and CBOR bytes of a single-part UR string, without decoding the CBOR. */
  static decodeBytes(urString: string): {
    /** The UR type. */
    type: URType;
    /** The CBOR bytes, not yet decoded. */
    bytes: Uint8Array<ArrayBuffer>;
  } {
    const s = urString.toLowerCase();
    if (!s.startsWith("ur:")) throw URError.invalidScheme();
    const body = s.slice(3);
    const slash = body.indexOf("/");
    if (slash === -1) throw URError.typeUnspecified();
    const type = new URType(body.slice(0, slash));
    const payload = body.slice(slash + 1);

    // A second `/` means a multipart header `<seqNum>-<seqLen>`: well-formed
    // is NotSinglePart, anything else is a decoder error.
    const lastSlash = payload.lastIndexOf("/");
    if (lastSlash !== -1) {
      const [seqNum, seqLen, ...rest] = payload.slice(0, lastSlash).split("-");
      const ok =
        rest.length === 0 &&
        seqNum !== undefined &&
        seqLen !== undefined &&
        DIGITS.test(seqNum) &&
        DIGITS.test(seqLen) &&
        Number(seqNum) <= 0xffff &&
        Number(seqLen) <= 0xffff;
      if (!ok) throw URError.decoder("Invalid indices");
      throw URError.notSinglePart();
    }
    return { type, bytes: decodeBytewords(payload, "minimal") };
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

  /** Whether the UR's type is `type`. */
  isType(type: string | URType): boolean {
    return this.#type.name === (typeof type === "string" ? type : type.name);
  }

  /** Throws unless the UR's type is `type`. @throws {URError} `UnexpectedType` */
  expectType(type: string | URType): void {
    const expected = URType.from(type);
    if (!this.#type.equals(expected)) throw URError.unexpectedType(expected.name, this.#type.name);
  }

  /** Same type and identical CBOR bytes. */
  equals(other: UR): boolean {
    if (!this.#type.equals(other.#type)) return false;
    const a = this.#cbor.toData();
    const b = other.#cbor.toData();
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
}
