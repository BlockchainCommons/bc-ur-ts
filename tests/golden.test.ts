/**
 * Golden snapshots (Phase 0.2): single-part URs over the CBOR corpus, all
 * bytewords styles, multipart parts and decoder completion index, and every
 * error code for a table of malformed inputs.
 */
import { materialize, type Recipe } from "./vectors/recipes";
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
