/**
 * The Luby-transform fountain code behind multipart URs: a message is cut
 * into equal fragments, each part XORs a pseudo-random subset of them
 * (chosen from a xoshiro stream seeded by the part number and the message
 * checksum), and a decoder recovers the fragments by peeling.
 *
 * @module @blockchaincommons/uniform-resources/fountain
 */
import { crc32 } from "@blockchaincommons/crypto";
import {
  encodeCbor,
  decodeCbor,
  expectArray,
  expectBytes,
  expectUnsigned,
} from "@blockchaincommons/dcbor";
import { POSITIVE, U32, U32_POSITIVE, expectInt, isIntIn } from "./domain.js";
import { URError } from "./error.js";
import { Xoshiro256, seedFor } from "./xoshiro.js";

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

// `parameter` must be a u32 (and, for `seqNum`, ≥ 1); an argument fault.
function expectPartFields(part: FountainPart): void {
  expectInt("seqNum", part.seqNum, U32_POSITIVE);
  expectInt("seqLen", part.seqLen, U32);
  expectInt("messageLen", part.messageLen, U32);
  expectInt("checksum", part.checksum, U32);
}

const divCeil = (a: number, b: number): number => Math.floor(a / b) + (a % b > 0 ? 1 : 0);

/** The fragment length that cuts `dataLength` into the fewest fragments of at most `maxFragmentLength`, evenly. */
export function fragmentLength(dataLength: number, maxFragmentLength: number): number {
  return divCeil(dataLength, divCeil(dataLength, maxFragmentLength));
}

/**
 * Cut `data` into `fragmentLen`-byte fragments, zero-padding the last.
 * @throws {URError} `InvalidParameter` unless `fragmentLen` is an integer ≥ 1.
 */
