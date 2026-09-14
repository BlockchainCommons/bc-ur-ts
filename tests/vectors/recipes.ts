/**
 * Vector recipes. A recipe names an operation and its inputs; `materialize`
 * runs it through a `VectorApi` and returns one outcome string, so the same
 * recipe drives the golden file, the differential and the Rust harness.
 * Adapters bridge the frozen baseline's surface and the current one.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Bytes = { hex: string } | { cycle: number; start?: number } | { text: string };
/**
 * A JavaScript number or bigint that must survive JSON: `NaN` and the
 * infinities have no JSON form, so they travel as strings; a `bigint`
 * travels as its decimal digits followed by `n`, which the Rust harness
 * parses exactly (a JSON number is compared only up to 2^53 - 1).
 */
export type Num = number | "NaN" | "Infinity" | "-Infinity" | `${bigint}n`;
export const num = (v: Num): number | bigint => {
  if (typeof v === "number") return v;
  if (v.endsWith("n")) return BigInt(v.slice(0, -1));
  return Number(v);
};
export type Style = "standard" | "uri" | "minimal";
export type PlainFn = "words" | "bytemojis" | "minimal" | "identifier" | "bytemojiIdentifier";
export interface MultipartSpec {
  type: string;
  cbor: Bytes;
  maxLen: Num;
  parts: number;
}
/** A fountain part given by its four integer fields and data. */
export interface PartFields {
  fields: [Num, Num, Num, Num];
  data: Bytes;
}
/** A dcbor tag for the codable recipes: a number and an optional name. */
export interface TagSpec {
  value: number;
  name?: string;
}
export type Order = "forward" | "reverse" | { shuffle: number };
export type Recipe =
  | { k: "bwEncode"; style: Style; data: Bytes }
  | { k: "bwRoundtrip"; style: Style; data: Bytes }
  | { k: "bwDecode"; style: Style; s: string }
  | { k: "bwPlain"; fn: PlainFn; data: Bytes }
  | { k: "canon"; token: string }
  | { k: "urEncode"; type: string; cbor: Bytes }
  | { k: "urRoundtrip"; type: string; cbor: Bytes }
  | { k: "urDecode"; s: string }
  | ({ k: "mpEncode" } & MultipartSpec)
  | { k: "mpDecode"; parts: string[]; note?: string }
  | { k: "mpDecode"; from: MultipartSpec; order: Order; drop?: number }
  /** `decodeFountainPart` over the CBOR of `[…fields, data]`. */
  | { k: "fountainDecode"; part: PartFields; note?: string }
  /** Hand-built parts fed to `FountainDecoder.add` in order. */
  | { k: "fountainAdd"; parts: PartFields[]; note?: string }
  /** Part strings fed to a `MultipartDecoder` one by one, recording every step. */
  | { k: "mpScan"; parts: string[]; note?: string }
  /** Part CBOR (hex) decoded and fed to a `FountainDecoder` one by one, recording every step. */
  | { k: "fountainScan"; parts: string[]; note?: string }
  /** `decodeFountainPart` over raw CBOR bytes, re-encoded. */
  | { k: "fountainDecodeHex"; hex: string; note?: string }
  /** Parts from `from`, fed from part `skipBefore` on, until the decoder completes. */
  | { k: "mpDecodeFrom"; from: MultipartSpec; skipBefore: number }
  /** `UR.parse(s).expectType(type)`. */
  | { k: "urCheckType"; s: string; type: string }
  /** `urFor` over a value whose tags are `tags` and whose content is `content`. */
  | { k: "urFor"; tags: TagSpec[]; content: Bytes }
  /** `decodeURWith(UR.parse(s), codec)` for a codec tagged `tags`. */
  | { k: "decodeURWith"; tags: TagSpec[]; s: string };
export type Outcome = string;

