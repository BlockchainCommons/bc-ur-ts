# Migrating from `@bcts/uniform-resources` to `@blockchaincommons/uniform-resources`

`@blockchaincommons/uniform-resources` is the redesigned successor to `@bcts/uniform-resources`.

## TL;DR checklist

- [ ] Replace the `@bcts/uniform-resources` dependency with `@blockchaincommons/uniform-resources`.
- [ ] Rewrite import specifiers: `@bcts/uniform-resources` becomes `@blockchaincommons/uniform-resources`.
- [ ] `UR` holds a canonical `@blockchaincommons/dcbor` `Cbor`, not a `dcbor-compat` one.
- [ ] `UR.new` → `UR.from`; `UR.fromURString` → `UR.parse`; `urType()` → `type`;
      `cbor()` → `cbor`; `string()` → `toString()`; `qrString()` → `toQRString()`;
      `checkType` → `expectType`.
- [ ] Bytewords moved to the `/bytewords` subpath; `BytewordsStyle.Minimal` → `"minimal"`.
- [ ] `MultipartDecoder.receive/isComplete/message()` → `add/done/result`;
      `MultipartEncoder.currentIndex()/partsCount()` → `index/partCount`, and it is iterable.
      `add` rejects a single-part UR (`Decoder`, as the reference's `MultipartDecoder` does) —
      parse those with `UR.parse` — and does not compare the `n-m/` header with the part's
      CBOR (the reference reads the fountain fields from the CBOR). `add` is case-sensitive
      (lower-case a QR payload first) and validates every string after completion; `done` is
      the fountain decoder's completion and `result` reassembles and decodes on first read,
      throwing `Decoder` or `Cbor`.
- [ ] `decodeBytewords` is case-sensitive (the reference's `bytewords::decode`);
      `UR.parse` lower-cases a whole UR string, `MultipartDecoder.add` does not.
- [ ] `decodeURWith` accepts only a UR named after the codec's first tag and reports a wrong
      type as a dcbor `CborError` (`Custom`), as the reference's `from_ur` does.
- [ ] Catch one `URError` and switch on `code`; the nine error classes,
      `Result` and `isError` are gone.
- [ ] `UREncodable`/`URDecodable`/`URCodable` → `ToUR`, `urFor(value)`, `decodeURWith(ur, codec)`.
- [ ] Raise your Node floor to **22.12** and TypeScript to **>= 5.7**.

## 1. Package name and imports

```diff
- import { UR, encodeBytewords, BytewordsStyle } from "@bcts/uniform-resources";
+ import { UR } from "@blockchaincommons/uniform-resources";
+ import { encodeBytewords } from "@blockchaincommons/uniform-resources/bytewords";
```

## 2. `UR` and `URType`

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources` |
| --- | --- |
| `UR.new(type, cbor)` | `UR.from(type, cbor)` (or `new UR(URType, Cbor)`) |
| `UR.fromURString(s)` | `UR.parse(s)` |
| `ur.urType()` | `ur.type` |
| `ur.urTypeStr()` | `ur.type.name` |
| `ur.cbor()` | `ur.cbor` |
| `ur.string()` | `ur.toString()` |
| `ur.qrString()` | `ur.toQRString()` |
| `ur.qrData()` | `ur.toQRBytes()` |
| `ur.checkType(t)` | `ur.expectType(t)` (throws) / `ur.isType(t)` (boolean) |
| `ur.equals(other)` | unchanged |
| — | `UR.encodeBytes(type, cborBytes)`, `UR.decodeBytes(s)` for the bytes-level pair |
| `new URType(s)` / `URType.from(s)` | unchanged |
| `urType.string()` | `urType.name` (or `toString()`) |
| `URType.tryFrom(s)` | unchanged shape: `{ ok: true, value }` / `{ ok: false, error: URError }` |
| `isURTypeChar`, `isValidURType`, `validateURType` | `URType.isValid(s)` and the constructor |

The `Cbor` is canonical `@blockchaincommons/dcbor`. `UR.parse` validates in
the reference order: scheme, type, the multipart header if there is one
("Invalid indices"), the payload's bytewords (`Decoder` with the reference's
reason), `NotSinglePart`, then the CBOR. The empty type is valid, as the
reference's `URType::new` accepts it.

## 3. Bytewords (`/bytewords` subpath)

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources/bytewords` |
| --- | --- |
| `encodeBytewords(data, BytewordsStyle.Minimal)` | `encodeBytewords(data, "minimal")` (default) |
| `decodeBytewords(s, BytewordsStyle.Standard)` | `decodeBytewords(s, "standard")` |
| `encodeToWords(data)` | `identifier(data)` |
| `encodeToMinimalBytewords(data)` | `identifier(data, { style: "minimal" })` |
| `encodeToBytemojis(data)` | `identifier(data, { style: "bytemoji" })` |
| `encodeBytewordsIdentifier(data)` | `shortIdentifier(data)` (4 bytes; `InvalidParameter` otherwise) |
| `encodeBytemojisIdentifier(data)` | `shortIdentifier(data, { style: "bytemoji" })` |
| `isValidBytemoji`, `canonicalizeByteword`, `BYTEWORDS`, `BYTEMOJIS` | unchanged; the tables are frozen, and `canonicalizeByteword` lower-cases ASCII letters only |
| `bytewords.encode/decode/Style/…` namespace | removed; import the subpath |
| `BYTEWORDS_MAP`, `MINIMAL_BYTEWORDS_MAP` | removed (internal) |

## 4. Multipart

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources` |
| --- | --- |
| `new MultipartEncoder(ur, maxLen)` | unchanged; `maxLen` is a safe integer or a `bigint` up to 2⁶⁴ − 1 (0 is `Decoder`, anything else outside that `InvalidParameter`) |
| `encoder.nextPart()` | unchanged; the encoder is also iterable |
| `encoder.currentIndex()` | `encoder.index` |
| `encoder.partsCount()` | `encoder.partCount` |
| `decoder.receive(part)` | `decoder.add(part)` → `boolean` (made progress) |
| `decoder.isComplete()` | `decoder.done` |
| `decoder.message()` → `UR \| null` | `decoder.result` → `UR \| undefined` (throws `Decoder` / `Cbor` when the completed message does not reassemble or decode) |
| — | `decoder.progress`, `decoder.reset()` |

```diff
- for (let i = 0; i < 100; i++) { decoder.receive(encoder.nextPart()); if (decoder.isComplete()) break; }
- const ur = decoder.message();
+ for (const part of encoder) { decoder.add(part); if (decoder.done) break; }
+ const ur = decoder.result;
```

The fountain code is public on the `/fountain` subpath (`FountainEncoder`,
`FountainDecoder`, `chooseFragments`, `partition`, …) with the same
`add`/`done`/`result` shape.

## 5. Errors

One class, `URError`, with a `code` union:

| `@bcts/uniform-resources` | `code` |
| --- | --- |
| `InvalidSchemeError` | `"InvalidScheme"` |
| `TypeUnspecifiedError` | `"TypeUnspecified"` |
| `InvalidTypeError` | `"InvalidType"` |
| `NotSinglePartError` | `"NotSinglePart"` |
| `UnexpectedTypeError` | `"UnexpectedType"` (`details: { expected, found }`) |
| `BytewordsError` | `"Bytewords"` (`cause` when wrapped) |
| `CBORError` | `"Cbor"` (`cause`) |
| `URDecodeError`, generic `URError`, bare `Error` from the fountain layer | `"Decoder"` |

| `RangeError` for `maxFragmentLength < 1`, an empty message, a short identifier that is not 4 bytes; `TypeError`/garbage for `NaN`, `1.5` or a wrong type | `"InvalidParameter"` (`details: { parameter, value }`), for every argument outside its domain, checked before any work |
| bare `Error` from `urFor` / `decodeURWith` on an unnamed tag | `"TagUnnamed"` (`details: { tag }`) |
| `UnexpectedTypeError` from `decodableFromUR` | a dcbor `CborError` (`Custom`) from `decodeURWith`, as the reference's `from_ur` |

Messages are the reference's `Display` strings (`invalid UR scheme`,
`expected UR type X, but found Y`, `UR decoder error (invalid checksum)`,
…); a bytewords failure inside a UR string is `Decoder`, `Bytewords` comes
only from `decodeBytewords`. `Result<T>` and `isError` are gone. `details`
is a union discriminated by `code`; `e.details.code === "UnexpectedType"`
narrows to `{ expected, found }`. `URResult<T>` is the non-throwing form
(`URType.tryFrom`).

```ts
try {
  UR.parse(s);
} catch (e) {
  if (URError.isURError(e) && e.is("UnexpectedType")) console.log(e.details.expected);
}
```

Inputs the decoders treat as the reference does: a multipart message whose
padding is not zero completes and `result` throws `Decoder`; a part whose
fields are not `u32`s is `Decoder` with minicbor's text; a URL header beyond
`u16` is `Decoder("Invalid indices")`; a part with `seqNum` 0 is accepted
and counted as the reference's wrapped index; an upper-case part is
`InvalidScheme` or `InvalidType`; the empty UR type is valid.

## 6. dcbor bridge

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources` |
| --- | --- |
| `UREncodable { ur(); urString() }` | `ToUR { toUR(): UR }` |
| `urFromEncodable(x)` | `urFor(x)` for any `ToCbor & CborTagged` (type = first tag's name, payload = the tag's content) |
| `urStringFromEncodable(x)` | `urFor(x).toString()` |
| `decodableFromUR(decodable, ur)` | `decodeURWith(ur, codec)` with a dcbor `CborCodec<T>` whose first tag names the type |
| `decodableFromURString(decodable, s)` | `decodeURWith(UR.parse(s), codec)` |
| `URDecodable`, `URCodable`, `isUREncodable`, `isURDecodable`, `isURCodable` | removed |

## 7. Decoding follows the reference's `ur` crate

- Completion: a mixed part is reduced against the fragments known when it
  arrives, and a buffered part only when a later simple part comes, so a
  shuffled or lossy sequence can need more parts than before; the parts a
  message needs when they arrive in order are unchanged.
- The reassembled message is returned without a CRC-32 check against the
  parts' checksum field; each part's bytewords checksum is still verified.
- Part CBOR is read as `minicbor` reads it (any head width, trailing bytes
  ignored), with minicbor's error texts.
- `MultipartDecoder.add` is case-sensitive and validates every string, also
  after completion.
- Every UR string, QR string, bytewords string and multipart part string is
  unchanged.
