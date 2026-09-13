/**
 * The checksum-free identifier encoders and byteword canonicalisation.
 */
import {
  BYTEWORDS,
  BYTEMOJIS,
  identifier,
  shortIdentifier,
  isValidBytemoji,
  canonicalizeByteword,
} from "../src/bytewords";
import { URError } from "../src";

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b);

describe("identifier", () => {
  it("standard: space-separated words, matching shortIdentifier for 4 bytes", () => {
    expect(identifier(bytes(0, 1, 2, 3))).toBe("able acid also apex");
    expect(identifier(bytes(0, 1, 2, 3))).toBe(shortIdentifier(bytes(0, 1, 2, 3)));
    expect(identifier(bytes(255))).toBe("zoom");
    expect(identifier(bytes())).toBe("");
  });
  it("maps all 256 bytes to distinct words", () => {
    const words = identifier(Uint8Array.from({ length: 256 }, (_, i) => i)).split(" ");
    expect(new Set(words).size).toBe(256);
    expect(words).toEqual([...BYTEWORDS]);
  });
  it("bytemoji: space-separated bytemojis", () => {
    expect(identifier(bytes(0, 1, 2, 3), { style: "bytemoji" })).toBe("😀 😂 😆 😉");
    expect(identifier(bytes(0, 1, 2, 3), { style: "bytemoji" })).toBe(
      shortIdentifier(bytes(0, 1, 2, 3), { style: "bytemoji" }),
    );
    expect(identifier(bytes(), { style: "bytemoji" })).toBe("");
    expect(new Set(BYTEMOJIS).size).toBe(256);
  });
  it("minimal: first+last letter of each word, no separator", () => {
    expect(identifier(bytes(0, 1, 2, 3), { style: "minimal" })).toBe("aeadaoax");
    for (let b = 0; b < 256; b++) {
      const w = BYTEWORDS[b];
      expect(identifier(bytes(b), { style: "minimal" })).toBe(w[0] + w[3]);
    }
  });
});

describe("shortIdentifier", () => {
  it("requires exactly 4 bytes (InvalidParameter)", () => {
    expect(() => shortIdentifier(bytes(1, 2, 3))).toThrow("data must be exactly 4 bytes, got 3");
    try {
      shortIdentifier(bytes(1, 2, 3, 4, 5), { style: "bytemoji" });
    } catch (e) {
      expect(URError.isURError(e) && e.details).toEqual({
        code: "InvalidParameter",
        parameter: "data",
        value: 5,
      });
    }
  });
});

describe("isValidBytemoji", () => {
  it("accepts every table entry and nothing else", () => {
    for (const e of BYTEMOJIS) expect(isValidBytemoji(e)).toBe(true);
    expect(isValidBytemoji("😀😀")).toBe(false);
    expect(isValidBytemoji("able")).toBe(false);
    expect(isValidBytemoji("")).toBe(false);
  });
});

describe("canonicalizeByteword", () => {
  it("full words, any case", () => {
    expect(canonicalizeByteword("able")).toBe("able");
    expect(canonicalizeByteword("ABLE")).toBe("able");
    expect(canonicalizeByteword("Zoom")).toBe("zoom");
    expect(canonicalizeByteword("abcd")).toBeUndefined();
  });
  it("first+last short forms", () => {
    expect(canonicalizeByteword("ae")).toBe("able");
    expect(canonicalizeByteword("ZM")).toBe("zoom");
    expect(canonicalizeByteword("zz")).toBeUndefined();
  });
  it("first-three and last-three short forms", () => {
    expect(canonicalizeByteword("abl")).toBe("able");
    expect(canonicalizeByteword("ble")).toBe("able");
    expect(canonicalizeByteword("oom")).toBe("zoom");
    expect(canonicalizeByteword("xyz")).toBeUndefined();
  });
  it("other lengths", () => {
    expect(canonicalizeByteword("")).toBeUndefined();
    expect(canonicalizeByteword("a")).toBeUndefined();
    expect(canonicalizeByteword("aeaea")).toBeUndefined();
  });
  it("round-trips every word through its full, first+last and first-three forms", () => {
    // Last-three forms can collide with another word's first three ("qua":
    // aqua vs quad); first-three wins, as it always has.
    for (const w of BYTEWORDS) {
      expect(canonicalizeByteword(w)).toBe(w);
      expect(canonicalizeByteword(w[0] + w[3])).toBe(w);
      expect(canonicalizeByteword(w.slice(0, 3))).toBe(w);
    }
    expect(canonicalizeByteword("qua")).toBe("quad");
  });
});
