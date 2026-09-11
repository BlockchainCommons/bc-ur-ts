/**
 * xoshiro256** on 32-bit lanes, seeded from 32 bytes (four big-endian
 * u64s), with the double/int/shuffle/degree samplers the fountain code
 * draws from. Internal; the same core as `@blockchaincommons/rand`.
 *
 * @internal
 * @module xoshiro
 */
import { sha256 } from "@blockchaincommons/crypto";

const TWO_32 = 4294967296;
const TWO_64 = 18446744073709551616;

export class Xoshiro256 {
  private readonly s = new Uint32Array(8); // [s0lo, s0hi, s1lo, s1hi, …]
  private outLo = 0;
  private outHi = 0;

  /** @throws {RangeError} unless `seed` is 32 bytes. */
  constructor(seed: Uint8Array) {
    if (seed.length !== 32) throw new RangeError(`seed must be 32 bytes, got ${seed.length}`);
    const v = new DataView(seed.buffer, seed.byteOffset, 32);
    for (let i = 0; i < 4; i++) {
      this.s[i * 2 + 1] = v.getUint32(i * 8, false);
      this.s[i * 2] = v.getUint32(i * 8 + 4, false);
    }
  }

  private step(): void {
    const s = this.s;
    const s0lo = s[0],
      s0hi = s[1],
      s1lo = s[2],
      s1hi = s[3],
      s2lo = s[4],
      s2hi = s[5],
      s3lo = s[6],
      s3hi = s[7];

    // result = rotl(s1 * 5, 7) * 9
    let p = s1lo * 5;
    const mlo = p >>> 0;
    const mhi = (Math.imul(s1hi, 5) + Math.floor(p / TWO_32)) >>> 0;
    const rlo = ((mlo << 7) | (mhi >>> 25)) >>> 0;
    const rhi = ((mhi << 7) | (mlo >>> 25)) >>> 0;
    p = rlo * 9;
    this.outLo = p >>> 0;
    this.outHi = (Math.imul(rhi, 9) + Math.floor(p / TWO_32)) >>> 0;

    const tlo = (s1lo << 17) >>> 0;
    const thi = ((s1hi << 17) | (s1lo >>> 15)) >>> 0;
    let n2lo = (s2lo ^ s0lo) >>> 0,
      n2hi = (s2hi ^ s0hi) >>> 0;
    let n3lo = (s3lo ^ s1lo) >>> 0,
      n3hi = (s3hi ^ s1hi) >>> 0;
    const n1lo = (s1lo ^ n2lo) >>> 0,
      n1hi = (s1hi ^ n2hi) >>> 0;
    const n0lo = (s0lo ^ n3lo) >>> 0,
      n0hi = (s0hi ^ n3hi) >>> 0;
    n2lo = (n2lo ^ tlo) >>> 0;
    n2hi = (n2hi ^ thi) >>> 0;
    // rotl(s3, 45) = swap halves, then rotl 13
    const swlo = n3hi,
      swhi = n3lo;
    n3lo = ((swlo << 13) | (swhi >>> 19)) >>> 0;
    n3hi = ((swhi << 13) | (swlo >>> 19)) >>> 0;

    s[0] = n0lo;
    s[1] = n0hi;
    s[2] = n1lo;
    s[3] = n1hi;
    s[4] = n2lo;
    s[5] = n2hi;
    s[6] = n3lo;
    s[7] = n3hi;
  }

  nextU64(): bigint {
    this.step();
    return (BigInt(this.outHi) << 32n) | BigInt(this.outLo);
  }

  /** The next output as a double in [0, 1): the 64-bit value divided by 2^64. */
  nextDouble(): number {
    this.step();
    // hi·2^32 + lo rounds once, exactly as Number(bigint) would.
    return (this.outHi * TWO_32 + this.outLo) / TWO_64;
  }

  /** Uniform-ish integer in `[low, high]` from one double. */
  nextInt(low: number, high: number): number {
    return Math.floor(this.nextDouble() * (high - low + 1)) + low;
  }

  nextByte(): number {
    return this.nextInt(0, 255);
  }

  nextData(count: number): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) out[i] = this.nextByte();
    return out;
  }

  /** Fisher–Yates by repeated removal, the order the reference uses. */
  shuffled<T>(items: readonly T[]): T[] {
    const source = [...items];
    const out: T[] = [];
    while (source.length > 0) {
      const index = this.nextInt(0, source.length - 1);
      out.push(source.splice(index, 1)[0]);
    }
    return out;
  }

  /** A degree in `1..=seqLen` with probability ∝ 1/degree (alias sampling). */
  chooseDegree(seqLen: number): number {
    const weights = Array.from({ length: seqLen }, (_, i) => 1 / (i + 1));
    return new AliasSampler(weights).next(this) + 1;
  }
}

/** Walker alias method over non-negative weights; the construction order is wire. */
class AliasSampler {
  private readonly aliases: number[];
  private readonly probs: number[];

  constructor(weights: readonly number[]) {
    const n = weights.length;
    const sum = weights.reduce((a, b) => a + b, 0);
    const normalized = weights.map((w) => (w * n) / sum);
    this.aliases = new Array<number>(n).fill(0);
    this.probs = new Array<number>(n).fill(0);
    const small: number[] = [];
    const large: number[] = [];
    for (let i = n - 1; i >= 0; i--) (normalized[i] < 1 ? small : large).push(i);
    while (small.length > 0 && large.length > 0) {
      const a = small.pop();
      const g = large.pop();
      if (a === undefined || g === undefined) break;
      this.probs[a] = normalized[a];
      this.aliases[a] = g;
      normalized[g] = normalized[g] + normalized[a] - 1;
      (normalized[g] < 1 ? small : large).push(g);
    }
    for (const g of large) this.probs[g] = 1;
    for (const a of small) this.probs[a] = 1;
  }

  next(rng: Xoshiro256): number {
    const r1 = rng.nextDouble();
    const r2 = rng.nextDouble();
    const i = Math.floor(this.probs.length * r1);
    return r2 < this.probs[i] ? i : this.aliases[i];
  }
}

/** The fountain seed for a part: `sha256(seqNum ‖ checksum)`, both big-endian u32. */
export function seedFor(checksum: number, seqNum: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, seqNum, false);
  v.setUint32(4, checksum, false);
  return sha256(bytes);
}