/** Kinds whose outcomes always carry the error message next to the code. */
const MESSAGE_KINDS: ReadonlySet<Recipe["k"]> = new Set<Recipe["k"]>([
  "mpScan",
  "fountainScan",
  "fountainDecodeHex",
  "mpDecodeFrom",
  "urCheckType",
  "urFor",
  "decodeURWith",
]);

export interface DecoderLike {
  receive(part: string): void;
  done(): boolean;
  /** `[type, cborBytes]` once done. */
  result(): [string, Uint8Array] | undefined;
}
export interface FountainDecoderLike {
  add(part: unknown): boolean;
  done(): boolean;
  result(): Uint8Array | undefined;
}
export interface VectorApi {
  bwEncode(data: Uint8Array, style: Style): string;
  bwDecode(s: string, style: Style): Uint8Array;
  bwPlain(fn: PlainFn, data: Uint8Array): string;
  canon(token: string): string | undefined;
  /** `[urString, qrString]`. */
  urEncode(type: string, cbor: Uint8Array): [string, string];
  /** `[type, cborBytes]`. */
  urDecode(s: string): [string, Uint8Array];
  mpEncode(type: string, cbor: Uint8Array, maxLen: number | bigint, count: number): string[];
  mpDecoder(): DecoderLike;
  /** `part:<seqNum>-<seqLen>-<messageLen>-<checksum>-<hex data>`. */
  fountainDecode(fields: (number | bigint)[], data: Uint8Array): string;
  /** `added=<bools> done=<bool> result=<hex|undefined>`. */
  fountainAdd(parts: { fields: (number | bigint)[]; data: Uint8Array }[]): string;
  /** A part decoded from its CBOR bytes, opaque to the recipes. */
  fountainPart(bytes: Uint8Array): unknown;
  fountainDecoder(): FountainDecoderLike;
  /** Hex of `encodeFountainPart(decodeFountainPart(bytes))`. */
  fountainDecodeHex(bytes: Uint8Array): string;
  urCheckType(s: string, type: string): void;
  urFor(tags: TagSpec[], content: Uint8Array): string;
  /** Hex of the decoded content. */
  decodeURWith(tags: TagSpec[], s: string): string;
  /** The error's code, or its class name for a non-package error. */
  errorCode(e: unknown): string;
  /** `<code>|<message>`. */
  errorText(e: unknown): string;
}

export function toBytes(b: Bytes): Uint8Array {
  if ("hex" in b) return Uint8Array.from(Buffer.from(b.hex, "hex"));
  if ("text" in b) return new TextEncoder().encode(b.text);
  const start = b.start ?? 0;
  return Uint8Array.from({ length: b.cycle }, (_, i) => (start + i) & 0xff);
}
export const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");

/** Deterministic xorshift for shuffle/drop orders; no dependency on the package. */
function* lcg(seed: number): Generator<number> {
  let x = seed >>> 0 || 1;
  for (;;) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    yield x;
  }
}
export function orderParts(parts: string[], order: Order, drop = 0): string[] {
  if (order === "forward") return parts;
  if (order === "reverse") return [...parts].reverse();
  const rnd = lcg(order.shuffle);
  const out = [...parts];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (rnd.next().value as number) % (i + 1);
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  return drop > 0 ? out.filter(() => (rnd.next().value as number) % 100 >= drop) : out;
}

const tagsName = (tags: TagSpec[]): string =>
  `[${tags.map((t) => (t.name === undefined ? String(t.value) : `${t.value}:${t.name}`)).join(",")}]`;
const noted = (note: string | undefined): string => (note === undefined ? "" : ` ${note}`);

