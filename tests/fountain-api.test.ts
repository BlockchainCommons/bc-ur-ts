/**
 * The /fountain subpath's public surface beyond the cross-platform fixtures:
 * iteration, single-part detection, reset, progress, and argument errors.
 */
import {
  FountainEncoder,
  FountainDecoder,
  splitMessage,
  partition,
  mixFragments,
  xorInto,
  encodeFountainPart,
  decodeFountainPart,
} from "../src/fountain";
import { URError } from "../src";

const msg = Uint8Array.from({ length: 100 }, (_, i) => (i * 3) & 0xff);

describe("FountainEncoder", () => {
  it("iterates forever, detects single-part messages, and resets", () => {
    const e = new FountainEncoder(msg, 30);
    expect(e.partCount).toBe(4);
    expect(e.isSinglePart).toBe(false);
    const seen: number[] = [];
    for (const p of e) {
      seen.push(p.seqNum);
      if (seen.length === 6) break;
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
    expect(e.index).toBe(6);
    expect(e.done).toBe(true);
    e.reset();
    expect(e.index).toBe(0);
    expect(e.done).toBe(false);
    expect(new FountainEncoder(msg, 1000).isSinglePart).toBe(true);
  });
  it("rejects an empty message and a fragment length below 1", () => {
    expect(() => new FountainEncoder(new Uint8Array(0), 10)).toThrow(RangeError);
    expect(() => new FountainEncoder(msg, 0)).toThrow(RangeError);
    expect(() => splitMessage(msg, 0)).toThrow(RangeError);
    expect(() => partition(msg, 0)).toThrow(RangeError);
    expect(splitMessage(new Uint8Array(0), 10)).toEqual([]);
    expect(() => mixFragments([msg], [])).toThrow(RangeError);
    expect(() => mixFragments([msg], [3])).toThrow(RangeError);
  });
  it("part CBOR round-trips and rejects malformed arrays", () => {
    const part = new FountainEncoder(msg, 30).nextPart();
    const back = decodeFountainPart(encodeFountainPart(part));
    expect(back).toEqual({ ...part, data: back.data });
    expect(Buffer.from(back.data)).toEqual(Buffer.from(part.data));
    for (const bad of ["01", "8301020304", "8501020304f6", "85010203046161"]) {
      try {
        decodeFountainPart(Uint8Array.from(Buffer.from(bad, "hex")));
        throw new Error("expected throw");
      } catch (e) {
        expect(URError.isURError(e) && e.code).toBe("Decoder");
      }
    }
  });
  it("xorInto handles a shorter source", () => {
    const t = Uint8Array.from([1, 2, 3]);
    xorInto(t, Uint8Array.from([1]));
    expect([...t]).toEqual([0, 2, 3]);
  });
});

describe("FountainDecoder", () => {
  it("reports progress, ignores repeats after completion, and resets", () => {
    const e = new FountainEncoder(msg, 30);
    const d = new FountainDecoder();
    expect(d.progress).toBe(0);
    expect(d.result).toBeUndefined();
    expect(d.add(e.nextPart())).toBe(true);
    expect(d.progress).toBe(0.25);
    for (const p of e) {
      d.add(p);
      if (d.done) break;
    }
    expect(Buffer.from(d.result as Uint8Array)).toEqual(Buffer.from(msg));
    expect(d.add(e.nextPart())).toBe(false);
    d.reset();
    expect(d.done).toBe(false);
    expect(d.progress).toBe(0);
  });
  it("a repeated index set adds nothing", () => {
    const e = new FountainEncoder(msg, 30);
    const d = new FountainDecoder();
    const p = e.nextPart();
    expect(d.add(p)).toBe(true);
    expect(d.add(p)).toBe(false);
  });
});
