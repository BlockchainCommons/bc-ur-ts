//#region src/fountain.d.ts
/**
 * One part of a fountain-coded message; the CBOR array
 * `[seqNum, seqLen, messageLen, checksum, data]` on the wire. The four
 * integers are `u32`s and `seqNum` is at least 1.
 */
export interface FountainPart {
  /** 1-based part number; parts `1..seqLen` are the plain fragments. */
  readonly seqNum: number;
  /** Number of fragments the message was cut into. */
  readonly seqLen: number;
  /** Length of the whole message in bytes. */
  readonly messageLen: number;
  /** CRC-32 of the whole message. */
  readonly checksum: number;
  /** One fragment, or the XOR of several. */
  readonly data: Uint8Array;
}
/** The fragment length that cuts `dataLength` into the fewest fragments of at most `maxFragmentLength`, evenly. */
export declare function fragmentLength(dataLength: number, maxFragmentLength: number): number;
/**
 * Cut `data` into `fragmentLen`-byte fragments, zero-padding the last.
 * @throws {URError} `InvalidParameter` unless `fragmentLen` is an integer ≥ 1.
 */
export declare function partition(data: Uint8Array, fragmentLen: number): Uint8Array<ArrayBuffer>[];
/**
 * `partition` at `fragmentLength`; an empty message has no fragments.
 * @throws {URError} `InvalidParameter` unless `maxFragmentLen` is an integer ≥ 1.
 */
export declare function splitMessage(message: Uint8Array, maxFragmentLen: number): Uint8Array<ArrayBuffer>[];
/** `target ^= source` over `target`'s length (`source` may be shorter). */
export declare function xorInto(target: Uint8Array, source: Uint8Array): void;
/** The fragment indices part `seqNum` mixes: itself while `seqNum ≤ seqLen`, then a seeded random subset. */
export declare function chooseFragments(seqNum: number, seqLen: number, checksum: number): number[];
/**
 * XOR of the fragments at `indices`.
 * @throws {URError} `InvalidParameter` for no indices or an index with no fragment.
 */
export declare function mixFragments(fragments: readonly Uint8Array[], indices: readonly number[]): Uint8Array<ArrayBuffer>;
/** Encode a part as its CBOR array. */
export declare function encodeFountainPart(part: FountainPart): Uint8Array<ArrayBuffer>;
/**
 * Decode a part from its CBOR array.
 * @throws {URError} `Decoder` for anything but a five-element array of four
 * `u32`s (`seqNum` ≥ 1) and a byte string.
 */
export declare function decodeFountainPart(bytes: Uint8Array): FountainPart;
/**
 * Produces parts forever; the first `partCount` are the plain fragments.
 *
 * The sequence is infinite by design: `Array.from(encoder)` never returns.
 * Iterate with `for … of` and `break`, or take a prefix with the iterator
 * helpers (`encoder[Symbol.iterator]().take(n)`, Node ≥ 22).
 */
export declare class FountainEncoder implements Iterable<FountainPart> {
  #private;
  /**
   * Fragments of at most `maxFragmentLen` bytes.
   * @throws {URError} `InvalidParameter` for an empty message or unless
   * `maxFragmentLen` is an integer ≥ 1.
   */
  constructor(message: Uint8Array, maxFragmentLen: number);
  /** Number of fragments; parts beyond it are mixtures. */
  get partCount(): number;
  /** Parts produced so far. */
  get index(): number;
  /** Whether every plain fragment has been emitted at least once. */
  get done(): boolean;
  /** Whether the message fits in one fragment. */
  get isSinglePart(): boolean;
  /** The next part: a plain fragment while `seqNum ≤ partCount`, then a mixture. */
  nextPart(): FountainPart;
  /** Start again from part 1. */
  reset(): void;
  /** Parts, forever. */
  [Symbol.iterator](): Iterator<FountainPart>;
}
/**
 * Reassembles a message from parts in any order. Every mixed part is kept
 * and re-reduced whenever a plain fragment appears, so completion never
 * needs more parts than the reference decoder.
 */
export declare class FountainDecoder {
  #private;
  /**
   * Feed a part. Returns whether it added information (false once done or
   * for a repeated index set).
   * @throws {URError} `InvalidParameter` unless the four integer fields are
   * `u32`s with `seqNum ≥ 1`; `Decoder` for an empty part or one
   * inconsistent with the first.
   */
  add(part: FountainPart): boolean;
  /** Whether every fragment has been recovered; `result` is then defined or throws. */
  get done(): boolean;
  /** Fraction of fragments recovered. */
  get progress(): number;
  /**
   * The message once `done`, else `undefined`.
   * @throws {URError} `Decoder` when the fragments do not cover `messageLen`,
   * when the bytes past `messageLen` are not all zero ("invalid padding", as
   * the reference), or when the reassembled bytes fail the checksum.
   */
  get result(): Uint8Array<ArrayBuffer> | undefined;
  /** Forget every part received. */
  reset(): void;
}
//#endregion
//# sourceMappingURL=fountain.d.mts.map