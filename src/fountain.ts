/**
 * The Luby-transform fountain code behind multipart URs: a message is cut
 * into equal fragments, each part XORs a pseudo-random subset of them
 * (chosen from a xoshiro stream seeded by the part number and the message
 * checksum), and a decoder recovers the fragments as the reference's
 * `ur::fountain::Decoder` does.
 *
 * @module @blockchaincommons/uniform-resources/fountain
 */
import { crc32 } from "@blockchaincommons/crypto";
import { encodeCbor } from "@blockchaincommons/dcbor";
import {
  NON_NEGATIVE,
  POSITIVE,
  U32,
  expectBytes,
  expectInt,
  expectRecord,
  expectUsize,
  isBytes,
  isIntIn,
} from "./domain.js";
import { URError } from "./error.js";
import { PartCborError, PartReader } from "./part-cbor.js";
import { Xoshiro256, seedFor } from "./xoshiro.js";

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

// The reference's field types, an argument fault outside them; each field is read once.
function expectPart(part: FountainPart): FountainPart {
  const record = expectRecord("part", part);
  return {
    seqNum: expectInt("seqNum", record["seqNum"], NON_NEGATIVE),
    seqLen: expectInt("seqLen", record["seqLen"], NON_NEGATIVE),
    messageLen: expectInt("messageLen", record["messageLen"], NON_NEGATIVE),
    checksum: expectInt("checksum", record["checksum"], U32),
    data: expectBytes("data", record["data"]),
  };
}

const divCeil = (a: number, b: number): number => Math.floor(a / b) + (a % b > 0 ? 1 : 0);

/**
 * The fragment length that cuts `dataLength` into the fewest fragments of at most `maxFragmentLength`, evenly.
 * @throws {URError} `InvalidParameter` unless `dataLength` is an integer ≥ 0 and `maxFragmentLength` an integer ≥ 1.
 */
export function fragmentLength(dataLength: number, maxFragmentLength: number): number {
  expectInt("dataLength", dataLength, NON_NEGATIVE);
  expectInt("maxFragmentLength", maxFragmentLength, POSITIVE);
  return divCeil(dataLength, divCeil(dataLength, maxFragmentLength));
}

/**
 * Cut `data` into `fragmentLen`-byte fragments, zero-padding the last.
 * @throws {URError} `InvalidParameter` unless `data` is a `Uint8Array` and `fragmentLen` an integer ≥ 1.
 */
export function partition(data: Uint8Array, fragmentLen: number): Uint8Array<ArrayBuffer>[] {
  expectBytes("data", data);
  expectInt("fragmentLength", fragmentLen, POSITIVE);
  const count = divCeil(data.length, fragmentLen);
  const fragments: Uint8Array<ArrayBuffer>[] = [];
  for (let i = 0; i < count; i++) {
    const f = new Uint8Array(fragmentLen);
    f.set(data.subarray(i * fragmentLen, (i + 1) * fragmentLen));
    fragments.push(f);
  }
  return fragments;
}

/**
 * `partition` at `fragmentLength`; an empty message has no fragments.
 * @throws {URError} `InvalidParameter` unless `message` is a `Uint8Array` and `maxFragmentLen` an integer ≥ 1.
 */
export function splitMessage(
  message: Uint8Array,
  maxFragmentLen: number,
): Uint8Array<ArrayBuffer>[] {
  expectBytes("message", message);
  expectInt("maxFragmentLength", maxFragmentLen, POSITIVE);
  if (message.length === 0) return [];
  return partition(message, fragmentLength(message.length, maxFragmentLen));
}

/**
 * `target ^= source` over the shorter length, as the reference's `xor` zips
 * the two slices in its release build.
 * @throws {URError} `InvalidParameter` unless both are `Uint8Array`s.
 */
export function xorInto(target: Uint8Array, source: Uint8Array): void {
  expectBytes("target", target);
  expectBytes("source", source);
  const n = Math.min(target.length, source.length);
  for (let i = 0; i < n; i++) target[i] ^= source[i];
}

// The reference's `choose_fragments` for an already-validated part.
function fragmentIndexes(seqNum: number, seqLen: number, checksum: number): number[] {
  if (seqNum <= seqLen) return [seqNum - 1];
  const rng = new Xoshiro256(seedFor(checksum, seqNum));
  const degree = rng.chooseDegree(seqLen);
  const indices = Array.from({ length: seqLen }, (_, i) => i);
  return rng.shuffled(indices).slice(0, degree);
}

