//#region src/fountain.d.ts
/**
 * One part of a fountain-coded message; the CBOR array
 * `[seqNum, seqLen, messageLen, checksum, data]` on the wire. `seqNum`,
 * `seqLen` and `messageLen` are the reference's `usize` counters (safe
 * integers here, `u32` on the wire) and `checksum` is a `u32`.
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
/**
 * The fragment length that cuts `dataLength` into the fewest fragments of at most `maxFragmentLength`, evenly.
 * @throws {URError} `InvalidParameter` unless `dataLength` is an integer ≥ 0 and `maxFragmentLength` an integer ≥ 1.
 */
export declare function fragmentLength(dataLength: number, maxFragmentLength: number): number;
/**
 * Cut `data` into `fragmentLen`-byte fragments, zero-padding the last.
 * @throws {URError} `InvalidParameter` unless `data` is a `Uint8Array` and `fragmentLen` an integer ≥ 1.
 */
export declare function partition(data: Uint8Array, fragmentLen: number): Uint8Array<ArrayBuffer>[];
/**
 * `partition` at `fragmentLength`; an empty message has no fragments.
 * @throws {URError} `InvalidParameter` unless `message` is a `Uint8Array` and `maxFragmentLen` an integer ≥ 1.
 */
export declare function splitMessage(message: Uint8Array, maxFragmentLen: number): Uint8Array<ArrayBuffer>[];
/**
 * `target ^= source` over the shorter length, as the reference's `xor` zips
 * the two slices in its release build.
 * @throws {URError} `InvalidParameter` unless both are `Uint8Array`s.
 */
export declare function xorInto(target: Uint8Array, source: Uint8Array): void;
/**
 * The fragment indices part `seqNum` mixes: itself while `seqNum ≤ seqLen`, then a seeded random subset.
 * @throws {URError} `InvalidParameter` unless `seqNum` and `seqLen` are integers ≥ 1 and `checksum` is a `u32`.
 */
export declare function chooseFragments(seqNum: number, seqLen: number, checksum: number): number[];
/**
 * XOR of the fragments at `indices`.
 * @throws {URError} `InvalidParameter` unless `fragments` is a non-empty array of `Uint8Array`s and `indices` a non-empty array of indexes into it.
 */
export declare function mixFragments(fragments: readonly Uint8Array[], indices: readonly number[]): Uint8Array<ArrayBuffer>;
/**
 * Encode a part as its CBOR array. `seqNum`, `seqLen` and `messageLen` are
 * written as `u32`s, truncated as the reference's `as u32` truncates them.
 * @throws {URError} `InvalidParameter` unless the counters are integers ≥ 0, `checksum` a `u32` and `data` a `Uint8Array`.
 */
export declare function encodeFountainPart(part: FountainPart): Uint8Array<ArrayBuffer>;
/**
 * Decode a part from its CBOR array as the reference's `minicbor` decoder
 * does: a five-element array of four `u32`s, each with a head of any width,
 * and a definite-length byte string. Trailing bytes are ignored and a
 * `seqNum` of 0 is accepted.
 * @throws {URError} `InvalidParameter` for a non-`Uint8Array`; `Decoder` with the reference's text otherwise: "decode
 * error: invalid CBOR array length", "unexpected type <type> at position
 * <n>: expected <item>", "<value> overflows target type at position <n>:
 * when converting u64 to u32", or "end of input bytes".
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
   * Fragments of at most `maxFragmentLen` bytes. The length is the
   * reference's `usize`: a safe integer `number`, or a `bigint` up to
   * 2⁶⁴ − 1 (a `number` of 2⁵³ or more is not accepted, as it may already
   * have been rounded).
   * @throws {URError} In the reference's order: `Decoder` for an empty
   * message ("expected non-empty message") and for a length of 0 ("expected
   * positive maximum fragment length"); `InvalidParameter` unless `message`
   * is a `Uint8Array` and the length is in the domain above.
   */
  constructor(message: Uint8Array, maxFragmentLen: number | bigint);
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
 * Reassembles a message from parts in any order, exactly as the reference's
 * `ur::fountain::Decoder` does: a mixed part is reduced against the
 * fragments known when it arrives and then buffered; a buffered part is
 * reduced further only when a later *simple* part (or a fragment derived
 * while processing one) arrives, so completion can need more parts than a
 * decoder that re-reduces its buffer after every part. A later simple part
 * replaces a fragment derived earlier, and the reassembled message is not
 * checked against the parts' checksum field.
 */
export declare class FountainDecoder {
  #private;
  /**
   * Feed a part. Returns whether it added information: `false` once done
   * and for a repeated index set. The part's `data` is copied, never kept.
   * @throws {URError} `InvalidParameter` unless `part` is an object whose
   * `seqNum`, `seqLen` and `messageLen` are non-negative safe integers,
   * `checksum` a `u32` and `data` a `Uint8Array`; `Decoder` for an empty part ("expected non-empty part") or one
   * inconsistent with the first ("part is inconsistent with previous ones").
   */
  add(part: FountainPart): boolean;
  /** Whether as many fragments are decoded as the message has; `result` is then defined or throws. */
  get done(): boolean;
  /** Fraction of the message's fragments decoded. */
  get progress(): number;
  /**
   * The message once `done`, else `undefined`: the decoded fragments in
   * order, cut to `messageLen`. The decoder does not change once done, so
   * the first outcome is kept and returned (or thrown) again.
   * @throws {URError} `Decoder` when a fragment in `0..seqLen` is missing or
   * the fragments do not cover `messageLen` ("expected item"), or when a
   * byte past `messageLen` is not zero ("invalid padding").
   */
  get result(): Uint8Array<ArrayBuffer> | undefined;
  /** Forget every part received. */
  reset(): void;
}
//#endregion
//# sourceMappingURL=fountain.d.mts.map