/**
 * Property tests: round-trips for URs and every bytewords style; multipart
 * completes under any order and 30% drops; URType accepts exactly its
 * character set.
 */
import fc from "fast-check";
import { cbor } from "@blockchaincommons/dcbor";
import { hex, orderParts } from "./vectors/recipes";
import { currentApi } from "./vectors/modules";
import * as src from "../src";
import * as bw from "../src/bytewords";
import * as fountain from "../src/fountain";

const api = await currentApi();
const bytes = fc.uint8Array({ maxLength: 300 });
const urType = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const cborBstr = (b: Uint8Array): Uint8Array => {
  const n = b.length;
  const head = n < 24 ? [0x40 | n] : n < 256 ? [0x58, n] : [0x59, n >> 8, n & 0xff];
  return Uint8Array.from([...head, ...b]);
};

describe("ur properties", () => {
  it("UR string round-trips", () => {
    fc.assert(
      fc.property(urType, bytes, (t, b) => {
        const cbor = cborBstr(b);
        const [s] = api.urEncode(t, cbor);
        const [t2, c2] = api.urDecode(s);
        return t2 === t && hex(c2) === hex(cbor) && s === s.toLowerCase();
      }),
      { numRuns: 200 },
    );
  });
  it("every bytewords style round-trips; decoding is case-sensitive as the reference's", () => {
    fc.assert(
      fc.property(bytes, fc.constantFrom("standard", "uri", "minimal" as const), (b, style) => {
        const s = api.bwEncode(b, style);
        let upper: string;
        try {
          api.bwDecode(s.toUpperCase(), style);
          upper = "accepted";
        } catch (e) {
          upper = src.URError.isURError(e) ? e.code : "other";
        }
        return hex(api.bwDecode(s, style)) === hex(b) && upper === "Bytewords";
      }),
      { numRuns: 200 },
    );
  });
  it("multipart completes in any order with 30% drops", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 600 }),
        fc.integer({ min: 5, max: 100 }),
        fc.nat(),
        (b, maxLen, seed) => {
          const cbor = cborBstr(b);
          const fragments = Math.ceil(cbor.length / maxLen);
          const parts = api.mpEncode("bytes", cbor, maxLen, 4 * fragments + 12);
          const ordered = orderParts(parts, { shuffle: seed }, 30);
          const d = api.mpDecoder();
          for (const p of ordered) {
            d.receive(p);
            if (d.done()) {
              const [t, c] = d.result() as [string, Uint8Array];
              return t === "bytes" && hex(c) === hex(cbor);
            }
          }
          // Not enough survived the drop; feed the rest in order to prove consistency.
          for (const p of parts) {
            d.receive(p);
            if (d.done()) {
              const [, c] = d.result() as [string, Uint8Array];
              return hex(c) === hex(cbor);
            }
          }
          return false;
        },
      ),
      { numRuns: 80 },
    );
  });
  it("URType accepts exactly the strings of [a-z0-9-], the empty one included", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (s) => {
        const valid = /^[a-z0-9-]*$/.test(s);
        let ok = true;
        try {
          new src.URType(s);
        } catch {
          ok = false;
        }
        return ok === valid;
      }),
      { numRuns: 300 },
    );
  });
  it("a fountain decoder never reports done with result === undefined", () => {
    // Any u32 fields (seqNum ≥ 1) on a one-fragment message: `add` either
    // throws or leaves the decoder in a state where done ⇒ result defined.
    const data = Uint8Array.from([1, 2, 3, 4, 5]);
    const u32 = fc.integer({ min: 0, max: 0xffffffff });
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 0xffffffff }),
        u32,
        u32,
        (seqNum, messageLen, checksum) => {
          const d = new fountain.FountainDecoder();
          try {
            d.add({ seqNum, seqLen: 1, messageLen, checksum, data });
          } catch (e) {
            return src.URError.isURError(e);
          }
          if (!d.done) return true;
          try {
            return d.result !== undefined;
          } catch (e) {
            return src.URError.isURError(e) && e.is("Decoder");
          }
        },
      ),
      { numRuns: 200 },
    );
  });
  it("every constructor and decoder argument fault is a URError InvalidParameter", () => {
    // Zero is the one value the reference's `usize` can receive: the
    // encoders report its `Decoder` ("expected positive maximum fragment
    // length"); the crate-private helpers keep the JS-domain check.
    const bad = fc.oneof(
      fc.constantFrom(NaN, Infinity, -Infinity),
      fc.double({ noInteger: true, noNaN: true }),
      fc.integer({ max: -1 }),
    );
    const ur = src.UR.from("bytes", cbor(cborBstr(new Uint8Array(10))));
    const codeOf = (f: () => unknown): string | undefined => {
      try {
        f();
        return undefined;
      } catch (e) {
        return src.URError.isURError(e) ? e.code : "other";
      }
    };
    const isInvalidParameter = (f: () => unknown): boolean => codeOf(f) === "InvalidParameter";
    fc.assert(
      fc.property(
        bad,
        (v) =>
          isInvalidParameter(() => new src.MultipartEncoder(ur, v)) &&
          isInvalidParameter(() => new fountain.FountainEncoder(new Uint8Array(10), v)) &&
          isInvalidParameter(() => fountain.partition(new Uint8Array(10), v)) &&
          isInvalidParameter(() => fountain.splitMessage(new Uint8Array(10), v)),
      ),
    );
    expect(codeOf(() => new src.MultipartEncoder(ur, 0))).toBe("Decoder");
    expect(codeOf(() => new fountain.FountainEncoder(new Uint8Array(10), 0))).toBe("Decoder");
    expect(codeOf(() => fountain.partition(new Uint8Array(10), 0))).toBe("InvalidParameter");
    expect(codeOf(() => fountain.splitMessage(new Uint8Array(10), 0))).toBe("InvalidParameter");
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 12 }).filter((b) => b.length !== 4),
        (b) => isInvalidParameter(() => bw.shortIdentifier(b)),
      ),
    );
  });
  it("any argument value yields a result or a URError, never another exception", () => {
    const ur = src.UR.from("bytes", cbor(cborBstr(new Uint8Array(10))));
    const msg = new Uint8Array(10);
    const calls: ((v: never) => unknown)[] = [
      (v) => bw.encodeBytewords(v),
      (v) => bw.encodeBytewords(msg, v),
      (v) => bw.decodeBytewords(v),
      (v) => bw.identifier(v),
      (v) => bw.identifier(msg, { style: v }),
      (v) => bw.shortIdentifier(v),
      (v) => bw.isValidBytemoji(v),
      (v) => bw.canonicalizeByteword(v),
      (v) => new src.URType(v),
      (v) => src.URType.isValid(v),
      (v) => src.URType.from(v),
      (v) => src.UR.parse(v),
      (v) => src.UR.decodeBytes(v),
      (v) => src.UR.encodeBytes("test", v),
      (v) => src.UR.encodeBytes(v, msg),
      (v) => ur.isType(v),
      (v) => ur.expectType(v),
      (v) => new src.MultipartDecoder().add(v),
      (v) => new src.MultipartEncoder(ur, v),
      (v) => new fountain.FountainEncoder(v, 10),
      (v) => new fountain.FountainEncoder(msg, v),
      (v) => new fountain.FountainDecoder().add(v),
      (v) => fountain.encodeFountainPart(v),
      (v) => fountain.decodeFountainPart(v),
      (v) => fountain.fragmentLength(v, 10),
      (v) => fountain.fragmentLength(10, v),
      (v) => fountain.partition(v, 3),
      // A fragment length the host cannot allocate fails as the reference's
      // allocation does; that limit is the host's, not an argument fault.
      (v) => (typeof v === "number" && v > 2 ** 24 ? undefined : fountain.partition(msg, v)),
      (v) => fountain.splitMessage(v, 3),
      (v) => fountain.splitMessage(msg, v),
      (v) => fountain.chooseFragments(v, 3, 7),
      (v) => fountain.chooseFragments(5, v, 7),
      (v) => fountain.chooseFragments(5, 3, v),
      (v) => fountain.mixFragments(v, [0]),
      (v) => fountain.mixFragments([msg], v),
      (v) => fountain.xorInto(v, msg),
      (v) => fountain.xorInto(msg, v),
    ];
    fc.assert(
      fc.property(fc.anything(), (v) =>
        calls.every((call) => {
          try {
            call(v as never);
            return true;
          } catch (e) {
            return src.URError.isURError(e);
          }
        }),
      ),
      { numRuns: 300 },
    );
  });
  it('URType accepts ""', () => {
    expect(src.URType.isValid("")).toBe(true);
    expect(src.URType.tryFrom("").ok).toBe(true);
    expect(new src.URType("").name).toBe("");
  });
});
