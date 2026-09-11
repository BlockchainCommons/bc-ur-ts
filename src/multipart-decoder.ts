/**
 * Multipart UR decoding.
 *
 * @module multipart-decoder
 */
import { decodeCbor } from "@blockchaincommons/dcbor";
import { URError } from "./error.js";
import { UR } from "./ur.js";
import { URType } from "./ur-type.js";
import { FountainDecoder, decodeFountainPart } from "./fountain.js";
import { decodeBytewords } from "./bytewords.js";

const SEQ = /^(\d+)-(\d+)$/;

/**
 * Reassembles a UR from part strings in any order; a single-part string
 * completes it at once. Any case is accepted. A part is rejected when its
 * URL header is not two `u16`s or disagrees with its CBOR, when its fields
 * are inconsistent with earlier parts, and — once complete — when the
 * reassembled message's padding is not zero or its checksum fails.
 */
export class MultipartDecoder {
  #type: URType | undefined;
  #fountain: FountainDecoder | undefined;
  #result: UR | undefined;

  /**
   * Feed a part (any case). Returns whether it added information.
   * @throws {URError} `InvalidScheme`, `InvalidType`, `UnexpectedType` when
   * the type differs from earlier parts, `Bytewords`, `Cbor`, or `Decoder`
   * (a header that is not two `u16`s — "Invalid indices" — or that disagrees
   * with the CBOR, a part field outside `u32`, an inconsistent part, and on
   * completion non-zero padding or a checksum mismatch).
   */
  add(part: string): boolean {
    if (this.#result !== undefined) return false;
    const s = part.toLowerCase();
    if (!s.startsWith("ur:")) throw URError.invalidScheme();
    const components = s.slice(3).split("/");
    const type = new URType(components[0] ?? "");
    if (this.#type === undefined) this.#type = type;
    else if (!this.#type.equals(type)) throw URError.unexpectedType(this.#type.name, type.name);

    const seq = components.length >= 3 ? SEQ.exec(components[1]) : null;
    if (seq === null) {
      this.#result = UR.parse(part);
      return true;
    }
    const fountainPart = decodeFountainPart(
      decodeBytewords(components.slice(2).join("/"), "minimal"),
    );
    const seqNum = Number(seq[1]);
    const seqLen = Number(seq[2]);
    // The reference parses the header as two `u16`s and stops there; the
    // comparison with the CBOR below is this port's stricter check.
    if (seqNum > 0xffff || seqLen > 0xffff) throw URError.decoder("Invalid indices");
    if (fountainPart.seqNum !== seqNum || fountainPart.seqLen !== seqLen) {
      throw URError.decoder(
        `Multipart metadata mismatch: URL says ${seqNum}-${seqLen}, CBOR says ${fountainPart.seqNum}-${fountainPart.seqLen}`,
      );
    }
    this.#fountain ??= new FountainDecoder();
    const progressed = this.#fountain.add(fountainPart);
    if (this.#fountain.done) {
      // `result` is defined whenever `done`; it throws `Decoder` for
      // non-zero padding or a checksum mismatch.
      const message = this.#fountain.result as Uint8Array;
      try {
        this.#result = new UR(type, decodeCbor(message));
      } catch (error) {
        throw URError.cbor(error instanceof Error ? error.message : String(error), error);
      }
    }
    return progressed;
  }

  /** Whether the UR has been reassembled. */
  get done(): boolean {
    return this.#result !== undefined;
  }

  /** The UR once `done`. */
  get result(): UR | undefined {
    return this.#result;
  }

  /** Fraction of fragments recovered (1 once done). */
  get progress(): number {
    if (this.#result !== undefined) return 1;
    return this.#fountain?.progress ?? 0;
  }

  /** Forget every part received. */
  reset(): void {
    this.#type = undefined;
    this.#fountain = undefined;
    this.#result = undefined;
  }
}
