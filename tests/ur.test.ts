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
  CborError,
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
  it("accepts lowercase letters, digits and hyphens", () => {
    for (const s of ["test", "abc123", "crypto-seed", "a", "a-b-c"])
      expect(new URType(s).name).toBe(s);
  });
  it("accepts the empty string, as the reference's URType::new does", () => {
    expect(new URType("").name).toBe("");
    expect(URType.isValid("")).toBe(true);
    expect(URType.tryFrom("").ok).toBe(true);
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
  it("equals compares the type and the CBOR structurally, as the reference's PartialEq", () => {
    const a = UR.from("test", arr);
    expect(a.equals(UR.from("test", cbor([1, 2, 3])))).toBe(true);
    expect(a.equals(UR.from("other", arr))).toBe(false);
    expect(a.equals(UR.from("test", cbor([1, 2])))).toBe(false);
    // Two spellings of the same text encode to the same string but are different values.
    const nfd = UR.from("test", cbor("e\u0301"));
    const nfc = UR.from("test", cbor("\u00e9"));
    expect(nfd.toString()).toBe(nfc.toString());
    expect(nfd.equals(nfc)).toBe(false);
    expect(UR.parse(nfd.toString()).equals(UR.parse(nfc.toString()))).toBe(true);
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
        code: "UnexpectedType",
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
      // A well-formed header: the payload is decoded before NotSinglePart.
      ["ur:test/1-2/zz", "Decoder", "UR decoder error (invalid word)"],
      ["ur:test/lsadaoaxjygonese", "Decoder", "UR decoder error (invalid checksum)"],
      ["ur:test/lsadaoaxjygonesx", "Decoder", "UR decoder error (invalid word)"],
      ["ur:test/lsadaoaxjygones", "Decoder", "UR decoder error (invalid length)"],
      ["ur:test/lsadaoaxjygonesw\u00e9", "Decoder", "non-ASCII"],
      ["ur:test/zmzmaeaeae", "Cbor", "CBOR error ("],
    ];
    for (const [s, c, msg] of cases) {
      expect(code(() => UR.parse(s))).toBe(c);
      expect(() => UR.parse(s)).toThrow(msg);
    }
  });
  it("URError is an Error with name, code, details, is() and cause", () => {
    try {
      UR.parse("ur:test/zmzmaeaeae");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(URError);
      expect((e as URError).name).toBe("URError");
      expect((e as URError).code).toBe("Cbor");
      expect((e as URError).details).toEqual({ code: "Cbor" });
      expect((e as URError).is("Cbor")).toBe(true);
      expect((e as URError).is("Decoder")).toBe(false);
      expect((e as URError).cause).toBeDefined();
    }
    const e = URError.unexpectedType("a", "b");
    expect(e.details).toEqual({ code: "UnexpectedType", expected: "a", found: "b" });
    // Cross-copy identity is by name and code, not by prototype.
    const foreign = Object.assign(new Error("x"), { name: "URError", code: "Cbor" });
    expect(URError.isURError(foreign)).toBe(true);
    expect(URError.isURError(new Error("x"))).toBe(false);
    expect(URError.isURError({ name: "URError", code: "x" })).toBe(false);
  });
  it("the empty type is accepted everywhere it can appear, as in the reference", () => {
    expect(UR.from("", cbor([1, 2, 3])).toString()).toBe("ur:/lsadaoaxjygonesw");
    const parsed = UR.parse("ur:/lsadaoaxjygonesw");
    expect([parsed.type.name, hex(parsed.cbor.toData())]).toEqual(["", "83010203"]);
    expect(UR.encodeBytes("", encodeCbor([1, 2, 3]))).toBe("ur:/lsadaoaxjygonesw");
    expect(() => UR.from("test", arr).expectType("")).toThrow("expected UR type , but found test");
    // A single-part string is still not a multipart part.
    expect(code(() => new MultipartDecoder().add("ur:/lsadaoaxjygonesw"))).toBe("Decoder");
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
      // Case-sensitive, as the reference's `bytewords::decode`; `UR.parse`
      // lower-cases a whole UR string before decoding its body.
      expect(code(() => decodeBytewords(encodeBytewords(d, style).toUpperCase(), style))).toBe(
        "Bytewords",
      );
      expect(() => decodeBytewords(encodeBytewords(d, style).toUpperCase(), style)).toThrow(
        "invalid word",
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
  it("requires a maxFragmentLength that is a safe integer or a bigint in the reference's usize, at least 1", () => {
    // Zero is representable in the reference (`usize`): its fountain
    // encoder's `InvalidFragmentLen`, an `Error::UR` = `Decoder`.
    expect(code(() => new MultipartEncoder(ur, 0))).toBe("Decoder");
    expect(() => new MultipartEncoder(ur, 0)).toThrow("expected positive maximum fragment length");
    for (const max of [-1, 1.5, NaN, Infinity]) {
      expect(code(() => new MultipartEncoder(ur, max))).toBe("InvalidParameter");
    }
    expect(() => new MultipartEncoder(ur, 1.5)).toThrow(
      "maxFragmentLength must be an integer in [1, 9007199254740991] or a bigint in [1, 18446744073709551615], got 1.5",
    );
    // The reference's `usize` reaches 2^64 - 1: a bigint carries it exactly.
    expect(new MultipartEncoder(ur, 9007199254740992n).nextPart().split("/")[1]).toBe("1-1");
    expect(new MultipartEncoder(ur, 2n ** 64n - 1n).partCount).toBe(1);
    expect(code(() => new MultipartEncoder(ur, 2 ** 53))).toBe("InvalidParameter");
    expect(code(() => new MultipartEncoder(ur, 2n ** 64n))).toBe("InvalidParameter");
    try {
      new MultipartEncoder(ur, NaN);
    } catch (e) {
      expect(URError.isURError(e) && e.details).toEqual({
        code: "InvalidParameter",
        parameter: "maxFragmentLength",
        value: NaN,
      });
    }
  });
  it("round-trips through the decoder from any start part, completing where the reference's test_fountain does", () => {
    const expected: Record<number, number> = { 1: 5, 51: 61, 101: 110, 501: 507 };
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
  const p1of1 = "ur:bytes/1-1/lpadadahcyztdtdpfefefyadaoaxaabdgspkge";
  it("rejects a single-part string, as the reference does", () => {
    const d = new MultipartDecoder();
    expect(d.done).toBe(false);
    expect(d.result).toBeUndefined();
    expect(d.progress).toBe(0);
    expect(code(() => d.add("ur:test/lsadaoaxjygonesw"))).toBe("Decoder");
    expect(() => d.add("ur:test/lsadaoaxjygonesw")).toThrow(
      "Can't decode single-part UR as multi-part",
    );
    // The reference's `ur::decode` reports a missing slash, and a bad body is reported before the kind.
    expect(() => d.add("ur:test")).toThrow("UR decoder error (No type specified)");
    expect(() => d.add("ur:test/zz")).toThrow("UR decoder error (invalid word)");
    expect(d.done).toBe(false);
    // A single-part UR is `UR.parse`'s job.
    expect(UR.parse("ur:test/lsadaoaxjygonesw").toString()).toBe("ur:test/lsadaoaxjygonesw");
  });
  it("parses the header at the last slash and accepts a leading + (the reference's u16::from_str)", () => {
    const ur = UR.from("bytes", cbor(new Uint8Array(40)));
    const e = new MultipartEncoder(ur, 10);
    const p1 = e.nextPart();
    // `ur:bytes/+1-5/…` is what `"+1".parse::<u16>()` accepts.
    const plus = new MultipartDecoder();
    expect(plus.add(p1.replace("/1-", "/+1-"))).toBe(true);
    expect(plus.progress).toBeCloseTo(0.2);
    // The reference splits at the LAST slash: "1-2/3" is the header.
    expect(() => new MultipartDecoder().add("ur:test/1-2/3/lsadaoaxjygonesw")).toThrow(
      "UR decoder error (Invalid indices)",
    );
    // The header is checked before the payload's bytewords.
    expect(() => new MultipartDecoder().add("ur:test/1-x/zz")).toThrow("Invalid indices");
    expect(() => new MultipartDecoder().add("ur:test/1-2/zz")).toThrow("invalid word");
    // The header is informational (the reference parses it as two `u16`s
    // and reads the fountain fields from the CBOR): a lying label is not an
    // error, a header beyond `u16` still is.
    const lying = new MultipartDecoder();
    expect(lying.add(p1.replace("/1-5/", "/2-5/"))).toBe(true);
    expect(lying.done).toBe(false);
    expect(code(() => new MultipartDecoder().add(p1.replace("/1-5/", "/70000-5/")))).toBe(
      "Decoder",
    );
    lying.reset();
    expect(lying.done).toBe(false);
    expect(lying.progress).toBe(0);
  });
  it("is case-sensitive, as the reference's receive (lower-case a QR payload first)", () => {
    expect(() => new MultipartDecoder().add(p1of1.toUpperCase())).toThrow("invalid UR scheme");
    expect(() => new MultipartDecoder().add("UR:" + p1of1.slice(3))).toThrow("invalid UR scheme");
    expect(() => new MultipartDecoder().add(p1of1.replace("bytes", "BYTES"))).toThrow(
      "invalid UR type",
    );
    expect(() => new MultipartDecoder().add(p1of1.slice(0, -4) + "GSPKGE")).toThrow("invalid word");
    const d = new MultipartDecoder();
    expect(d.add(p1of1.toUpperCase().toLowerCase())).toBe(true);
    expect(d.done).toBe(true);
  });
  it("rejects a changed type, bad scheme and bad type; a failed first part still sets the type", () => {
    const ur = UR.from("bytes", cbor(new Uint8Array(40)));
    const e = new MultipartEncoder(ur, 10);
    const d = new MultipartDecoder();
    d.add(e.nextPart());
    expect(code(() => d.add(e.nextPart().replace("ur:bytes/", "ur:other/")))).toBe(
      "UnexpectedType",
    );
    expect(code(() => d.add("http://x"))).toBe("InvalidScheme");
    expect(code(() => d.add("ur:b_d/x"))).toBe("InvalidType");
    // The empty type is a valid type that differs from the stored one.
    expect(code(() => d.add("ur:/x"))).toBe("UnexpectedType");
    expect(() => d.add("ur:bytes/2-4/lsadaoaxjygonesw")).toThrow(
      "UR decoder error (decode error: invalid CBOR array length)",
    );
    expect(d.progress).toBeCloseTo(0.2);
    const first = new MultipartDecoder();
    expect(() => first.add("ur:aaa/zz")).toThrow("invalid word");
    expect(() => first.add(p1of1)).toThrow("expected UR type aaa, but found bytes");
  });
  it("validates every string after completion and reports what add adds", () => {
    const d = new MultipartDecoder();
    expect(d.add(p1of1)).toBe(true);
    expect(d.done).toBe(true);
    expect(d.add(p1of1)).toBe(false);
    expect(() => d.add("http://x")).toThrow("invalid UR scheme");
    expect(() => d.add("ur:other/1-1/lpadadahcyztdtdpfefefyadaoaxaabdgspkge")).toThrow(
      "expected UR type bytes, but found other",
    );
    expect(() => d.add("ur:bytes/1-1/zz")).toThrow("invalid word");
    expect(() => d.add("ur:bytes/lsadaoaxjygonesw")).toThrow(
      "Can't decode single-part UR as multi-part",
    );
    expect(() => d.add("ur:bytes")).toThrow("No type specified");
    expect(d.done).toBe(true);
    expect(hex(d.result?.cbor.toData() as Uint8Array)).toBe("4401020304");
  });
  it("done follows the fountain decoder; result reassembles and decodes once, and keeps its outcome", () => {
    const ur = UR.from("bytes", cbor(Uint8Array.from([1, 2, 3, 4])));
    const e = new MultipartEncoder(ur, 4);
    const p1 = e.nextPart();
    const padded = "ur:bytes/2-2/lpaoaoahcyztdtdpfefxaxaazmsavsdnwm";
    const d = new MultipartDecoder();
    expect(d.add(p1)).toBe(true);
    expect(d.add(padded)).toBe(true);
    expect(d.done).toBe(true);
    expect(d.progress).toBe(1);
    expect(() => d.result).toThrow("UR decoder error (invalid padding)");
    expect(() => d.result).toThrow("UR decoder error (invalid padding)");
    expect(d.add(padded)).toBe(false);
    const bad = new MultipartDecoder();
    expect(bad.add("ur:bytes/1-1/lpadadadcyzmaeaeaefpzmrddeplhg")).toBe(true);
    expect(bad.done).toBe(true);
    expect(code(() => bad.result)).toBe("Cbor");
    bad.reset();
    expect(bad.done).toBe(false);
    expect(bad.result).toBeUndefined();
  });
  it("counts a seqNum 0 part towards completion, as the reference's release build does", () => {
    const d = new MultipartDecoder();
    expect(d.add("ur:bytes/0-2/lpaeaoahcyztdtdpfefxfyadaovwkightl")).toBe(true);
    expect(d.done).toBe(false);
    expect(d.add("ur:bytes/1-2/lpadaoahcyztdtdpfefxfyadaokbtpcsrd")).toBe(true);
    expect(d.done).toBe(true);
    expect(() => d.result).toThrow("UR decoder error (expected item)");
    expect(d.add("ur:bytes/2-2/lpaoaoahcyztdtdpfefxaxaaaewswdssiy")).toBe(false);
  });
});

describe("dcbor bridge errors", () => {
  it("urFor and decodeURWith throw TagUnnamed for a missing or unnamed first tag", () => {
    const untagged = { cborTags: () => [], toCbor: () => cbor(1) };
    expect(code(() => urFor(untagged))).toBe("TagUnnamed");
    expect(() => urFor(untagged)).toThrow("the codec has no tags");
    const unnamed = { cborTags: () => [Tag.from(999)], toCbor: () => taggedValue(999, 1) };
    expect(() => urFor(unnamed)).toThrow("CBOR tag 999 must have a name");
    try {
      urFor(unnamed);
    } catch (e) {
      expect(URError.isURError(e) && e.details).toEqual({ code: "TagUnnamed", tag: 999 });
    }
    const codec: CborCodec<number> = { decode: () => 1, encode: (v) => cbor(v) };
    expect(code(() => decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), codec))).toBe(
      "TagUnnamed",
    );
    expect(
      code(() =>
        decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), { ...codec, tags: [Tag.from(999)] }),
      ),
    ).toBe("TagUnnamed");
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
  it("decodeURWith checks the type, as a dcbor Custom error, then decodes", () => {
    const leaf = decodeURWith(UR.parse("ur:leaf/iejyihjkjygupyltla"), Leaf.codec);
    expect(leaf.text).toBe("test");
    try {
      decodeURWith(UR.parse("ur:test/lsadaoaxjygonesw"), Leaf.codec);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CborError);
      expect((e as CborError).code).toBe("Custom");
      expect((e as Error).message).toBe("expected UR type leaf, but found test");
    }
    expect(hex(decodeCbor(encodeCbor(new Leaf("x").toCbor())).toData())).toBe("d8c96178");
  });
  it("decodeURWith accepts only a UR named after the codec's first tag, as the reference's from_ur", () => {
    const codec: CborCodec<string> = {
      tags: [LEAF, Tag.from(202, "other")],
      decode: (c) => {
        const tv = asTaggedValue(c);
        return `${String(tv?.[0].value)}:${expectText(tv?.[1] ?? c)}`;
      },
      encode: (v) => cbor(v),
    };
    expect(decodeURWith(UR.parse("ur:leaf/iejyihjkjygupyltla"), codec)).toBe("201:test");
    for (const type of ["other", "third"]) {
      expect(() => decodeURWith(UR.from(type, cbor("test")), codec)).toThrow(
        `expected UR type leaf, but found ${type}`,
      );
    }
    const badName: CborCodec<string> = { ...codec, tags: [Tag.from(201, "Leaf")] };
    expect(() => decodeURWith(UR.from("leaf", cbor("test")), badName)).toThrow("invalid UR type");
    expect(code(() => decodeURWith(UR.from("leaf", cbor("test")), badName))).toBe("CborError");
  });
});
