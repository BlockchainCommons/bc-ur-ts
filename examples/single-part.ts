/**
 * A dcbor-tagged value as a single-part UR: `urFor` names the UR after the
 * value's first tag, `decodeURWith` reads it back through the value's codec.
 *
 *   bun examples/single-part.ts
 */
import {
  type Cbor,
  type CborCodec,
  Tag,
  cbor,
  expectBytes,
  expectTaggedContent,
  taggedValue,
} from "@blockchaincommons/dcbor";
import { UR, URError, decodeURWith, urFor } from "../src/index";

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// A tag with a name: the name becomes the UR type (`ur:seed/…`).
const TAG_SEED = Tag.from(40300, "seed");

class Seed {
  constructor(readonly bytes: Uint8Array) {}
  cborTags(): Tag[] {
    return [TAG_SEED];
  }
  toCbor(): Cbor {
    return taggedValue(TAG_SEED, cbor(this.bytes));
  }
  static readonly codec: CborCodec<Seed> = {
    tags: [TAG_SEED],
    encode: (s) => s.toCbor(),
    decode: (c) => new Seed(expectBytes(expectTaggedContent(c, TAG_SEED.value))),
  };
}

const seed = new Seed(Uint8Array.from({ length: 16 }, (_, i) => i * 17));
const ur = urFor(seed);
console.log("ur        ", ur.toString());
console.log("qr        ", ur.toQRString());

// Back from the string: parse, check the type, decode through the codec.
const parsed = UR.parse(ur.toString());
console.log("type      ", parsed.type.name);
console.log("bytes     ", hex(decodeURWith(parsed, Seed.codec).bytes));

// A UR of another type is refused by the codec.
try {
  decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), Seed.codec);
} catch (e) {
  if (URError.isURError(e)) console.log("wrong type", e.code, "-", e.message);
}
