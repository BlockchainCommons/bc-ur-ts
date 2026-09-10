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

/** Reassembles a UR from part strings in any order; a single-part string completes it at once. */
export class MultipartDecoder {
  #type: URType | undefined;
  #fountain: FountainDecoder | undefined;
  #result: UR | undefined;

  /**
   * Feed a part (any case). Returns whether it added information.
   * @throws {URError} `InvalidScheme`, `InvalidType`, `UnexpectedType` when
   * the type differs from earlier parts, `Bytewords`, `Cbor`, or `Decoder`.
   */
  add(part: string): boolean {
    if (this.#result !== undefined) return false;
    const s = part.toLowerCase();
    if (!s.startsWith("ur:")) throw URError.invalidScheme();
    const components = s.slice(3).split("/");
    if (components[0] === undefined || components[0] === "") throw URError.invalidType();
    const type = new URType(components[0]);
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
    if (fountainPart.seqNum !== seqNum || fountainPart.seqLen !== seqLen) {
      throw URError.decoder(
        `Multipart metadata mismatch: URL says ${seqNum}-${seqLen}, CBOR says ${fountainPart.seqNum}-${fountainPart.seqLen}`,
      );
    }
    this.#fountain ??= new FountainDecoder();
    const progressed = this.#fountain.add(fountainPart);
    if (this.#fountain.done) {
      const message = this.#fountain.result;
      if (message !== undefined) {
        try {
          this.#result = new UR(type, decodeCbor(message));
        } catch (error) {
          throw URError.cbor(error instanceof Error ? error.message : String(error), error);
        }
      }
    }
    return progressed;
  }

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

  reset(): void {
    this.#type = undefined;
    this.#fountain = undefined;
    this.#result = undefined;
  }
}