/**
 * The fragment indices part `seqNum` mixes: itself while `seqNum ≤ seqLen`, then a seeded random subset.
 * @throws {URError} `InvalidParameter` unless `seqNum` and `seqLen` are integers ≥ 1 and `checksum` is a `u32`.
 */
export function chooseFragments(seqNum: number, seqLen: number, checksum: number): number[] {
  expectInt("seqNum", seqNum, POSITIVE);
  expectInt("seqLen", seqLen, POSITIVE);
  expectInt("checksum", checksum, U32);
  return fragmentIndexes(seqNum, seqLen, checksum);
}

/**
 * XOR of the fragments at `indices`.
 * @throws {URError} `InvalidParameter` unless `fragments` is a non-empty array of `Uint8Array`s and `indices` a non-empty array of indexes into it.
 */
export function mixFragments(
  fragments: readonly Uint8Array[],
  indices: readonly number[],
): Uint8Array<ArrayBuffer> {
  const fragmentList: unknown = fragments;
  if (!Array.isArray(fragmentList) || fragmentList.length === 0 || !fragmentList.every(isBytes)) {
    throw URError.invalidParameter("fragments", fragments, "a non-empty array of Uint8Array");
  }
  const indexList: unknown = indices;
  if (!Array.isArray(indexList) || indexList.length === 0) {
    throw URError.invalidParameter("indices", indices, "a non-empty array of fragment indexes");
  }
  const out = new Uint8Array(fragments[0].length);
  for (const index of indexList as unknown[]) {
    const fragment = isIntIn(index, NON_NEGATIVE) ? fragments[index] : undefined;
    if (fragment === undefined) {
      throw URError.invalidParameter("indices", index, `an index below ${fragments.length}`);
    }
    xorInto(out, fragment);
  }
  return out;
}

/**
 * Encode a part as its CBOR array. `seqNum`, `seqLen` and `messageLen` are
 * written as `u32`s, truncated as the reference's `as u32` truncates them.
 * @throws {URError} `InvalidParameter` unless the counters are integers ≥ 0, `checksum` a `u32` and `data` a `Uint8Array`.
 */
export function encodeFountainPart(part: FountainPart): Uint8Array<ArrayBuffer> {
  const p = expectPart(part);
  return encodeCbor([p.seqNum >>> 0, p.seqLen >>> 0, p.messageLen >>> 0, p.checksum, p.data]);
}

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
export function decodeFountainPart(bytes: Uint8Array): FountainPart {
  expectBytes("bytes", bytes);
  try {
    const reader = new PartReader(bytes);
    if (reader.array() !== 5n) {
      throw new PartCborError("decode error: invalid CBOR array length");
    }
    const seqNum = reader.u32();
    const seqLen = reader.u32();
    const messageLen = reader.u32();
    const checksum = reader.u32();
    const data = Uint8Array.from(reader.bytes());
    return { seqNum, seqLen, messageLen, checksum, data };
  } catch (error) {
    if (error instanceof PartCborError) throw URError.decoder(error.message, error);
    throw error;
  }
}

/**
 * Produces parts forever; the first `partCount` are the plain fragments.
 *
 * The sequence is infinite by design: `Array.from(encoder)` never returns.
 * Iterate with `for … of` and `break`, or take a prefix with the iterator
 * helpers (`encoder[Symbol.iterator]().take(n)`, Node ≥ 22).
 */
export class FountainEncoder implements Iterable<FountainPart> {
  readonly #fragments: Uint8Array[];
  readonly #messageLen: number;
  readonly #checksum: number;
  #seqNum = 0;

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
  constructor(message: Uint8Array, maxFragmentLen: number | bigint) {
    expectBytes("message", message);
    if (message.length === 0) throw URError.decoder("expected non-empty message");
    if (maxFragmentLen === 0 || maxFragmentLen === 0n) {
      throw URError.decoder("expected positive maximum fragment length");
    }
    const max = expectUsize("maxFragmentLength", maxFragmentLen, 1n);
    // `fragment_length(len, max)` is `len` whenever `max ≥ len`, so the
    // computation stays within `number` precision for any `max`.
    const effective = Number(max < BigInt(message.length) ? max : BigInt(message.length));
    this.#messageLen = message.length;
    this.#checksum = crc32(message);
    this.#fragments = partition(message, fragmentLength(message.length, effective));
  }

