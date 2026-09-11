/**
 * Golden snapshots: single-part URs over the CBOR corpus, all bytewords
 * styles, multipart parts and decoder completion index, every error code
 * for a table of malformed inputs, and freeze entries for what the
 * decoders and constructors accept.
 */
import { crc32 } from "@blockchaincommons/crypto";
import {
  type Cbor,
  type CborCodec,
  Tag,
  cbor,
  encodeCbor,
  taggedValue,
} from "@blockchaincommons/dcbor";
import * as src from "../src";
import * as bw from "../src/bytewords";
import * as fountain from "../src/fountain";
import { hex, materialize, type Recipe } from "./vectors/recipes";
import { currentApi } from "./vectors/modules";
import { CBOR_CORPUS, STYLES, SPECS, MESSAGE_SIZES, MAX_LENS, categories } from "./corpus/corpus";

const api = await currentApi();
const run = (r: Recipe) => materialize(api, r);

describe("golden: single-part URs", () => {
  for (const [name, cbor] of CBOR_CORPUS) {
    it(`ur:test ${name}`, () => {
      expect(run({ k: "urEncode", type: "test", cbor })).toMatchSnapshot();
    });
  }
});
describe("golden: bytewords styles", () => {
  for (const n of [0, 1, 23, 24, 255, 256, 1024]) {
    it(`len ${n}`, () => {
      expect(
        STYLES.map((style) => run({ k: "bwEncode", style, data: { cycle: n, start: 1 } })),
      ).toMatchSnapshot();
    });
  }
});
describe("golden: multipart", () => {
  for (const spec of SPECS) {
    const size = MESSAGE_SIZES.find(
      (s) => spec.cbor && (spec.cbor as { hex: string }).hex.length > 0 && s === s,
    );
    void size;
    it(`${spec.type} ${(spec.cbor as { hex: string }).hex.length / 2}B max=${spec.maxLen}: first parts and completion`, () => {
      const parts = run({ k: "mpEncode", ...spec })
        .split(" ")
        .slice(0, 40);
      expect(parts).toMatchSnapshot();
      expect([
        run({ k: "mpDecode", from: spec, order: "forward" }).split(":")[0],
        run({ k: "mpDecode", from: spec, order: "reverse" }).split(":")[0],
      ]).toMatchSnapshot();
    });
  }
  it("grid is what the plan specifies", () => {
    expect([MESSAGE_SIZES, MAX_LENS]).toEqual([
      [1, 30, 31, 100, 256, 1024, 4096],
      [10, 30, 100, 1000],
    ]);
  });
});
describe("golden: error codes", () => {
  it("malformed single-part strings", () => {
    const out: string[] = [];
    for (const r of categories["ur"]!())
      if (r.k === "urDecode") out.push(`${JSON.stringify(r.s)} → ${run(r)}`);
    expect(out).toMatchSnapshot();
  });
  it("malformed bytewords", () => {
    const out: string[] = [];
    for (const r of categories["bytewords"]!())
      if (r.k === "bwDecode") out.push(`${r.style} ${JSON.stringify(r.s)} → ${run(r)}`);
    expect(out).toMatchSnapshot();
  });
  it("malformed multipart sequences", () => {
    const out: string[] = [];
    for (const r of categories["decodeErrors"]!())
      if (r.k === "mpDecode" && "parts" in r) out.push(`${JSON.stringify(r.parts)} → ${run(r)}`);
    expect(out).toMatchSnapshot();
  });
});

/**
 * Freeze additions: what the decoders and constructors accept, recorded
 * verbatim so a regression is a visible diff. Every outcome below is one
 * B1–B5 / A1 / A3 finding.
 */
