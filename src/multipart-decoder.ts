/**
 * Multipart UR decoding.
 *
 * @module multipart-decoder
 */
import { type Cbor, decodeCbor } from "@blockchaincommons/dcbor";
import { URError } from "./error.js";
import { UR } from "./ur.js";
import { URType } from "./ur-type.js";
import { FountainDecoder, decodeFountainPart } from "./fountain.js";
import { decodeBytewordsOrReason } from "./bytewords-decode.js";
import { isMultipartHeader } from "./header.js";
import { expectString } from "./domain.js";

/**
 * Reassembles a UR from part strings in any order, as the reference's
 * `MultipartDecoder` over `ur::Decoder::receive` does.
 *
 * Parts are case-sensitive: the reference's `receive` never lower-cases
 * (only `UR::from_ur_string` does), so lower-case a QR payload before
 * `add`. Every string is checked in full, before and after completion:
 * the scheme, the type against the first part's, the `seqNum-seqLen`
 * header, the bytewords and the part CBOR. The header is otherwise
 * informational: the fountain fields come from the part's CBOR. `done`
 * follows the fountain decoder, and `result` reassembles and decodes the
 * message when first read after completion.
 */
export class MultipartDecoder {
  #type: URType | undefined;
  readonly #fountain = new FountainDecoder();
  #result: UR | URError | undefined;

  /**
   * Feed a part. Returns whether it added information: `false` for a
   * repeated index set and once done.
   * @throws {URError} In the reference's order: `InvalidScheme` (no `ur:`,
   * an upper-case scheme included), `InvalidType` (the first component),
   * `UnexpectedType` when the type differs from the first part's, then
   * `Decoder` for what `ur::decode` and the fountain decoder reject: "No
   * type specified" (no slash after the type), "Invalid indices" (a header
   * that is not two `u16`s), the bytewords failure ("invalid word",
   * "invalid checksum", …), "Can't decode single-part UR as multi-part" (no
   * header, once its bytewords decoded), the part codec's messages,
   * "expected non-empty part" and "part is inconsistent with previous ones".
   * `InvalidParameter` for a non-string.
   */
  add(part: string): boolean {
    expectString("part", part);
    if (!part.startsWith("ur:")) throw URError.invalidScheme();
    const rest = part.slice(3);
    const slash = rest.indexOf("/");
    const type = new URType(slash === -1 ? rest : rest.slice(0, slash));
    if (this.#type === undefined) this.#type = type;
    else if (!this.#type.equals(type)) throw URError.unexpectedType(this.#type.name, type.name);
    if (slash === -1) throw URError.decoder("No type specified");
    // `ur::decode`: everything up to the last slash is the header, checked
    // before the payload; without a second slash the payload is decoded
    // and then rejected as single-part.
    const tail = rest.slice(slash + 1);
    const last = tail.lastIndexOf("/");
    if (last === -1) {
      const decoded = decodeBytewordsOrReason(tail, "minimal");
      if (typeof decoded === "string") throw URError.decoder(decoded);
      throw URError.decoder("Can't decode single-part UR as multi-part");
    }
    if (!isMultipartHeader(tail.slice(0, last))) throw URError.decoder("Invalid indices");
    const bytes = decodeBytewordsOrReason(tail.slice(last + 1), "minimal");
    if (typeof bytes === "string") throw URError.decoder(bytes);
    return this.#fountain.add(decodeFountainPart(bytes));
  }

  /** Whether the message is reassembled: the fountain decoder's `done`. */
  get done(): boolean {
    return this.#fountain.done;
  }

  /**
   * The UR once `done`, else `undefined`. The message is reassembled and
   * decoded when first read after completion; that outcome, the UR or the
   * error, is kept and returned or thrown again, as the decoder does not
   * change once done.
   * @throws {URError} `Decoder` for what the fountain decoder's result
   * rejects ("expected item", "invalid padding"); `Cbor` when the message
   * is not valid dCBOR.
   */
  get result(): UR | undefined {
    const type = this.#type;
    if (!this.done || type === undefined) return undefined;
    this.#result ??= this.#decode(type);
    if (this.#result instanceof URError) throw this.#result;
    return this.#result;
  }

  #decode(type: URType): UR | URError {
    let message: Uint8Array;
    try {
      message = this.#fountain.result as Uint8Array;
    } catch (error) {
      if (URError.isURError(error)) return error;
      throw error;
    }
    let cbor: Cbor;
    try {
      cbor = decodeCbor(message);
    } catch (error) {
      return URError.cbor(error instanceof Error ? error.message : String(error), error);
    }
    return new UR(type, cbor);
  }

  /** Fraction of fragments decoded (1 once done). */
  get progress(): number {
    return this.done ? 1 : this.#fountain.progress;
  }

  /** Forget every part received. */
  reset(): void {
    this.#type = undefined;
    this.#fountain.reset();
    this.#result = undefined;
  }
}
