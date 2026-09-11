/**
 * Multipart URs for an animated QR: the encoder is an infinite fountain of
 * part strings; the decoder reassembles from any subset, in any order.
 *
 *   bun examples/animated-qr.ts
 */
import { cbor } from "@blockchaincommons/dcbor";
import { MultipartDecoder, MultipartEncoder, UR } from "../src/index";

const payload = Uint8Array.from({ length: 300 }, (_, i) => (i * 7) & 0xff);
const ur = UR.from("bytes", cbor(payload));

// Parts of at most 50 bytes of payload each; the first `partCount` parts
// are the plain fragments, everything after is a mixture.
const encoder = new MultipartEncoder(ur, 50);
console.log("fragments ", encoder.partCount);

// Simulate a lossy camera: skip every third frame. `for … of` on the
// encoder never ends by itself — break when the decoder is done.
const decoder = new MultipartDecoder();
let frame = 0;
for (const part of encoder) {
  frame++;
  if (frame % 3 === 0) continue;
  decoder.add(part);
  console.log(`frame ${String(frame).padStart(2)}  ${part.slice(0, 22)}…  ${Math.round(decoder.progress * 100)}%`);
  if (decoder.done) break;
}
console.log("recovered ", decoder.result?.equals(ur));