  /** Number of fragments; parts beyond it are mixtures. */
  get partCount(): number {
    return this.#fragments.length;
  }

  /** Parts produced so far. */
  get index(): number {
    return this.#seqNum;
  }

  /** Whether every plain fragment has been emitted at least once. */
  get done(): boolean {
    return this.#seqNum >= this.#fragments.length;
  }

  /** Whether the message fits in one fragment. */
  get isSinglePart(): boolean {
    return this.#fragments.length === 1;
  }

  /** The next part: a plain fragment while `seqNum ≤ partCount`, then a mixture. */
  nextPart(): FountainPart {
    this.#seqNum++;
    const indices = fragmentIndexes(this.#seqNum, this.partCount, this.#checksum);
    return {
      seqNum: this.#seqNum,
      seqLen: this.partCount,
      messageLen: this.#messageLen,
      checksum: this.#checksum,
      data: mixFragments(this.#fragments, indices),
    };
  }

  /** Start again from part 1. */
  reset(): void {
    this.#seqNum = 0;
  }

  /** Parts, forever. */
  *[Symbol.iterator](): Iterator<FountainPart> {
    for (;;) yield this.nextPart();
  }
}

/**
 * The fragment index a part with `seqNum` 0 lands on. The reference computes
 * `sequence - 1`, which wraps to `usize::MAX` in its release build; the
 * decoder counts that index but never exposes it.
 */
const WRAPPED_INDEX = -1;
const WRAPPED_INDEX_KEY = "18446744073709551615";

/** Indexes in generated order as one key; the reference keys its sets by `Vec<usize>`. */
const keyOf = (indexes: readonly number[]): string =>
  indexes.map((i) => (i === WRAPPED_INDEX ? WRAPPED_INDEX_KEY : String(i))).join(",");

/** `BTreeMap<Vec<usize>>` key order: element-wise, a prefix before a longer key. */
function compareIndexes(a: readonly number[], b: readonly number[]): number {
  const ordinal = (i: number): number => (i === WRAPPED_INDEX ? Number.POSITIVE_INFINITY : i);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return ordinal(a[i]) < ordinal(b[i]) ? -1 : 1;
  }
  return a.length - b.length;
}

interface BufferedPart {
  readonly indexes: readonly number[];
  readonly data: Uint8Array;
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
export class FountainDecoder {
  readonly #decoded = new Map<number, Uint8Array>();
  readonly #received = new Set<string>();
  readonly #buffer = new Map<string, BufferedPart>();
  readonly #queue: { index: number; data: Uint8Array }[] = [];
  #sequenceCount = 0;
  #messageLength = 0;
  #checksum = 0;
  #fragmentLength = 0;
  #result: Uint8Array<ArrayBuffer> | URError | undefined;