export function recipeName(r: Recipe): string {
  switch (r.k) {
    case "bwEncode":
    case "bwRoundtrip":
      return `${r.k} ${r.style} len=${toBytes(r.data).length}`;
    case "bwDecode":
      return `bwDecode ${r.style} ${JSON.stringify(r.s.slice(0, 24))}`;
    case "bwPlain":
      return `bwPlain ${r.fn} len=${toBytes(r.data).length}`;
    case "canon":
      return `canon ${JSON.stringify(r.token)}`;
    case "urEncode":
    case "urRoundtrip":
      return `${r.k} ${r.type} cbor=${hex(toBytes(r.cbor)).slice(0, 16)}… (${toBytes(r.cbor).length}B)`;
    case "urDecode":
      return `urDecode ${JSON.stringify(r.s.slice(0, 32))}`;
    case "mpEncode":
      return `mpEncode ${r.type} ${toBytes(r.cbor).length}B max=${r.maxLen} parts=${r.parts}`;
    case "fountainDecode":
      return `fountainDecode [${r.part.fields.join(",")}]${noted(r.note)}`;
    case "fountainAdd":
      return `fountainAdd ${r.parts.map((p) => `[${p.fields.join(",")}]`).join(" ")}${noted(r.note)}`;
    case "mpDecode":
      if ("parts" in r) return `mpDecode explicit ${r.parts.length} parts${noted(r.note)}`;
      return `mpDecode ${r.from.type} ${toBytes(r.from.cbor).length}B max=${r.from.maxLen} parts=${r.from.parts} ${
        typeof r.order === "string" ? r.order : `shuffle:${r.order.shuffle}`
      }${r.drop ? ` drop=${r.drop}%` : ""}`;
    case "mpScan":
      return `mpScan ${JSON.stringify(r.parts[0]?.slice(0, 40) ?? "")} +${Math.max(0, r.parts.length - 1)}${noted(r.note)}`;
    case "fountainScan":
      return `fountainScan ${r.parts.length} parts${noted(r.note)}`;
    case "fountainDecodeHex":
      return `fountainDecodeHex ${r.hex.slice(0, 32)}${noted(r.note)}`;
    case "mpDecodeFrom":
      return `mpDecodeFrom ${r.from.type} ${toBytes(r.from.cbor).length}B max=${r.from.maxLen} from=${r.skipBefore}`;
    case "urCheckType":
      return `urCheckType ${JSON.stringify(r.s.slice(0, 32))} as ${JSON.stringify(r.type)}`;
    case "urFor":
      return `urFor ${tagsName(r.tags)} ${hex(toBytes(r.content)).slice(0, 16)}`;
    case "decodeURWith":
      return `decodeURWith ${tagsName(r.tags)} ${JSON.stringify(r.s.slice(0, 32))}`;
  }
}

/** Options for `materialize`. */
export interface MaterializeOptions {
  /** Render thrown errors as `throw:<code>|<message>` for every kind; the default keeps `throw:<code>` for the kinds the frozen baseline can run. */
  readonly messages?: boolean;
}

