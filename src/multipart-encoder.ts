/**
 * Multipart UR encoding.
 *
 * @module multipart-encoder
 */
import type { UR } from "./ur.js";
import { FountainEncoder, encodeFountainPart, type FountainPart } from "./fountain.js";
import { encodeBytewords } from "./bytewords.js";

/**
 * Emits `ur:<type>/<seqNum>-<seqLen>/<bytewords>` part strings forever;
 * iterate it, or call `nextPart` to step.
 */
export class MultipartEncoder implements Iterable<string> {
  readonly #type: string;
  readonly #fountain: FountainEncoder;

  /** @throws {RangeError} for `maxFragmentLength < 1`. */
  constructor(ur: UR, maxFragmentLength: number) {
    if (maxFragmentLength < 1) throw new RangeError("max fragment length must be at least 1");
    this.#type = ur.type.name;
    this.#fountain = new FountainEncoder(ur.cbor.toData(), maxFragmentLength);
  }

  /** Parts produced so far. */
  get index(): number {
    return this.#fountain.index;
  }

  /** Number of fragments; parts beyond it are mixtures. */
  get partCount(): number {
    return this.#fountain.partCount;
  }

  nextPart(): string {
    return this.#encode(this.#fountain.nextPart());
  }

  #encode(part: FountainPart): string {
    return `ur:${this.#type}/${part.seqNum}-${part.seqLen}/${encodeBytewords(encodeFountainPart(part), "minimal")}`;
  }

  *[Symbol.iterator](): Iterator<string> {
    for (;;) yield this.nextPart();
  }
}
