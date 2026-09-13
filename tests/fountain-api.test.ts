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
import { encodeCbor } from "@blockchaincommons/dcbor";

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
  it("rejects an empty message and a fragment length that is not an integer ≥ 1", () => {
    const code = (f: () => unknown): string | undefined => {
      try {
        f();
        return undefined;
      } catch (e) {
        return URError.isURError(e) ? e.code : (e as Error).name;
      }
    };
    // The `ur` crate's `fountain::Encoder::new`, in its order: `EmptyMessage`,
    // then `InvalidFragmentLen` — both `Error::UR`, so `Decoder` here.
    expect(code(() => new FountainEncoder(new Uint8Array(0), 10))).toBe("Decoder");
    expect(() => new FountainEncoder(new Uint8Array(0), 0)).toThrow("expected non-empty message");
    expect(code(() => new FountainEncoder(msg, 0))).toBe("Decoder");
    expect(() => new FountainEncoder(msg, 0)).toThrow("expected positive maximum fragment length");
    for (const max of [1.5, NaN]) {
      expect(code(() => new FountainEncoder(msg, max))).toBe("InvalidParameter");
    }
    // `splitMessage` / `partition` mirror crate-private helpers with no
    // reference outcome: the JS domain check applies to 0 as well.
    for (const max of [0, 1.5, NaN]) {
      expect(code(() => splitMessage(msg, max))).toBe("InvalidParameter");
      expect(code(() => partition(msg, max))).toBe("InvalidParameter");
    }
    expect(splitMessage(new Uint8Array(0), 10)).toEqual([]);
    expect(code(() => mixFragments([msg], []))).toBe("InvalidParameter");
    expect(code(() => mixFragments([msg], [3]))).toBe("InvalidParameter");
    expect(() => mixFragments([msg], [3])).toThrow("indices must be an index below 1, got 3");
  });
  it("part fields are u32 with seqNum ≥ 1, on the wire (Decoder) and hand-built (InvalidParameter) (B4)", () => {
    const data = Uint8Array.from([1, 2, 3, 4, 5]);
    const good = new FountainEncoder(data, 5).nextPart();
    const wire = (fields: number[]) => decodeFountainPart(encodeCbor([...fields, data]));
    expect(wire([1, 1, 5, good.checksum])).toEqual({ ...good, data });
    for (const fields of [
      [2 ** 40, 1, 5, good.checksum],
      [0, 1, 5, good.checksum],
      [1, 2 ** 32, 5, good.checksum],
      [1, 1, 2 ** 32, good.checksum],
      [1, 1, 5, 2 ** 32],
    ]) {
      try {
        wire(fields);
        throw new Error("expected throw");
      } catch (e) {
        expect(URError.isURError(e) && e.code).toBe("Decoder");
      }
    }
    for (const part of [
      { ...good, seqNum: 0 },
      { ...good, seqNum: 2 ** 40 },
      { ...good, seqNum: NaN },
      { ...good, seqNum: 1.5 },
      { ...good, seqLen: -1 },
      { ...good, messageLen: 2 ** 40 },
      { ...good, checksum: 2 ** 32 },
    ]) {
      try {
        new FountainDecoder().add(part);
        throw new Error("expected throw");
      } catch (e) {
        expect(URError.isURError(e) && e.code).toBe("InvalidParameter");
      }
    }
  });
  it("rejects non-zero padding on reassembly (B1)", () => {
    // `44 01 02 03 04` at max 4: two 3-byte fragments, one padding byte.
    const message = encodeCbor(Uint8Array.from([1, 2, 3, 4]));
    const e = new FountainEncoder(message, 4);
    const p1 = e.nextPart();
    const p2 = e.nextPart();
    expect(p2.data.length).toBe(3);
    const padded = { ...p2, data: Uint8Array.from(p2.data) };
    padded.data[2] = 0xff;
    const d = new FountainDecoder();
    d.add(p1);
    d.add(padded);
    expect(d.done).toBe(true);
    expect(() => d.result).toThrow("invalid padding");
    const ok = new FountainDecoder();
    ok.add(p1);
    ok.add(p2);
    expect(Buffer.from(ok.result as Uint8Array)).toEqual(Buffer.from(message));
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