export function materialize(api: VectorApi, r: Recipe, opts: MaterializeOptions = {}): Outcome {
  const withMessages = opts.messages === true || MESSAGE_KINDS.has(r.k);
  const fail = (e: unknown): string =>
    withMessages ? `throw:${api.errorText(e)}` : `throw:${api.errorCode(e)}`;
  try {
    switch (r.k) {
      case "bwEncode":
        return api.bwEncode(toBytes(r.data), r.style);
      case "bwRoundtrip":
        return hex(api.bwDecode(api.bwEncode(toBytes(r.data), r.style), r.style));
      case "bwDecode":
        return hex(api.bwDecode(r.s, r.style));
      case "bwPlain":
        return api.bwPlain(r.fn, toBytes(r.data));
      case "canon":
        return api.canon(r.token) ?? "undefined";
      case "urEncode":
        return api.urEncode(r.type, toBytes(r.cbor)).join("|");
      case "urRoundtrip": {
        const [t, c] = api.urDecode(api.urEncode(r.type, toBytes(r.cbor))[0]);
        return `${t}|${hex(c)}`;
      }
      case "urDecode": {
        const [t, c] = api.urDecode(r.s);
        return `${t}|${hex(c)}`;
      }
      case "mpEncode":
        return api.mpEncode(r.type, toBytes(r.cbor), num(r.maxLen), r.parts).join(" ");
      case "fountainDecode":
        return api.fountainDecode(r.part.fields.map(num), toBytes(r.part.data));
      case "fountainAdd":
        return api.fountainAdd(
          r.parts.map((p) => ({ fields: p.fields.map(num), data: toBytes(p.data) })),
        );
      case "mpDecode": {
        const parts =
          "parts" in r
            ? r.parts
            : orderParts(
                api.mpEncode(r.from.type, toBytes(r.from.cbor), num(r.from.maxLen), r.from.parts),
                r.order,
                r.drop,
              );
        const d = api.mpDecoder();
        let n = 0;
        for (const p of parts) {
          n++;
          d.receive(p);
          if (d.done()) {
            const [t, c] = d.result() as [string, Uint8Array];
            return `done@${n}:${t}|${hex(c)}`;
          }
        }
        return `incomplete:${n}`;
      }
      case "mpScan": {
        const d = api.mpDecoder();
        const steps: string[] = [];
        for (const p of r.parts) {
          let recv: string;
          try {
            d.receive(p);
            recv = "ok";
          } catch (e) {
            recv = fail(e);
          }
          const complete = d.done();
          let message: string;
          try {
            const m = d.result();
            message = m === undefined ? "none" : `${m[0]}|${hex(m[1])}`;
          } catch (e) {
            message = fail(e);
          }
          steps.push(`${recv},${complete},${message}`);
        }
        return steps.join(" ; ");
      }
      case "fountainScan": {
        const d = api.fountainDecoder();
        const steps: string[] = [];
        for (const h of r.parts) {
          let part: unknown;
          try {
            part = api.fountainPart(toBytes({ hex: h }));
          } catch (e) {
            steps.push(`decode-${fail(e)}`);
            continue;
          }
          let recv: string;
          try {
            recv = `ok:${d.add(part)}`;
          } catch (e) {
            recv = fail(e);
          }
          const complete = d.done();
          let message: string;
          try {
            const m = d.result();
            message = m === undefined ? "none" : hex(m);
          } catch (e) {
            message = fail(e);
          }
          steps.push(`${recv},${complete},${message}`);
        }
        return steps.join(" ; ");
      }
      case "fountainDecodeHex":
        return `part:${api.fountainDecodeHex(toBytes({ hex: r.hex }))}`;
      case "mpDecodeFrom": {
        const parts = api.mpEncode(r.from.type, toBytes(r.from.cbor), num(r.from.maxLen), 1000);
        const d = api.mpDecoder();
        let index = 0;
        for (const p of parts) {
          index++;
          if (index >= r.skipBefore) d.receive(p);
          if (d.done()) {
            const [t, c] = d.result() as [string, Uint8Array];
            return `done@${index}:${t}|${hex(c)}`;
          }
        }
        return `incomplete:${index}`;
      }
      case "urCheckType":
        api.urCheckType(r.s, r.type);
        return "ok";
      case "urFor":
        return api.urFor(r.tags, toBytes(r.content));
      case "decodeURWith":
        return api.decodeURWith(r.tags, r.s);
    }
  } catch (e) {
    return fail(e);
  }
}

const BASELINE_CODES: Record<string, string> = {
  InvalidSchemeError: "InvalidScheme",
  TypeUnspecifiedError: "TypeUnspecified",
  InvalidTypeError: "InvalidType",
  NotSinglePartError: "NotSinglePart",
  UnexpectedTypeError: "UnexpectedType",
  BytewordsError: "Bytewords",
  CBORError: "Cbor",
  URDecodeError: "Decoder",
  // The baseline leaks bare `Error`s from the fountain layer and throws the
  // generic `URError` for malformed multipart data; the Rust reference wraps
  // all of these as `Error::UR(..)` ("UR decoder error"), the current
  // `Decoder` code.
  URError: "Decoder",
  Error: "Decoder",
};

