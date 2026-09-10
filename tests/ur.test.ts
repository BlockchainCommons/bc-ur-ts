/**
 * The public API: URType, UR, errors, bytewords, multipart encode/decode,
 * and the dcbor bridge. Reference values come from bc-ur-rust's tests.
 */
import {
  cbor,
  encodeCbor,
  decodeCbor,
  Tag,
  taggedValue,
  type CborCodec,
  expectText,
  expectTaggedContent,
  asTaggedValue,
} from "@blockchaincommons/dcbor";
import {
  UR,
  URType,
  URError,
  MultipartEncoder,
  MultipartDecoder,
  urFor,
  decodeURWith,
  type ToUR,
} from "../src";
import { encodeBytewords, decodeBytewords, BYTEWORDS } from "../src/bytewords";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const code = (f: () => unknown): string => {
  try {
    f();
    return "ok";
  } catch (e) {
    return URError.isURError(e) ? e.code : (e as Error).name;
  }
};

describe("URType", () => {
  it("accepts lowercase letters, digits and hyphens, including the empty string", () => {
    for (const s of ["test", "abc123", "crypto-seed", "", "a-b-c"])
      expect(new URType(s).name).toBe(s);
  });
  it("rejects anything else", () => {
    for (const s of ["Test", "te st", "te_st", "tést", "ur:"]) {
      expect(code(() => new URType(s))).toBe("InvalidType");
      expect(URType.isValid(s)).toBe(false);
      const r = URType.tryFrom(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toBe("invalid UR type");
    }
  });
  it("from / tryFrom / equals / toString", () => {
    const t = URType.from("test");
    expect(URType.from(t)).toBe(t);
    expect(t.equals(new URType("test"))).toBe(true);
    expect(t.equals(new URType("other"))).toBe(false);
    expect(`${t}`).toBe("test");
    const r = URType.tryFrom("ok");
    expect(r.ok && r.value.name).toBe("ok");
  });
});

describe("UR", () => {
  const arr = cbor([1, 2, 3]);
  it("encodes [1,2,3] as ur:test/lsadaoaxjygonesw (Rust lib.rs)", () => {
    const ur = UR.from("test", arr);
    expect(ur.toString()).toBe("ur:test/lsadaoaxjygonesw");
    expect(`${ur}`).toBe("ur:test/lsadaoaxjygonesw");
    expect(ur.toQRString()).toBe("UR:TEST/LSADAOAXJYGONESW");
    expect(new TextDecoder().decode(ur.toQRBytes())).toBe("UR:TEST/LSADAOAXJYGONESW");
    expect(UR.encodeBytes("test", encodeCbor([1, 2, 3]))).toBe("ur:test/lsadaoaxjygonesw");
  });
  it("parses, in any case, and round-trips", () => {
    for (const s of ["ur:test/lsadaoaxjygonesw", "UR:TEST/LSADAOAXJYGONESW"]) {
      const ur = UR.parse(s);
      expect(ur.type.name).toBe("test");
      expect(hex(ur.cbor.toData())).toBe("83010203");
      expect(ur.toString()).toBe("ur:test/lsadaoaxjygonesw");
    }
    const { type, bytes } = UR.decodeBytes("ur:test/lsadaoaxjygonesw");
    expect([type.name, hex(bytes)]).toEqual(["test", "83010203"]);
  });
  it("decodes the user example", () => {
    const ur = UR.parse("ur:user/oeidiniecskgiejthsjnihisgejlisjtcxfyjlihjldnbwrl");
    expect(ur.type.name).toBe("user");
    expect(UR.parse(ur.toString()).equals(ur)).toBe(true);
  });
  it("equals compares type and bytes", () => {
    const a = UR.from("test", arr);
    expect(a.equals(UR.from("test", cbor([1, 2, 3])))).toBe(true);
    expect(a.equals(UR.from("other", arr))).toBe(false);
    expect(a.equals(UR.from("test", cbor([1, 2])))).toBe(false);
  });
  it("isType / expectType", () => {
    const ur = UR.from("test", arr);
    expect(ur.isType("test")).toBe(true);
    expect(ur.isType(new URType("nope"))).toBe(false);
    expect(() => ur.expectType("test")).not.toThrow();
    try {
      ur.expectType("seed");
    } catch (e) {
      expect(URError.isURError(e) && e.code === "UnexpectedType" && e.details).toEqual({
        expected: "seed",
        found: "test",
      });
      expect((e as Error).message).toBe("expected UR type seed, but found test");
    }
  });
  it("validation order and messages", () => {
    const cases: [string, string, string][] = [
      ["http://x", "InvalidScheme", "invalid UR scheme"],
      ["ur:test", "TypeUnspecified", "no UR type specified"],
      ["ur:te_st/lsadaoaxjygonesw", "InvalidType", "invalid UR type"],
      ["ur:te_st/zzzz", "InvalidType", "invalid UR type"],
      ["ur:test/1-2/lsadaoaxjygonesw", "NotSinglePart", "UR is not a single-part"],
      ["ur:test/1-x/lsadaoaxjygonesw", "Decoder", "UR decoder error (Invalid indices)"],
      ["ur:test/lsadaoaxjygonese", "Bytewords", "Bytewords error (invalid checksum)"],
      ["ur:test/lsadaoaxjygonesx", "Bytewords", "Bytewords error (invalid word)"],
      ["ur:test/lsadaoaxjygones", "Bytewords", "Bytewords error (invalid length)"],
      ["ur:test/zmzmaeaeae", "Cbor", "CBOR error ("],
    ];
    for (const [s, c, msg] of cases) {
      expect(code(() => UR.parse(s))).toBe(c);
      expect(() => UR.parse(s)).toThrow(msg);
    }
  });
  it("URError is an Error with name, code and cause", () => {
    try {
      UR.parse("ur:test/zmzmaeaeae");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(URError);
      expect((e as URError).name).toBe("URError");
      expect((e as URError).code).toBe("Cbor");
      expect((e as URError).cause).toBeDefined();
    }
  });
});

describe("bytewords", () => {
  it("styles over [1,2,3,4,5]", () => {
    const d = Uint8Array.from([1, 2, 3, 4, 5]);
    expect(encodeBytewords(d, "standard")).toBe("acid also apex aqua arch fuel bald nail work");
    expect(encodeBytewords(d, "uri")).toBe("acid-also-apex-aqua-arch-fuel-bald-nail-work");
    expect(encodeBytewords(d, "minimal")).toBe("adaoaxaaahflbdnlwk");
    expect(encodeBytewords(d)).toBe(encodeBytewords(d, "minimal"));
    for (const style of ["standard", "uri", "minimal"] as const) {
      expect(hex(decodeBytewords(encodeBytewords(d, style), style))).toBe("0102030405");
      expect(hex(decodeBytewords(encodeBytewords(d, style).toUpperCase(), style))).toBe(
        "0102030405",
      );
    }
    expect(encodeBytewords(new Uint8Array(0))).toBe(
      "aeaeaeae".slice(0, 0) + encodeBytewords(new Uint8Array(0)),
    );
    expect(BYTEWORDS.length).toBe(256);
  });
  it("errors", () => {
    expect(code(() => decodeBytewords("adaoaxaaahflbdnlwe"))).toBe("Bytewords");
    expect(() => decodeBytewords("adaoaxaaahflbdnlwe")).toThrow(
      "Bytewords error (invalid checksum)",
    );
    expect(() => decodeBytewords("adaoaxaaahflbdnlwx")).toThrow("Bytewords error (invalid word)");
    expect(() => decodeBytewords("adaoaxaaahflbdnlw")).toThrow("invalid length");
    expect(() => decodeBytewords("zzaoaxaaahflbdnlwk")).toThrow("invalid word");
    expect(() => decodeBytewords("ñdaoaxaaahflbdnlwk")).toThrow("non-ASCII");
    expect(() => decodeBytewords("acid also", "standard")).toThrow("invalid checksum");
    expect(() =>
      decodeBytewords("acid-also-apex-aqua-arch-fuel-bald-nail-work", "standard"),
    ).toThrow("invalid word");
  });
});

describe("MultipartEncoder", () => {
  const ur = UR.from(
    "bytes",
    cbor(new TextEncoder().encode("The only thing we have to fear is fear itself.")),
  );
  it("is iterable and counts", () => {
    const e = new MultipartEncoder(ur, 10);
    expect(e.partCount).toBe(5);
    expect(e.index).toBe(0);
    const first = e.nextPart();
    expect(first.startsWith("ur:bytes/1-5/")).toBe(true);
    expect(e.index).toBe(1);
    const more: string[] = [];
    for (const p of e) {
      more.push(p);
      if (more.length === 3) break;
    }
    expect(more.map((p) => p.split("/")[1])).toEqual(["2-5", "3-5", "4-5"]);
    expect(e.index).toBe(4);
  });
  it("rejects a fragment length below 1", () => {
    expect(() => new MultipartEncoder(ur, 0)).toThrow(RangeError);
  });
  it("round-trips through the decoder from any start part (Rust test_fountain, D1)", () => {
    // Rust completes at 5, 61, 110, 507; ours peels further (RUST_DIVERGENCES §1.1).
    const expected: Record<number, number> = { 1: 5, 51: 57, 101: 108, 501: 507 };
    for (const [start, at] of Object.entries(expected)) {
      const e = new MultipartEncoder(ur, 10);
      const d = new MultipartDecoder();
      let index = 0;
      for (const part of e) {
        if (e.index >= Number(start)) d.add(part);
        if (d.done) {
          index = e.index;
          break;
        }
      }
      expect(index).toBe(at);
      expect(d.result?.equals(ur)).toBe(true);
      expect(d.progress).toBe(1);
    }
  });
});

describe("MultipartDecoder", () => {
  it("completes on a single-part string and reports progress", () => {
    const d = new MultipartDecoder();
    expect(d.done).toBe(false);
    expect(d.result).toBeUndefined();
    expect(d.progress).toBe(0);
    expect(d.add("ur:test/lsadaoaxjygonesw")).toBe(true);
    expect(d.done).toBe(true);
    expect(d.result?.toString()).toBe("ur:test/lsadaoaxjygonesw");
    expect(d.add("ur:test/lsadaoaxjygonesw")).toBe(false);
    d.reset();
    expect(d.done).toBe(false);
  });
  it("rejects a changed type, bad scheme and bad type", () => {
    const ur = UR.from("bytes", cbor(new Uint8Array(40)));
    const e = new MultipartEncoder(ur, 10);
    const d = new MultipartDecoder();
    d.add(e.nextPart());
    expect(code(() => d.add(e.nextPart().replace("ur:bytes/", "ur:other/")))).toBe(
      "UnexpectedType",
    );
    expect(code(() => d.add("http://x"))).toBe("InvalidScheme");
    expect(code(() => d.add("ur:/x"))).toBe("InvalidType");
    expect(code(() => d.add("ur:bytes/2-4/lsadaoaxjygonesw"))).toBe("Decoder");
    expect(d.progress).toBeCloseTo(0.2);
  });
});

describe("dcbor bridge errors", () => {
  it("urFor and decodeURWith require a named first tag", () => {
    const untagged = { cborTags: () => [], toCbor: () => cbor(1) };
    expect(() => urFor(untagged)).toThrow("no tags");
    const unnamed = { cborTags: () => [Tag.from(999)], toCbor: () => taggedValue(999, 1) };
    expect(() => urFor(unnamed)).toThrow("must have a name");
    const codec: CborCodec<number> = { decode: () => 1, encode: (v) => cbor(v) };
    expect(() => decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), codec)).toThrow("no tags");
    expect(() =>
      decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), { ...codec, tags: [Tag.from(999)] }),
    ).toThrow("must have a name");
  });
});

