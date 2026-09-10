//#region src/fountain.d.ts
/** One part of a fountain-coded message; the CBOR array `[seqNum, seqLen, messageLen, checksum, data]` on the wire. */
interface FountainPart {
  readonly seqNum: number;
  readonly seqLen: number;
  readonly messageLen: number;
  readonly checksum: number;
  readonly data: Uint8Array;
}
/** The fragment length that cuts `dataLength` into the fewest fragments of at most `maxFragmentLength`, evenly. */
declare function fragmentLength(dataLength: number, maxFragmentLength: number): number;
/** Cut `data` into `fragmentLength`-byte fragments, zero-padding the last. @throws {RangeError} */
declare function partition(data: Uint8Array, fragmentLen: number): Uint8Array<ArrayBuffer>[];
/** `partition` at `fragmentLength`; an empty message has no fragments. @throws {RangeError} */
declare function splitMessage(message: Uint8Array, maxFragmentLen: number): Uint8Array<ArrayBuffer>[];
/** `target ^= source` over `target`'s length (`source` may be shorter). */
declare function xorInto(target: Uint8Array, source: Uint8Array): void;
/** The fragment indices part `seqNum` mixes: itself while `seqNum ≤ seqLen`, then a seeded random subset. */
declare function chooseFragments(seqNum: number, seqLen: number, checksum: number): number[];
/** XOR of the fragments at `indices`. @throws {RangeError} */
declare function mixFragments(fragments: readonly Uint8Array[], indices: readonly number[]): Uint8Array<ArrayBuffer>;
/** Encode a part as its CBOR array. */
declare function encodeFountainPart(part: FountainPart): Uint8Array<ArrayBuffer>;
/** Decode a part from its CBOR array. @throws {URError} `Decoder` */
declare function decodeFountainPart(bytes: Uint8Array): FountainPart;
/** Produces parts forever; the first `partCount` are the plain fragments. */
declare class FountainEncoder implements Iterable<FountainPart> {
  #private;
  /** @throws {RangeError} for an empty message or `maxFragmentLen < 1`. */
  constructor(message: Uint8Array, maxFragmentLen: number);
  /** Number of fragments; parts beyond it are mixtures. */
  get partCount(): number;
  /** Parts produced so far. */
  get index(): number;
  /** Whether every plain fragment has been emitted at least once. */
  get done(): boolean;
  get isSinglePart(): boolean;
  nextPart(): FountainPart;
  reset(): void;
  [Symbol.iterator](): Iterator<FountainPart>;
}
/**
 * Reassembles a message from parts in any order. Every mixed part is kept
 * and re-reduced whenever a plain fragment appears, so completion never
 * needs more parts than the reference decoder.
 */
declare class FountainDecoder {
  #private;
  /**
   * Feed a part. Returns whether it added information (false once done or
   * for a repeated index set).
   * @throws {URError} `Decoder` for an empty part or one inconsistent with the first.
   */
  add(part: FountainPart): boolean;
  get done(): boolean;
  /** Fraction of fragments recovered. */
  get progress(): number;
  /**
   * The message once `done`, else `undefined`.
   * @throws {URError} `Decoder` when the reassembled bytes fail the checksum.
   */
  get result(): Uint8Array<ArrayBuffer> | undefined;
  reset(): void;
}
//#endregion
export { FountainDecoder, FountainEncoder, FountainPart, chooseFragments, decodeFountainPart, encodeFountainPart, fragmentLength, mixFragments, partition, splitMessage, xorInto };
//# sourceMappingURL=fountain.d.mts.map