/** Recipe kinds the frozen baseline bundle cannot run (it exposes no fountain API and no step-by-step decoder). */
export const BASELINE_UNSUPPORTED: ReadonlySet<Recipe["k"]> = new Set<Recipe["k"]>([
  "fountainDecode",
  "fountainAdd",
  "mpScan",
  "fountainScan",
  "fountainDecodeHex",
  "mpDecodeFrom",
  "urCheckType",
  "urFor",
  "decodeURWith",
]);

const unsupported = (): never => {
  throw new Error("baseline: unsupported recipe kind");
};

/** The frozen baseline's surface (compat dcbor, `BytewordsStyle` enum, class-per-error). */
export function baselineAdapterFor(m: any): VectorApi {
  const plain: Record<PlainFn, (d: Uint8Array) => string> = {
    words: m.encodeToWords,
    bytemojis: m.encodeToBytemojis,
    minimal: m.encodeToMinimalBytewords,
    identifier: m.encodeBytewordsIdentifier,
    bytemojiIdentifier: m.encodeBytemojisIdentifier,
  };
  const urEncode = (type: string, cbor: Uint8Array): [string, string] => {
    // `UR.new(type, cbor)` needs a compat Cbor value the bundle does not
    // export a decoder for; `UR.string()` is exactly this composition.
    m.URType.from(type);
    const s = `ur:${type}/${m.encodeBytewords(cbor, "minimal")}`;
    return [s, s.toUpperCase()];
  };
  const urOf = (type: string, cbor: Uint8Array) => m.UR.fromURString(urEncode(type, cbor)[0]);
  const errorCode = (e: unknown): string => BASELINE_CODES[(e as Error).name] ?? (e as Error).name;
  return {
    bwEncode: (d, style) => m.encodeBytewords(d, style),
    bwDecode: (s, style) => m.decodeBytewords(s, style),
    bwPlain: (fn, d) => plain[fn](d),
    canon: (t) => m.canonicalizeByteword(t),
    urEncode,
    urDecode: (s) => {
      const ur = m.UR.fromURString(s);
      return [ur.urTypeStr(), ur.cbor().toData()];
    },
    mpEncode: (type, cbor, maxLen, count) => {
      const e = new m.MultipartEncoder(urOf(type, cbor), maxLen);
      return Array.from({ length: count }, () => e.nextPart());
    },
    mpDecoder: () => {
      const d = new m.MultipartDecoder();
      return {
        receive: (p) => d.receive(p),
        done: () => d.isComplete(),
        result: () => {
          const ur = d.message();
          return ur === null ? undefined : [ur.urTypeStr(), ur.cbor().toData()];
        },
      };
    },
    fountainDecode: unsupported,
    fountainAdd: unsupported,
    fountainPart: unsupported,
    fountainDecoder: unsupported,
    fountainDecodeHex: unsupported,
    urCheckType: unsupported,
    urFor: unsupported,
    decodeURWith: unsupported,
    errorCode,
    errorText: (e) => `${errorCode(e)}|${(e as Error).message}`,
  };
}

/**
 * The current surface: `UR.from/parse`, `type`/`cbor` getters, `toString`,
 * the `/bytewords` and `/fountain` subpaths, `MultipartDecoder.add/done/result`,
 * one `URError` with `code`.
 */