  /**
   * Feed a part. Returns whether it added information: `false` once done
   * and for a repeated index set. The part's `data` is copied, never kept.
   * @throws {URError} `InvalidParameter` unless `part` is an object whose
   * `seqNum`, `seqLen` and `messageLen` are non-negative safe integers,
   * `checksum` a `u32` and `data` a `Uint8Array`; `Decoder` for an empty part ("expected non-empty part") or one
   * inconsistent with the first ("part is inconsistent with previous ones").
   */
  add(part: FountainPart): boolean {
    const p = expectPart(part);
    const data = Uint8Array.from(p.data);
    if (this.done) return false;
    if (p.seqLen === 0 || data.length === 0 || p.messageLen === 0) {
      throw URError.decoder("expected non-empty part");
    }
    if (this.#received.size === 0) {
      this.#sequenceCount = p.seqLen;
      this.#messageLength = p.messageLen;
      this.#checksum = p.checksum;
      this.#fragmentLength = data.length;
    } else if (
      p.seqLen !== this.#sequenceCount ||
      p.messageLen !== this.#messageLength ||
      p.checksum !== this.#checksum ||
      data.length !== this.#fragmentLength
    ) {
      throw URError.decoder("part is inconsistent with previous ones");
    }
    const indexes = fragmentIndexes(p.seqNum, this.#sequenceCount, this.#checksum);
    const key = keyOf(indexes);
    if (this.#received.has(key)) return false;
    this.#received.add(key);
    if (indexes.length === 1) this.#processSimple(indexes[0], data);
    else this.#processComplex(indexes, data);
    return true;
  }

  #processSimple(index: number, data: Uint8Array): void {
    this.#decoded.set(index, data);
    this.#queue.push({ index, data });
    this.#processQueue();
  }

  // Pops simple parts (last in, first out) and reduces every buffered part
  // that contains the index, in key order; a part left with one index is
  // decoded and queued in turn.
  #processQueue(): void {
    for (let next = this.#queue.pop(); next !== undefined; next = this.#queue.pop()) {
      const { index, data: simple } = next;
      const toProcess = [...this.#buffer.values()]
        .filter((b) => b.indexes.includes(index))
        .sort((a, b) => compareIndexes(a.indexes, b.indexes));
      for (const buffered of toProcess) {
        this.#buffer.delete(keyOf(buffered.indexes));
        const indexes = [...buffered.indexes];
        indexes.splice(indexes.indexOf(index), 1);
        xorInto(buffered.data, simple);
        if (indexes.length === 1) {
          this.#decoded.set(indexes[0], buffered.data);
          this.#queue.push({ index: indexes[0], data: buffered.data });
        } else {
          this.#buffer.set(keyOf(indexes), { indexes, data: buffered.data });
        }
      }
    }
  }

  // Reduces a mixed part against the fragments decoded so far; the queue is
  // not drained here.
  #processComplex(indexes: readonly number[], data: Uint8Array): void {
    const remaining = [...indexes];
    const toRemove = indexes.filter((i) => this.#decoded.has(i));
    if (remaining.length === toRemove.length) return;
    for (const remove of toRemove) {
      remaining.splice(remaining.indexOf(remove), 1);
      const fragment = this.#decoded.get(remove);
      if (fragment !== undefined) xorInto(data, fragment);
    }
    if (remaining.length === 1) {
      this.#decoded.set(remaining[0], data);
      this.#queue.push({ index: remaining[0], data });
    } else {
      this.#buffer.set(keyOf(remaining), { indexes: remaining, data });
    }
  }

  /** Whether as many fragments are decoded as the message has; `result` is then defined or throws. */
  get done(): boolean {
    return this.#messageLength !== 0 && this.#decoded.size === this.#sequenceCount;
  }

  /** Fraction of the message's fragments decoded. */
  get progress(): number {
    if (this.#sequenceCount === 0) return 0;
    let decoded = 0;
    for (const i of this.#decoded.keys()) if (i >= 0 && i < this.#sequenceCount) decoded++;
    return Math.min(1, decoded / this.#sequenceCount);
  }

  /**
   * The message once `done`, else `undefined`: the decoded fragments in
   * order, cut to `messageLen`. The decoder does not change once done, so
   * the first outcome is kept and returned (or thrown) again.
   * @throws {URError} `Decoder` when a fragment in `0..seqLen` is missing or
   * the fragments do not cover `messageLen` ("expected item"), or when a
   * byte past `messageLen` is not zero ("invalid padding").
   */
  get result(): Uint8Array<ArrayBuffer> | undefined {
    if (!this.done) return undefined;
    this.#result ??= this.#message();
    if (this.#result instanceof URError) throw this.#result;
    return this.#result.slice();
  }

  #message(): Uint8Array<ArrayBuffer> | URError {
    const combined = new Uint8Array(this.#sequenceCount * this.#fragmentLength);
    for (let i = 0; i < this.#sequenceCount; i++) {
      const fragment = this.#decoded.get(i);
      if (fragment === undefined) return URError.decoder("expected item");
      combined.set(fragment, i * this.#fragmentLength);
    }
    if (this.#messageLength > combined.length) return URError.decoder("expected item");
    for (let i = this.#messageLength; i < combined.length; i++) {
      if (combined[i] !== 0) return URError.decoder("invalid padding");
    }
    return combined.slice(0, this.#messageLength);
  }

  /** Forget every part received. */
  reset(): void {
    this.#decoded.clear();
    this.#received.clear();
    this.#buffer.clear();
    this.#queue.length = 0;
    this.#sequenceCount = 0;
    this.#messageLength = 0;
    this.#checksum = 0;
    this.#fragmentLength = 0;
    this.#result = undefined;
  }
}
