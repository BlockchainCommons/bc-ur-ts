import { isIntIn, POSITIVE, U32, U32_POSITIVE } from "../src/domain";

describe("domain", () => {
  it("u32 accepts integers in [0, 2^32 - 1] only", () => {
    for (const v of [0, 1, 0xffff, 0xffffffff]) expect(isIntIn(v, U32)).toBe(true);
    for (const v of [-1, 0x100000000, 2 ** 40, 1.5, NaN, Infinity]) {
      expect(isIntIn(v, U32)).toBe(false);
    }
  });
  it("positive u32 rejects 0", () => {
    expect(isIntIn(0, U32_POSITIVE)).toBe(false);
    expect(isIntIn(1, U32_POSITIVE)).toBe(true);
    expect(isIntIn(0xffffffff, U32_POSITIVE)).toBe(true);
  });
  it("positive usize accepts safe integers from 1", () => {
    for (const v of [1, 10, 2 ** 53 - 1]) expect(isIntIn(v, POSITIVE)).toBe(true);
    for (const v of [0, -1, 1.5, NaN, Infinity, -Infinity, 2 ** 53]) {
      expect(isIntIn(v, POSITIVE)).toBe(false);
    }
  });
});