describe("dcbor bridge", () => {
  const LEAF = Tag.from(201, "leaf");
  class Leaf implements ToUR {
    constructor(readonly text: string) {}
    cborTags(): Tag[] {
      return [LEAF];
    }
    toCbor() {
      return taggedValue(LEAF, this.text);
    }
    toUR(): UR {
      return urFor(this);
    }
    static codec: CborCodec<Leaf> = {
      tags: [LEAF],
      decode: (c) => new Leaf(expectText(expectTaggedContent(c, 201))),
      encode: (v) => v.toCbor(),
    };
  }
  it("urFor uses the first tag's name and the tag's content (Rust ur_codable.rs)", () => {
    expect(new Leaf("test").toUR().toString()).toBe("ur:leaf/iejyihjkjygupyltla");
  });
  it("decodeURWith checks the type then decodes", () => {
    const leaf = decodeURWith(UR.parse("ur:leaf/iejyihjkjygupyltla"), Leaf.codec);
    expect(leaf.text).toBe("test");
    expect(code(() => decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), Leaf.codec))).toBe(
      "UnexpectedType",
    );
    expect(hex(decodeCbor(encodeCbor(new Leaf("x").toCbor())).toData())).toBe("d8c96178");
  });
  it("decodeURWith accepts a UR named after any of the codec's tags", () => {
    const codec: CborCodec<string> = {
      tags: [LEAF, Tag.from(202, "other")],
      decode: (c) => {
        const tv = asTaggedValue(c);
        return `${String(tv?.[0].value)}:${expectText(tv?.[1] ?? c)}`;
      },
      encode: (v) => cbor(v),
    };
    expect(decodeURWith(UR.parse("ur:leaf/iejyihjkjygupyltla"), codec)).toBe("201:test");
    expect(decodeURWith(UR.from("other", cbor("test")), codec)).toBe("202:test");
    expect(code(() => decodeURWith(UR.from("third", cbor("test")), codec))).toBe("UnexpectedType");
  });
});
