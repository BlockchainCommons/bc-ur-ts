# Migrating from `@bcts/uniform-resources` to `@blockchaincommons/uniform-resources`

`@blockchaincommons/uniform-resources` is the canonical home of this
library. It was extracted from the
[`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where it
was published as `@bcts/uniform-resources`, into its own Blockchain Commons
repository at
[`BlockchainCommons/bc-ur-ts`](https://github.com/BlockchainCommons/bc-ur-ts),
and redesigned as an idiomatic TypeScript library in the same release.

**Every string this package produces is unchanged.** Single-part URs, QR
forms, every bytewords style, every multipart part string, and what the
decoders accept are identical to `@bcts/uniform-resources`; 616 golden
vectors, a differential corpus against the frozen pre-redesign bundle, and
a Rust cross-validation harness against `bc-ur 0.19.2` enforce that. What
changed is the shape of the API and the dcbor it builds on.

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
the reference order: scheme, then type, then payload.

## 3. Bytewords (`/bytewords` subpath)

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources/bytewords` |
| --- | --- |
| `encodeBytewords(data, BytewordsStyle.Minimal)` | `encodeBytewords(data, "minimal")` (default) |
| `decodeBytewords(s, BytewordsStyle.Standard)` | `decodeBytewords(s, "standard")` |
| `encodeToWords(data)` | `identifier(data)` |
| `encodeToMinimalBytewords(data)` | `identifier(data, { style: "minimal" })` |
| `encodeToBytemojis(data)` | `identifier(data, { style: "bytemoji" })` |
| `encodeBytewordsIdentifier(data)` | `shortIdentifier(data)` (4 bytes; `RangeError` otherwise) |
| `encodeBytemojisIdentifier(data)` | `shortIdentifier(data, { style: "bytemoji" })` |
| `isValidBytemoji`, `canonicalizeByteword`, `BYTEWORDS`, `BYTEMOJIS` | unchanged (tables are `readonly string[]`) |
| `bytewords.encode/decode/Style/…` namespace | removed; import the subpath |
| `BYTEWORDS_MAP`, `MINIMAL_BYTEWORDS_MAP` | removed (internal) |

## 4. Multipart

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources` |
| --- | --- |
| `new MultipartEncoder(ur, maxLen)` | unchanged (`RangeError` for `maxLen < 1`) |
| `encoder.nextPart()` | unchanged; the encoder is also iterable |
| `encoder.currentIndex()` | `encoder.index` |
| `encoder.partsCount()` | `encoder.partCount` |
| `decoder.receive(part)` | `decoder.add(part)` → `boolean` (made progress) |
| `decoder.isComplete()` | `decoder.done` |
| `decoder.message()` → `UR \| null` | `decoder.result` → `UR \| undefined` |
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

| `RangeError` for `maxFragmentLength < 1`, an empty message, a short identifier that is not 4 bytes; `TypeError`/garbage for `NaN` or `1.5` | `"InvalidParameter"` (`details: { parameter, value }`), also for a hand-built `FountainPart` outside `u32` |
| bare `Error` from `urFor` / `decodeURWith` on an unnamed tag | `"TagUnnamed"` (`details: { tag }`) |

Messages are unchanged where a reference variant exists (`invalid UR
scheme`, `expected UR type X, but found Y`, `Bytewords error (invalid
checksum)`, …). `Result<T>` and `isError` are gone. `details` is a union
discriminated by `code`; `e.details.code === "UnexpectedType"` narrows to
`{ expected, found }`. `URResult<T>` is the non-throwing form
(`URType.tryFrom`).

```ts
try {
  UR.parse(s);
} catch (e) {
  if (URError.isURError(e) && e.is("UnexpectedType")) console.log(e.details.expected);
}
```

Four inputs that decoded before are now rejected (see
[`RUST_DIVERGENCES.md`](./RUST_DIVERGENCES.md)): a multipart message whose
padding is not zero (`Decoder`, as the reference), a part whose fields are
not `u32`s or whose `seqNum` is 0 (`Decoder`), a URL header beyond `u16`
(`Decoder("Invalid indices")`), and the empty UR type (`InvalidType`;
`ur:/…` was never a valid UR).

## 6. dcbor bridge

| `@bcts/uniform-resources` | `@blockchaincommons/uniform-resources` |
| --- | --- |
| `UREncodable { ur(); urString() }` | `ToUR { toUR(): UR }` |
| `urFromEncodable(x)` | `urFor(x)` for any `ToCbor & CborTagged` (type = first tag's name, payload = the tag's content) |
| `urStringFromEncodable(x)` | `urFor(x).toString()` |
| `decodableFromUR(decodable, ur)` | `decodeURWith(ur, codec)` with a dcbor `CborCodec<T>` whose first tag names the type |
| `decodableFromURString(decodable, s)` | `decodeURWith(UR.parse(s), codec)` |
| `URDecodable`, `URCodable`, `isUREncodable`, `isURDecodable`, `isURCodable` | removed |

## 7. Node and TypeScript floors

Node **22.12** and TypeScript **5.7**. The IIFE / global-script build is
gone; use the ESM or CJS entry.

## 8. What did not change

- Every UR string, QR string, bytewords string and multipart part string.
- Decoder acceptance: the same parts complete the same messages (see
  `RUST_DIVERGENCES.md` for where that is more than the Rust reference).
- Error messages.