export function partition(data: Uint8Array, fragmentLen: number): Uint8Array<ArrayBuffer>[] {
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
 * @throws {URError} `InvalidParameter` unless `maxFragmentLen` is an integer ≥ 1.
 */
export function splitMessage(
  message: Uint8Array,
  maxFragmentLen: number,
): Uint8Array<ArrayBuffer>[] {
  expectInt("maxFragmentLength", maxFragmentLen, POSITIVE);
  if (message.length === 0) return [];
  return partition(message, fragmentLength(message.length, maxFragmentLen));
}

/** `target ^= source` over `target`'s length (`source` may be shorter). */
export function xorInto(target: Uint8Array, source: Uint8Array): void {
  const n = Math.min(target.length, source.length);
  for (let i = 0; i < n; i++) target[i] ^= source[i];
}

/** The fragment indices part `seqNum` mixes: itself while `seqNum ≤ seqLen`, then a seeded random subset. */
export function chooseFragments(seqNum: number, seqLen: number, checksum: number): number[] {
  if (seqNum <= seqLen) return [seqNum - 1];
  const rng = new Xoshiro256(seedFor(checksum, seqNum));
  const degree = rng.chooseDegree(seqLen);
  const indices = Array.from({ length: seqLen }, (_, i) => i);
  return rng.shuffled(indices).slice(0, degree);
}

/**
 * XOR of the fragments at `indices`.
 * @throws {URError} `InvalidParameter` for no indices or an index with no fragment.
 */
export function mixFragments(
  fragments: readonly Uint8Array[],
  indices: readonly number[],
): Uint8Array<ArrayBuffer> {
  if (indices.length === 0) throw URError.invalidParameter("indices", 0, "at least one index");
  const out = new Uint8Array(fragments[0].length);
  for (const index of indices) {
    const fragment = fragments[index];
    if (fragment === undefined) {
      throw URError.invalidParameter("indices", index, `an index below ${fragments.length}`);
    }
    xorInto(out, fragment);
  }
  return out;
}

/** Encode a part as its CBOR array. */
export function encodeFountainPart(part: FountainPart): Uint8Array<ArrayBuffer> {
  return encodeCbor([part.seqNum, part.seqLen, part.messageLen, part.checksum, part.data]);
}

/**
 * Decode a part from its CBOR array.
 * @throws {URError} `Decoder` for anything but a five-element array of four
 * `u32`s (`seqNum` ≥ 1) and a byte string.
 */
export function decodeFountainPart(bytes: Uint8Array): FountainPart {
  let items: readonly unknown[];
  try {
    items = expectArray(decodeCbor(bytes));
  } catch (error) {
    throw URError.decoder("Invalid multipart data: expected CBOR array", error);
  }
  if (items.length !== 5)
    throw URError.decoder(`Invalid multipart data: expected 5 elements, got ${items.length}`);
  let part: FountainPart;
  try {
    const [a, b, c, d, e] = items as [never, never, never, never, never];
    part = {
      seqNum: Number(expectUnsigned(a)),
      seqLen: Number(expectUnsigned(b)),
      messageLen: Number(expectUnsigned(c)),
      checksum: Number(expectUnsigned(d)),
      data: expectBytes(e),
    };
  } catch (error) {
    throw URError.decoder("Invalid multipart data", error);
  }
  // The reference decodes the four integers as `u32` and needs `seqNum ≥ 1`.
  for (const [name, value, bounds] of [
    ["seqNum", part.seqNum, U32_POSITIVE],
    ["seqLen", part.seqLen, U32],
    ["messageLen", part.messageLen, U32],
    ["checksum", part.checksum, U32],
  ] as const) {
    if (!isIntIn(value, bounds)) {
      throw URError.decoder(
        `Invalid multipart data: ${name} must be in [${bounds.min}, ${bounds.max}], got ${value}`,
      );
    }
  }
  return part;
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
   * Fragments of at most `maxFragmentLen` bytes.
   * @throws {URError} `InvalidParameter` for an empty message or unless
   * `maxFragmentLen` is an integer ≥ 1.
   */
  constructor(message: Uint8Array, maxFragmentLen: number) {
    if (message.length === 0) throw URError.invalidParameter("message", 0, "non-empty");
    expectInt("maxFragmentLength", maxFragmentLen, POSITIVE);
    this.#messageLen = message.length;
    this.#checksum = crc32(message);
    this.#fragments = partition(message, fragmentLength(message.length, maxFragmentLen));
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
    const indices = chooseFragments(this.#seqNum, this.partCount, this.#checksum);
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

interface MixedPart {
  readonly indices: readonly number[];
  readonly data: Uint8Array;
}

/**
 * Reassembles a message from parts in any order. Every mixed part is kept
 * and re-reduced whenever a plain fragment appears, so completion never
 * needs more parts than the reference decoder.
 */
export class FountainDecoder {
  #seqLen: number | undefined;
  #messageLen: number | undefined;
  #checksum: number | undefined;
  #fragmentLen: number | undefined;
  readonly #pure = new Map<number, Uint8Array>();
  readonly #mixed = new Map<number, MixedPart>();
  readonly #seen = new Set<string>();

  /**
   * Feed a part. Returns whether it added information (false once done or
   * for a repeated index set).
   * @throws {URError} `InvalidParameter` unless the four integer fields are
   * `u32`s with `seqNum ≥ 1`; `Decoder` for an empty part or one
   * inconsistent with the first.
   */
  add(part: FountainPart): boolean {
    if (this.done) return false;
    expectPartFields(part);
    if (part.seqLen === 0 || part.data.length === 0 || part.messageLen === 0) {
      throw URError.decoder("expected non-empty part");
    }
    if (this.#seqLen === undefined) {
      this.#seqLen = part.seqLen;
      this.#messageLen = part.messageLen;
      this.#checksum = part.checksum;
      this.#fragmentLen = part.data.length;
    } else if (
      part.seqLen !== this.#seqLen ||
      part.messageLen !== this.#messageLen ||
      part.checksum !== this.#checksum ||
      part.data.length !== this.#fragmentLen
    ) {
      throw URError.decoder("part is inconsistent with previous ones");
    }
    const indices = chooseFragments(part.seqNum, this.#seqLen, this.#checksum ?? 0);
    const key = [...indices].sort((a, b) => a - b).join(",");
    if (this.#seen.has(key)) return false;
    this.#seen.add(key);
    if (indices.length === 1) {
      const index = indices[0];
      if (!this.#pure.has(index)) this.#pure.set(index, part.data);
    } else {
      this.#mixed.set(part.seqNum, { indices, data: part.data });
    }
    this.#reduce();
    return true;
  }

  // Peel: any mixed part with all but one index known yields that fragment;
  // repeat until nothing changes.
  #reduce(): void {
    let progress = true;
    while (progress) {
      progress = false;
      for (const [seqNum, mixed] of this.#mixed) {
        const reduced = new Uint8Array(mixed.data);
        const missing: number[] = [];
        for (const index of mixed.indices) {
          const pure = this.#pure.get(index);
          if (pure === undefined) missing.push(index);
          else xorInto(reduced, pure);
        }
        if (missing.length === 0) {
          this.#mixed.delete(seqNum);
          progress = true;
        } else if (missing.length === 1) {
          this.#pure.set(missing[0], reduced);
          this.#mixed.delete(seqNum);
          progress = true;
        }
      }
    }
  }

  /** Whether every fragment has been recovered; `result` is then defined or throws. */
  get done(): boolean {
    return this.#seqLen !== undefined && this.#pure.size === this.#seqLen;
  }

  /** Fraction of fragments recovered. */
  get progress(): number {
    return this.#seqLen === undefined ? 0 : this.#pure.size / this.#seqLen;
  }

  /**
   * The message once `done`, else `undefined`.
   * @throws {URError} `Decoder` when the fragments do not cover `messageLen`,
   * when the bytes past `messageLen` are not all zero ("invalid padding", as
   * the reference), or when the reassembled bytes fail the checksum.
   */
  get result(): Uint8Array<ArrayBuffer> | undefined {
    if (!this.done || this.#seqLen === undefined || this.#messageLen === undefined)
      return undefined;
    const fragmentLen = this.#fragmentLen ?? 0;
    if (this.#seqLen * fragmentLen < this.#messageLen) {
      throw URError.decoder("message length exceeds the fragments");
    }
    const out = new Uint8Array(this.#messageLen);
    // Once `done`, `#pure` holds exactly the indices `0..seqLen-1`.
    for (const [i, fragment] of this.#pure) {
      const start = i * fragmentLen;
      const take = Math.min(fragmentLen, this.#messageLen - start);
      out.set(fragment.subarray(0, take), start);
      for (let j = take; j < fragment.length; j++) {
        if (fragment[j] !== 0) throw URError.decoder("invalid padding");
      }
    }
    const actual = crc32(out);
    if (actual !== this.#checksum) {
      throw URError.decoder(`Checksum mismatch: expected ${this.#checksum}, got ${actual}`);
    }
    return out;
  }

  /** Forget every part received. */
  reset(): void {
    this.#seqLen = undefined;
    this.#messageLen = undefined;
    this.#checksum = undefined;
    this.#fragmentLen = undefined;
    this.#pure.clear();
    this.#mixed.clear();
    this.#seen.clear();
  }
}
