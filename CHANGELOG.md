# Changelog

## 1.0.0-beta.3 - 2026-09-14

Decoding follows the reference in full: bc-ur 0.19.2 over the `ur` 0.4.1 and
`minicbor` 0.19.1 crates. Every encoder output is unchanged.

### Changed (breaking)

- **Multipart decoding follows the reference's fountain decoder.** A mixed
  part is reduced against the fragments known when it arrives and a buffered
  part only when a later simple part comes, so completion can need more
  parts than before; a later simple part replaces a fragment derived earlier; the
  reassembled message is not checked against the parts' checksum field
  (the bytewords checksum of each part still is); and a part with `seqNum` 0
  is accepted and counted as the reference's wrapped index, so `result`
  then throws `Decoder` "expected item". `FountainDecoder.add` copies the
  part's data and never keeps the caller's array.
- **`MultipartDecoder.add` is case-sensitive**, as the reference's `receive`
  (only `UR.parse` lower-cases): lower-case a QR payload before `add`.
  Every string is validated after completion too, and `add` reports the
  reference's outcomes in its order: `InvalidScheme`, `InvalidType`,
  `UnexpectedType`, then `Decoder` with the reference's text ("No type
  specified" for `ur:test`, "Invalid indices", the bytewords failure before
  "Can't decode single-part UR as multi-part", the part codec's messages).
- **`done` and `result`.** `done` is the fountain decoder's completion;
  `result` reassembles and decodes the message when first read after
  completion and keeps that outcome, throwing `Decoder` ("invalid padding",
  "expected item") or `Cbor`. `add` no longer throws for a message that
  fails to reassemble or decode.
- **Part CBOR is read as `minicbor` reads it**: integer heads of any width,
  byte strings of any length width and trailing bytes are accepted, and
  failures carry minicbor's text ("unexpected type u8 at position 0:
  expected array", "4294967296 overflows target type at position 1: when
  converting u64 to u32", "decode error: invalid CBOR array length", "end of
  input bytes"). `encodeFountainPart` truncates the three counters to `u32`
  as the reference's `as u32` does.
- **`UR.parse` and `UR.decodeBytes` follow `from_ur_string`**: after the
  scheme, the missing slash and the type, the multipart header is checked
  ("Invalid indices"), then the payload's bytewords, then `NotSinglePart`.
  A bytewords failure inside a UR string is `Decoder` with the reference's
  reason ("invalid word", "invalid checksum", "invalid length"), no longer
  `Bytewords`; `decodeBytewords` alone throws `Bytewords`.
- **The empty UR type is valid**, as the reference's `URType::new` accepts
  it: `ur:/…` is produced and read, `URType.isValid("")` is true and
  `expectType("")` is `UnexpectedType`.
- **`decodeURWith` accepts only a UR named after the codec's first tag**, as
  the reference's `from_ur` (a codec's other tags do not name accepted UR
  types), and reports a wrong or invalid type as a dcbor `CborError`
  (`Custom`: "expected UR type seed, but found crypto-seed", "invalid UR
  type"), as `from_ur` returns a `dcbor::Error`. `TagUnnamed` stays a
  `URError`.
- **`canonicalizeByteword` lower-cases ASCII letters only**, as the
  reference's `to_ascii_lowercase`; a token with a non-ASCII character
  (U+212A KELVIN SIGN, U+0130, U+017F) names no word. `BYTEWORDS` and
  `BYTEMOJIS` are frozen.
- **Every argument is checked before any work**, and a fault is `URError`
  `InvalidParameter` with `details: { parameter, value }` and the value
  rendered exactly: byte arguments must be `Uint8Array`s (a `Buffer` or a
  `Uint8Array` from another realm is accepted), string arguments strings,
  style strings one of their union, a hand-built `FountainPart` an object
  with safe-integer counters, a `u32` checksum and `Uint8Array` data;
  `fragmentLength`, `chooseFragments` (`seqNum` and `seqLen` ≥ 1, a `u32`
  checksum) and `mixFragments` (non-empty arrays) validate too. Such calls
  used to return a value or throw a `TypeError`. `details.value` is
  `unknown`.
- **`maxFragmentLength` accepts a `bigint`** up to 2⁶⁴ − 1 in
  `MultipartEncoder` and `FountainEncoder`, the reference's `usize`; a
  `number` of 2⁵³ or more stays `InvalidParameter`, whose message names the
  `bigint` form.

## 1.0.0-beta.2 - 2026-09-12

Compatibility and maintenance updates against `bc-ur-rust` 0.19.2 and
`ur` 0.4.1. The recorded encoding vectors remain unchanged; the decoder changes
below align selected behaviors with the reference.

### Changed

- `decodeBytewords` is case-sensitive, as the reference's
  `bytewords::decode` (its word tables are lower-case only); an upper-case
  letter is an "invalid word". `UR.parse` and `MultipartDecoder.add` still
  lower-case a whole UR string first, as `UR::from_ur_string` does.
- `MultipartDecoder.add` rejects a single-part UR with `Decoder` ("Can't
  decode single-part UR as multi-part"), as the reference's
  `MultipartDecoder` does; parse those with `UR.parse` (the README shows
  the one-line dispatch).
- `MultipartDecoder.add` parses the part like the reference's `ur::decode`:
  the `seqNum-seqLen` header is everything between the type and the
  **last** slash, each number read as `u16::from_str` reads it (an optional
  `+`, digits, at most 65535), and the fountain fields come from the part's
  CBOR - the header is no longer compared with them. `UR.parse` accepts the
  `+` too.
- A `maxFragmentLength` of 0 in `MultipartEncoder` / `FountainEncoder`, and
  an empty `FountainEncoder` message, report the reference's decoder errors
  (`Decoder`: "expected positive maximum fragment length", "expected
  non-empty message"); the rest of the JS input domain (`NaN`, fractions,
  negatives) stays `InvalidParameter`. `splitMessage` / `partition`, which
  mirror crate-private helpers, keep `InvalidParameter` for 0.

## 1.0.0-beta.1 - 2026-09-09

Initial beta implementation.