describe("golden: freeze additions", () => {
  const outcome = (f: () => unknown): string => {
    try {
      const r = f();
      return typeof r === "string" ? r : JSON.stringify(r);
    } catch (e) {
      const code = src.URError.isURError(e) ? e.code : (e as Error).constructor.name;
      return `throw:${code}:${(e as Error).message}`;
    }
  };
  const partString = (p: fountain.FountainPart, type = "bytes"): string =>
    `ur:${type}/${p.seqNum}-${p.seqLen}/${bw.encodeBytewords(fountain.encodeFountainPart(p), "minimal")}`;
  // `44 01 02 03 04` (a 4-byte CBOR byte string, 5 bytes) at maxFragmentLength
  // 4: `fragmentLength(5, 4)` is 3, so two 3-byte fragments and one padding
  // byte at the end of the second. (A 6-byte message gives two 3-byte
  // fragments and NO padding — the first cut of this test wrote past the
  // array and recorded nothing.)
  const message = encodeCbor(Uint8Array.from([1, 2, 3, 4]));
  const twoFragments = () => {
    const e = new fountain.FountainEncoder(message, 4);
    return [e.nextPart(), e.nextPart()] as const;
  };

  it("B1: a part whose padding is not zero", () => {
    const [p1, p2] = twoFragments();
    expect([message.length, p2.data.length]).toEqual([5, 3]);
    const padded = { ...p2, data: Uint8Array.from(p2.data) };
    padded.data[2] = 0xff;
    expect([
      `part strings: ${partString(p1)} ${partString(padded)}`,
      `FountainDecoder: ${outcome(() => {
        const d = new fountain.FountainDecoder();
        d.add(p1);
        d.add(padded);
        return `done=${d.done} result=${d.result === undefined ? "undefined" : hex(d.result)}`;
      })}`,
      `MultipartDecoder: ${outcome(() => {
        const d = new src.MultipartDecoder();
        d.add(partString(p1));
        d.add(partString(padded));
        return `done=${d.done} result=${d.result?.toString()}`;
      })}`,
    ]).toMatchSnapshot();
  });

  it("B2: the empty UR type", () => {
    expect([
      `new URType(""): ${outcome(() => `name=${JSON.stringify(new src.URType("").name)}`)}`,
      `UR.from("", [1,2,3]).toString(): ${outcome(() => src.UR.from("", cbor([1, 2, 3])).toString())}`,
      `UR.parse("ur:/lsadaoaxjygonesw"): ${outcome(() => {
        const u = src.UR.parse("ur:/lsadaoaxjygonesw");
        return `type=${JSON.stringify(u.type.name)} cbor=${hex(u.cbor.toData())}`;
      })}`,
      `MultipartDecoder.add("ur:/lsadaoaxjygonesw"): ${outcome(() => new src.MultipartDecoder().add("ur:/lsadaoaxjygonesw"))}`,
    ]).toMatchSnapshot();
  });

  it("B3: MultipartEncoder maxFragmentLength domain", () => {
    const ur = src.UR.from("bytes", cbor(Uint8Array.from({ length: 20 }, (_, i) => i)));
    const first = (max: number) =>
      outcome(() => new src.MultipartEncoder(ur, max).nextPart().split("/")[1]);
    expect([
      `1.5: ${first(1.5)}`,
      `NaN: ${first(NaN)}`,
      `0: ${first(0)}`,
      `-1: ${first(-1)}`,
      `Infinity: ${first(Infinity)}`,
      `10: ${first(10)}`,
    ]).toMatchSnapshot();
  });

  it("B4: fountain part fields", () => {
    const data = Uint8Array.from([1, 2, 3, 4, 5]);
    const checksum = crc32(data);
    const add = (seqNum: number, seqLen = 1) =>
      outcome(() => {
        const d = new fountain.FountainDecoder();
        const added = d.add({ seqNum, seqLen, messageLen: 5, checksum, data });
        return `added=${added} done=${d.done} result=${d.result === undefined ? "undefined" : hex(d.result)}`;
      });
    expect([
      `decodeFountainPart seqNum 2^40: ${outcome(() => `seqNum=${fountain.decodeFountainPart(encodeCbor([2 ** 40, 1, 5, checksum, data])).seqNum}`)}`,
      `add seqNum 0: ${add(0)}`,
      `add seqNum 2^40: ${add(2 ** 40)}`,
      `add seqNum NaN: ${add(NaN)}`,
      `add seqNum 1.5 of 2: ${add(1.5, 2)}`,
      `add seqNum 1: ${add(1)}`,
    ]).toMatchSnapshot();
  });

  it("B5: URL header vs CBOR header", () => {
    const [p1] = twoFragments();
    const s1 = partString(p1);
    const big = { ...p1, seqNum: 70000, seqLen: 70000 };
    expect([
      `header 2-2 on part 1-2: ${outcome(() => new src.MultipartDecoder().add(s1.replace("/1-2/", "/2-2/")))}`,
      `header 70000-70000 agreeing with CBOR: ${outcome(() => {
        const d = new src.MultipartDecoder();
        return `added=${d.add(partString(big))} done=${d.done}`;
      })}`,
      `single-part parse of a 70000-1 header: ${outcome(() => src.UR.parse("ur:bytes/70000-1/lsadaoaxjygonesw"))}`,
    ]).toMatchSnapshot();
  });

  it("A1/A3: bridge and identifier argument faults", () => {
    const unnamed = { cborTags: () => [Tag.from(999)], toCbor: () => taggedValue(999, cbor(1)) };
    const tagless: CborCodec<Cbor> = { encode: (c) => c, decode: (c) => c };
    expect([
      `urFor(unnamed tag): ${outcome(() => src.urFor(unnamed).toString())}`,
      `decodeURWith(tagless codec): ${outcome(() => src.decodeURWith(src.UR.parse("ur:test/lsadaoaxjygonesw"), tagless))}`,
      `shortIdentifier(3 bytes): ${outcome(() => bw.shortIdentifier(new Uint8Array(3)))}`,
      `partition(data, 0): ${outcome(() => fountain.partition(new Uint8Array(4), 0).length)}`,
    ]).toMatchSnapshot();
  });
});
