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
 *
 * The sequence is infinite by design (a fountain code): `Array.from(encoder)`
 * and `[...encoder]` never return. Iterate with `for … of` and `break` when
 * the receiver is done, or take a prefix with the iterator helpers
 * (`encoder[Symbol.iterator]().take(n)`, Node ≥ 22).
 */
export class MultipartEncoder implements Iterable<string> {
  readonly #type: string;
  readonly #fountain: FountainEncoder;

  /**
   * Parts of at most `maxFragmentLength` payload bytes each. The length is
   * the reference's `usize`: a safe integer `number`, or a `bigint` up to
   * 2⁶⁴ − 1 (a `number` of 2⁵³ or more is not accepted, as it may already
   * have been rounded).
   * @throws {URError} `Decoder` ("expected positive maximum fragment
   * length") for 0; `InvalidParameter` for any other value outside that
   * domain.
   */
  constructor(ur: UR, maxFragmentLength: number | bigint) {
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

  /** The next part string. */
  nextPart(): string {
    return this.#encode(this.#fountain.nextPart());
  }

  #encode(part: FountainPart): string {
    return `ur:${this.#type}/${part.seqNum}-${part.seqLen}/${encodeBytewords(encodeFountainPart(part), "minimal")}`;
  }

  /** Part strings, forever. */
  *[Symbol.iterator](): Iterator<string> {
    for (;;) yield this.nextPart();
  }
}
