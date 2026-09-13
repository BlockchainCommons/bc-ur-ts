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

/** The header's two `u16`s, parsed as the reference's `u16::from_str` does (an optional `+`, digits). */
const SEQ = /^(\+?\d+)-(\+?\d+)$/;

/**
 * Reassembles a UR from part strings in any order. Any case is accepted
 * (the whole string is lower-cased, as `UR::from_ur_string` does). A part
 * is rejected when it is a single-part UR (decode those with `UR.parse`;
 * the reference's `MultipartDecoder` rejects them too), when its URL header
 * is not two `u16`s, when its fields are inconsistent with earlier parts,
 * and — once complete — when the reassembled message's padding is not zero
 * or its checksum fails. The header is otherwise informational: the
 * fountain fields come from the part's CBOR, as in the reference.
 */
export class MultipartDecoder {
  #type: URType | undefined;
  #fountain: FountainDecoder | undefined;
  #result: UR | undefined;

  /**
   * Feed a part (any case). Returns whether it added information.
   * @throws {URError} `InvalidScheme`, `TypeUnspecified`, `InvalidType`,
   * `UnexpectedType` when the type differs from earlier parts, `Bytewords`,
   * `Cbor`, or `Decoder` (a single-part UR — "Can't decode single-part UR as
   * multi-part" —, a header that is not two `u16`s — "Invalid indices" —, a
   * part field outside `u32`, an inconsistent part, and on completion
   * non-zero padding or a checksum mismatch).
   */
  add(part: string): boolean {
    if (this.#result !== undefined) return false;
    const s = part.toLowerCase();
    if (!s.startsWith("ur:")) throw URError.invalidScheme();
    const body = s.slice(3);
    const slash = body.indexOf("/");
    const type = new URType(slash === -1 ? body : body.slice(0, slash));
    if (this.#type === undefined) this.#type = type;
    else if (!this.#type.equals(type)) throw URError.unexpectedType(this.#type.name, type.name);
    if (slash === -1) throw URError.typeUnspecified();

    // The reference splits at the LAST slash: everything between the type
    // and it is the `seqNum-seqLen` header, what follows is the payload.
    const rest = body.slice(slash + 1);
    const lastSlash = rest.lastIndexOf("/");
    if (lastSlash === -1) {
      throw URError.decoder("Can't decode single-part UR as multi-part");
    }
    const seq = SEQ.exec(rest.slice(0, lastSlash));
    if (seq === null || Number(seq[1]) > 0xffff || Number(seq[2]) > 0xffff) {
      throw URError.decoder("Invalid indices");
    }
    const fountainPart = decodeFountainPart(decodeBytewords(rest.slice(lastSlash + 1), "minimal"));
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
