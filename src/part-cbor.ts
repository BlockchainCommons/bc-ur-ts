/**
 * The subset of the `minicbor` reader that decodes a fountain part, with
 * its error texts. The reference decodes parts with `minicbor`, not dCBOR:
 * integer heads of any width, byte strings of any length width and
 * trailing bytes are all accepted, and every failure names the position
 * and the type found. This module reproduces that reader so parts from any
 * minicbor-based encoder decode here exactly as they do there.
 *
 * @internal
 * @module part-cbor
 */

/** A `minicbor` decoding failure; `message` is the reference's `Display` text. */
export class PartCborError extends Error {
  override readonly name = "PartCborError";
}

const UNSIGNED = 0x00;
const BYTES = 0x40;
const ARRAY = 0x80;
const majorOf = (b: number): number => b & 0xe0;
const infoOf = (b: number): number => b & 0x1f;

const endOfInput = (): PartCborError => new PartCborError("end of input bytes");
const typeMismatch = (type: string, position: number, message: string): PartCborError =>
  new PartCborError(`unexpected type ${type} at position ${position}: ${message}`);
const overflow = (value: bigint, position: number, message: string): PartCborError =>
  new PartCborError(`${value} overflows target type at position ${position}: ${message}`);

/** Reads CBOR items from `buf` as `minicbor::Decoder` does. */
export class PartReader {
  readonly #buf: Uint8Array;
  #pos = 0;

  constructor(buf: Uint8Array) {
    this.#buf = buf;
  }

  /** Consume the byte at the current position. */
  read(): number {
    if (this.#pos < this.#buf.length) return this.#buf[this.#pos++];
    throw endOfInput();
  }

  // The byte after the current position; called once the head byte has been
  // consumed, so it inspects the byte two after the head, as the reference does.
  #peek(): number {
    const i = this.#pos + 1;
    if (i < this.#buf.length) return this.#buf[i];
    throw endOfInput();
  }

  /** Consume `n` bytes; a length the input cannot hold is "end of input bytes" (no position). */
  readSlice(n: bigint): Uint8Array {
    if (BigInt(this.#pos) + n > BigInt(this.#buf.length)) throw endOfInput();
    const end = this.#pos + Number(n);
    const slice = this.#buf.subarray(this.#pos, end);
    this.#pos = end;
    return slice;
  }

  /** The reference's name for the item a head byte starts. */
  typeName(b: number): string {
    if (b <= 0x18) return "u8";
    if (b === 0x19) return "u16";
    if (b === 0x1a) return "u32";
    if (b === 0x1b) return "u64";
    if (b >= 0x20 && b <= 0x37) return "i8";
    if (b === 0x38) return this.#peek() < 0x80 ? "i8" : "i16";
    if (b === 0x39) return this.#peek() < 0x80 ? "i16" : "i32";
    if (b === 0x3a) return this.#peek() < 0x80 ? "i32" : "i64";
    if (b === 0x3b) return this.#peek() < 0x80 ? "i64" : "int";
    if (b >= 0x40 && b <= 0x5b) return "bytes";
    if (b === 0x5f) return "indefinite bytes";
    if (b >= 0x60 && b <= 0x7b) return "string";
    if (b === 0x7f) return "indefinite string";
    if (b >= 0x80 && b <= 0x9b) return "array";
    if (b === 0x9f) return "indefinite array";
    if (b >= 0xa0 && b <= 0xbb) return "map";
    if (b === 0xbf) return "indefinite map";
    if (b >= 0xc0 && b <= 0xdb) return "tag";
    if ((b >= 0xe0 && b <= 0xf3) || b === 0xf8) return "simple";
    if (b === 0xf4 || b === 0xf5) return "bool";
    if (b === 0xf6) return "null";
    if (b === 0xf7) return "undefined";
    if (b === 0xf9) return "f16";
    if (b === 0xfa) return "f32";
    if (b === 0xfb) return "f64";
    if (b === 0xff) return "break";
    return `0x${b.toString(16)}`;
  }

  // A `u64` from the additional information of a head at `position`.
  #unsigned(info: number, position: number): bigint {
    if (info <= 0x17) return BigInt(info);
    if (info === 0x18) return BigInt(this.read());
    if (info === 0x19) return this.#readBigEndian(2);
    if (info === 0x1a) return this.#readBigEndian(4);
    if (info === 0x1b) return this.#readBigEndian(8);
    throw typeMismatch(this.typeName(info), position, "expected u64");
  }

  #readBigEndian(width: number): bigint {
    let value = 0n;
    for (const byte of this.readSlice(BigInt(width))) value = (value << 8n) | BigInt(byte);
    return value;
  }

  /** Decode a `u32`. */
  u32(): number {
    const position = this.#pos;
    const b = this.read();
    if (majorOf(b) === UNSIGNED && infoOf(b) <= 0x1b) {
      const value = this.#unsigned(infoOf(b), position);
      if (value > 0xffff_ffffn) throw overflow(value, position, "when converting u64 to u32");
      return Number(value);
    }
    throw typeMismatch(this.typeName(b), position, "expected u32");
  }

  /** Decode an array head: its length, or `undefined` for an indefinite one. */
  array(): bigint | undefined {
    const position = this.#pos;
    const b = this.read();
    if (majorOf(b) !== ARRAY) throw typeMismatch(this.typeName(b), position, "expected array");
    const info = infoOf(b);
    return info === 31 ? undefined : this.#unsigned(info, position);
  }

  /** Decode a definite-length byte string. */
  bytes(): Uint8Array {
    const position = this.#pos;
    const b = this.read();
    if (majorOf(b) !== BYTES || infoOf(b) === 31) {
      throw typeMismatch(this.typeName(b), position, "expected bytes (definite length)");
    }
    return this.readSlice(this.#unsigned(infoOf(b), position));
  }
}
