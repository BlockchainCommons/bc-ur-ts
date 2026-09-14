/**
 * The /fountain subpath's public surface beyond the cross-platform fixtures:
 * iteration, single-part detection, reset, progress, and argument errors.
 */
import {
  FountainEncoder,
  FountainDecoder,
  type FountainPart,
  chooseFragments,
  fragmentLength,
  splitMessage,
  partition,
  mixFragments,
  xorInto,
  encodeFountainPart,
  decodeFountainPart,
} from "../src/fountain";
import { URError } from "../src";
import { encodeCbor } from "@blockchaincommons/dcbor";

const chooseFragmentCount = (p: FountainPart): number =>
  chooseFragments(p.seqNum, p.seqLen, p.checksum).length;

const msg = Uint8Array.from({ length: 100 }, (_, i) => (i * 3) & 0xff);
const codeOf = (f: () => unknown): string | undefined => {
  try {
    f();
    return undefined;
  } catch (e) {
    return URError.isURError(e) ? e.code : (e as Error).name;
  }
};

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
  it("part fields: u32s on the wire (minicbor, seqNum 0 accepted); safe integers with a u32 checksum hand-built (InvalidParameter)", () => {
    const data = Uint8Array.from([1, 2, 3, 4, 5]);
    const good = new FountainEncoder(data, 5).nextPart();
    const wire = (fields: number[]) => decodeFountainPart(encodeCbor([...fields, data]));
    expect(wire([1, 1, 5, good.checksum])).toEqual({ ...good, data });
    expect(wire([0, 1, 5, good.checksum]).seqNum).toBe(0);
    const overflow = (n: number, at: number): string =>
      `UR decoder error (${n} overflows target type at position ${at}: when converting u64 to u32)`;
    for (const [fields, message] of [
      [[2 ** 40, 1, 5, good.checksum], overflow(2 ** 40, 1)],
      [[1, 2 ** 32, 5, good.checksum], overflow(2 ** 32, 2)],
      [[1, 1, 2 ** 32, good.checksum], overflow(2 ** 32, 3)],
      [[1, 1, 5, 2 ** 32], overflow(2 ** 32, 4)],
      [
        [-1, 1, 5, good.checksum],
        "UR decoder error (unexpected type i8 at position 1: expected u32)",
      ],
    ] as const) {
      expect(() => wire([...fields])).toThrow(message);
    }
    for (const part of [
      { ...good, seqNum: NaN },
      { ...good, seqNum: 1.5 },
      { ...good, seqNum: 2 ** 53 },
      { ...good, seqLen: -1 },
      { ...good, messageLen: -1 },
      { ...good, checksum: 2 ** 32 },
      { ...good, checksum: -1 },
    ]) {
      try {
        new FountainDecoder().add(part);
        throw new Error("expected throw");
      } catch (e) {
        expect(URError.isURError(e) && e.code).toBe("InvalidParameter");
      }
    }
    // The reference's `usize` counters take any value within number precision.
    expect(new FountainDecoder().add({ ...good, seqNum: 2 ** 40 })).toBe(true);
    expect(new FountainDecoder().add({ ...good, messageLen: 2 ** 40 })).toBe(true);
    // `seqNum` 0 lands on the wrapped index and counts towards completion (release build).
    const wrapped = new FountainDecoder();
    expect(wrapped.add({ ...good, seqNum: 0 })).toBe(true);
    expect(wrapped.done).toBe(true);
    expect(() => wrapped.result).toThrow("UR decoder error (expected item)");
  });
  it("copies a part's data and never mutates or keeps the caller's array", () => {
    const message = Uint8Array.from({ length: 12 }, (_, i) => i + 1);
    const e = new FountainEncoder(message, 4);
    const parts = [e.nextPart(), e.nextPart(), e.nextPart()];
    let mixed = e.nextPart();
    while (mixed.seqNum <= 3 || chooseFragmentCount(mixed) < 2) mixed = e.nextPart();
    const mixedBefore = Uint8Array.from(mixed.data);
    const d = new FountainDecoder();
    d.add(mixed);
    d.add(parts[0]);
    d.add(parts[1]);
    d.add(parts[2]);
    expect(mixed.data).toEqual(mixedBefore);
    expect(Buffer.from(d.result as Uint8Array)).toEqual(Buffer.from(message));
    parts[0].data.fill(0xff);
    expect(Buffer.from(d.result as Uint8Array)).toEqual(Buffer.from(message));
  });
  it("validates every argument before doing any work", () => {
    const data = Uint8Array.from([1, 2, 3, 4, 5]);
    const good = new FountainEncoder(data, 5).nextPart();
    expect(codeOf(() => chooseFragments(0, 3, 7))).toBe("InvalidParameter");
    expect(codeOf(() => chooseFragments(1.5, 3, 7))).toBe("InvalidParameter");
    expect(codeOf(() => chooseFragments(5, 0, 7))).toBe("InvalidParameter");
    expect(codeOf(() => chooseFragments(5, 3, 2 ** 32))).toBe("InvalidParameter");
    expect(() => new FountainDecoder().add({ ...good, data: "x" as never })).toThrow(
      'data must be a Uint8Array, got "x"',
    );
    expect(() => new FountainDecoder().add("x" as never)).toThrow(
      'part must be an object, got "x"',
    );
    expect(() => encodeFountainPart({ ...good, seqNum: NaN })).toThrow(
      "seqNum must be an integer in [0, 9007199254740991], got NaN",
    );
    expect(() => mixFragments([], [0])).toThrow(
      "fragments must be a non-empty array of Uint8Array, got Array",
    );
    expect(() => mixFragments([msg], [])).toThrow(
      "indices must be a non-empty array of fragment indexes, got Array",
    );
    expect(() => mixFragments([msg], [1.5])).toThrow("indices must be an index below 1, got 1.5");
    expect(() => fragmentLength(10, 0)).toThrow(
      "maxFragmentLength must be an integer in [1, 9007199254740991], got 0",
    );
    expect(() => fragmentLength(-1, 10)).toThrow(
      "dataLength must be an integer in [0, 9007199254740991], got -1",
    );
    expect(() => xorInto("a" as never, msg)).toThrow('target must be a Uint8Array, got "a"');
    expect(() => decodeFountainPart([1] as never)).toThrow("bytes must be a Uint8Array, got Array");
    expect(() => new FountainEncoder("abc" as never, 3)).toThrow(
      'message must be a Uint8Array, got "abc"',
    );
    expect(() => partition(msg, "3" as never)).toThrow(
      'fragmentLength must be an integer in [1, 9007199254740991], got "3"',
    );
    expect(() => splitMessage([1] as never, 3)).toThrow("message must be a Uint8Array, got Array");
    // Buffers and cross-realm arrays are byte arrays.
    expect(splitMessage(Buffer.from(msg), 30).length).toBe(4);
  });
  it("accepts a bigint maxFragmentLength up to 2^64 - 1 and rejects an unsafe number", () => {
    expect(new FountainEncoder(msg, 2n ** 64n - 1n).partCount).toBe(1);
    expect(new FountainEncoder(msg, 9007199254740992n).isSinglePart).toBe(true);
    expect(new FountainEncoder(msg, 30n).partCount).toBe(4);
    expect(() => new FountainEncoder(msg, 2 ** 53)).toThrow(
      "maxFragmentLength must be an integer in [1, 9007199254740991] or a bigint in [1, 18446744073709551615], got 9007199254740992",
    );
    expect(() => new FountainEncoder(msg, 2n ** 64n)).toThrow("got 18446744073709551616n");
    expect(() => new FountainEncoder(msg, -1n)).toThrow("got -1n");
    expect(() => new FountainEncoder(msg, 0n)).toThrow("expected positive maximum fragment length");
  });
  it("rejects non-zero padding on reassembly", () => {
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
  it("decodes part CBOR with the reference's messages (test_part_from_cbor_errors)", () => {
    const decode = (bytes: number[]) => () => decodeFountainPart(Uint8Array.from(bytes));
    expect(decode([0x18])).toThrow(
      "UR decoder error (unexpected type u8 at position 0: expected array)",
    );
    expect(decode([0x01])).toThrow("unexpected type u8 at position 0: expected array");
    expect(decode([0x84, 1, 2, 3, 4])).toThrow(
      "UR decoder error (decode error: invalid CBOR array length)",
    );
    expect(decode([0x86, 1, 2, 3, 4, 5, 6])).toThrow("decode error: invalid CBOR array length");
    const cbor = [0x85, 1, 2, 3, 4, 0x41, 5];
    for (let idx = 1; idx <= 4; idx++) {
      expect(decode(cbor)).not.toThrow();
      const bad = [...cbor];
      bad[idx] = 0x41;
      expect(decode(bad)).toThrow(`unexpected type bytes at position ${idx}: expected u32`);
    }
    expect(decode([0x85, 1, 2, 3, 4, 5])).toThrow(
      "unexpected type u8 at position 5: expected bytes (definite length)",
    );
    // A negative head names its width from the byte after the next one, as the reference's peek does.
    expect(decode([0x85, 0x38, 0x05])).toThrow("UR decoder error (end of input bytes)");
    expect(decode([0x85, 0x38, 0x05, 0xff])).toThrow(
      "unexpected type i16 at position 1: expected u32",
    );
    expect(decode([0x9c])).toThrow("unexpected type 0x1c at position 0: expected u64");
    expect(decode([])).toThrow("UR decoder error (end of input bytes)");
  });
  it("decodes u8, u16 and u32 heads and rejects u64 heads (test_part_from_cbor_unsigned_types)", () => {
    const decode = (bytes: number[]) => decodeFountainPart(Uint8Array.from(bytes));
    expect(decode([0x85, 1, 2, 3, 4, 0x41, 5])).toEqual({
      seqNum: 1,
      seqLen: 2,
      messageLen: 3,
      checksum: 4,
      data: Uint8Array.from([5]),
    });
    expect(decode([0x85, 0x19, 1, 2, 0x19, 3, 4, 0x19, 5, 6, 0x19, 7, 8, 0x41, 5]).seqNum).toBe(
      0x0102,
    );
    expect(
      decode([
        0x85, 0x1a, 1, 2, 3, 4, 0x1a, 5, 6, 7, 8, 0x1a, 9, 0x10, 0x11, 0x12, 0x1a, 0x13, 0x14, 0x15,
        0x16, 0x41, 5,
      ]).checksum,
    ).toBe(0x13141516);
    const u64 = [0x1b, 1, 2, 3, 4, 0xa, 0xb, 0xc, 0xd];
    const u32 = (n: number) => [0x1a, n, n, n, n];
    for (const at of [0, 1, 2, 3]) {
      const fields = [u32(1), u32(2), u32(3), u32(4)];
      fields[at] = u64;
      expect(() => decode([0x85, ...fields.flat(), 0x41, 5])).toThrow("converting u64 to u32");
    }
    // Trailing bytes are ignored, as `minicbor::decode` ignores them.
    expect(decode([0x85, 1, 2, 3, 4, 0x41, 5, 0xff]).data).toEqual(Uint8Array.from([5]));
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
