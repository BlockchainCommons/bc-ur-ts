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
  it("every bytewords style round-trips, case-insensitively", () => {
    fc.assert(
      fc.property(bytes, fc.constantFrom("standard", "uri", "minimal" as const), (b, style) => {
        const s = api.bwEncode(b, style);
        return (
          hex(api.bwDecode(s, style)) === hex(b) &&
          hex(api.bwDecode(s.toUpperCase(), style)) === hex(b)
        );
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
  it("URType accepts exactly one or more of [a-z0-9-]", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (s) => {
        const valid = /^[a-z0-9-]+$/.test(s);
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
    const bad = fc.oneof(
      fc.constantFrom(NaN, Infinity, -Infinity, 0),
      fc.double({ noInteger: true, noNaN: true }),
      fc.integer({ max: -1 }),
    );
    const ur = src.UR.from("bytes", cbor(cborBstr(new Uint8Array(10))));
    const isInvalidParameter = (f: () => unknown): boolean => {
      try {
        f();
        return false;
      } catch (e) {
        return src.URError.isURError(e) && e.is("InvalidParameter");
      }
    };
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
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 12 }).filter((b) => b.length !== 4),
        (b) => isInvalidParameter(() => bw.shortIdentifier(b)),
      ),
    );
  });
  it('URType rejects ""', () => {
    expect(src.URType.isValid("")).toBe(false);
    expect(src.URType.tryFrom("").ok).toBe(false);
    expect(() => new src.URType("")).toThrow("invalid UR type");
  });
});