export function currentAdapterFor(m: any, bw: any, dcbor: any, fn: any): VectorApi {
  const partOf = (fields: (number | bigint)[], data: Uint8Array) => ({
    seqNum: fields[0],
    seqLen: fields[1],
    messageLen: fields[2],
    checksum: fields[3],
    data,
  });
  const plain: Record<PlainFn, (d: Uint8Array) => string> = {
    words: (d) => bw.identifier(d, { style: "standard" }),
    bytemojis: (d) => bw.identifier(d, { style: "bytemoji" }),
    minimal: (d) => bw.identifier(d, { style: "minimal" }),
    identifier: (d) => bw.shortIdentifier(d, { style: "standard" }),
    bytemojiIdentifier: (d) => bw.shortIdentifier(d, { style: "bytemoji" }),
  };
  const urOf = (type: string, cbor: Uint8Array) => m.UR.from(type, dcbor.decodeCbor(cbor));
  const tagsOf = (tags: TagSpec[]): any[] => tags.map((t) => dcbor.Tag.from(t.value, t.name));
  const errorCode = (e: unknown): string =>
    m.URError.isURError(e) ? (e as { code: string }).code : (e as Error).name;
  return {
    bwEncode: (d, style) => bw.encodeBytewords(d, style),
    bwDecode: (s, style) => bw.decodeBytewords(s, style),
    bwPlain: (fn, d) => plain[fn](d),
    canon: (t) => bw.canonicalizeByteword(t),
    urEncode: (type, cbor) => {
      const ur = urOf(type, cbor);
      return [ur.toString(), ur.toQRString()];
    },
    urDecode: (s) => {
      const ur = m.UR.parse(s);
      return [ur.type.name, ur.cbor.toData()];
    },
    mpEncode: (type, cbor, maxLen, count) => {
      const e = new m.MultipartEncoder(urOf(type, cbor), maxLen);
      return Array.from({ length: count }, () => e.nextPart());
    },
    mpDecoder: () => {
      const d = new m.MultipartDecoder();
      return {
        receive: (p) => {
          d.add(p);
        },
        done: () => d.done,
        result: () => {
          const ur = d.result;
          return ur === undefined ? undefined : [ur.type.name, ur.cbor.toData()];
        },
      };
    },
    fountainDecode: (fields, data) => {
      const p = fn.decodeFountainPart(dcbor.encodeCbor([...fields, data]));
      return `part:${p.seqNum}-${p.seqLen}-${p.messageLen}-${p.checksum}-${hex(p.data)}`;
    },
    fountainAdd: (parts) => {
      const d = new fn.FountainDecoder();
      const added = parts.map((p) => d.add(partOf(p.fields, p.data)));
      const result = d.result;
      return `added=${added.join(",")} done=${d.done} result=${result === undefined ? "undefined" : hex(result)}`;
    },
    fountainPart: (bytes) => fn.decodeFountainPart(bytes),
    fountainDecoder: () => {
      const d = new fn.FountainDecoder();
      return { add: (p) => d.add(p), done: () => d.done, result: () => d.result };
    },
    fountainDecodeHex: (bytes) => hex(fn.encodeFountainPart(fn.decodeFountainPart(bytes))),
    urCheckType: (s, type) => {
      m.UR.parse(s).expectType(type);
    },
    urFor: (tags, content) => {
      const t = tagsOf(tags);
      const value = {
        cborTags: () => t,
        toCbor: () =>
          t.length > 0
            ? dcbor.taggedValue(t[0], dcbor.decodeCbor(content))
            : dcbor.decodeCbor(content),
      };
      return m.urFor(value).toString();
    },
    decodeURWith: (tags, s) => {
      const t = tagsOf(tags);
      const codec = {
        tags: t,
        decode: (c: any) => hex(dcbor.expectTaggedContent(c, t[0].value).toData()),
        encode: (v: any) => v,
      };
      return m.decodeURWith(m.UR.parse(s), codec);
    },
    errorCode,
    errorText: (e) => {
      const err = e as { name?: unknown; code?: unknown; message?: unknown };
      const code =
        m.URError.isURError(e) || (err.name === "CborError" && typeof err.code === "string")
          ? String(err.code)
          : String(err.name ?? "Error");
      return `${code}|${String(err.message ?? e)}`;
    },
  };
}
