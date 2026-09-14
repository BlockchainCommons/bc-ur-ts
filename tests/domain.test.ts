/**
 * The argument domains: integer bounds, the exact `usize` form, byte arrays
 * from any realm, and how a rejected value is rendered.
 */
import { runInNewContext } from "node:vm";
import { URError } from "../src";
import { isBytes, isIntIn, POSITIVE, U32, usizeOf } from "../src/domain";

describe("domain", () => {
  it("u32 accepts integers in [0, 2^32 - 1] only", () => {
    for (const v of [0, 1, 0xffff, 0xffffffff]) expect(isIntIn(v, U32)).toBe(true);
    for (const v of [-1, 0x100000000, 2 ** 40, 1.5, NaN, Infinity, "1", 1n]) {
      expect(isIntIn(v, U32)).toBe(false);
    }
  });
  it("positive usize accepts safe integers from 1", () => {
    for (const v of [1, 10, 2 ** 53 - 1]) expect(isIntIn(v, POSITIVE)).toBe(true);
    for (const v of [0, -1, 1.5, NaN, Infinity, -Infinity, 2 ** 53]) {
      expect(isIntIn(v, POSITIVE)).toBe(false);
    }
  });
  it("usizeOf: a safe integer number or a bigint up to 2^64 - 1, exactly", () => {
    expect(usizeOf(0)).toBe(0n);
    expect(usizeOf(-0)).toBe(0n);
    expect(usizeOf(2 ** 53 - 1)).toBe(9007199254740991n);
    expect(usizeOf(0n)).toBe(0n);
    expect(usizeOf(2n ** 64n - 1n)).toBe(18446744073709551615n);
    for (const v of [2 ** 53, 2 ** 64, -1, 1.5, NaN, Infinity, -1n, 2n ** 64n, "2", null, {}]) {
      expect(usizeOf(v)).toBeUndefined();
    }
  });
  it("isBytes accepts a Uint8Array from any realm, Buffer included, and no other view", () => {
    expect(isBytes(new Uint8Array(2))).toBe(true);
    expect(isBytes(Buffer.from([1]))).toBe(true);
    expect(isBytes(runInNewContext("new Uint8Array(2)"))).toBe(true);
    for (const v of [new Uint16Array(1), new DataView(new ArrayBuffer(1)), [1], "ab", null]) {
      expect(isBytes(v)).toBe(false);
    }
  });
  it("InvalidParameter renders the received value so that no two values read alike", () => {
    const got = (v: unknown): string => URError.invalidParameter("p", v, "x").message;
    expect(got(NaN)).toBe("p must be x, got NaN");
    expect(got(1.5)).toBe("p must be x, got 1.5");
    expect(got(9007199254740992)).toBe("p must be x, got 9007199254740992");
    expect(got(2 ** 64)).toBe("p must be x, got 18446744073709551616");
    expect(got(2n)).toBe("p must be x, got 2n");
    expect(got("2")).toBe('p must be x, got "2"');
    expect(got(null)).toBe("p must be x, got null");
    expect(got(undefined)).toBe("p must be x, got undefined");
    expect(got([1, 2])).toBe("p must be x, got Array");
    expect(got({})).toBe("p must be x, got Object");
    expect(got(Object.create(null))).toBe("p must be x, got object");
    expect(got(new Uint16Array(1))).toBe("p must be x, got Uint16Array");
    expect(got(() => 1)).toBe("p must be x, got function");
    const e = URError.invalidParameter("p", 2n, "x");
    expect(e.details).toEqual({ code: "InvalidParameter", parameter: "p", value: 2n });
  });
});
