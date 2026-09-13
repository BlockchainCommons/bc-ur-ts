# Changelog

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
  CBOR — the header is no longer compared with them. `UR.parse` accepts the
  `+` too.
- A `maxFragmentLength` of 0 in `MultipartEncoder` / `FountainEncoder`, and
  an empty `FountainEncoder` message, report the reference's decoder errors
  (`Decoder`: "expected positive maximum fragment length", "expected
  non-empty message"); the rest of the JS input domain (`NaN`, fractions,
  negatives) stays `InvalidParameter`. `splitMessage` / `partition`, which
  mirror crate-private helpers, keep `InvalidParameter` for 0.

## 1.0.0-beta.1 - 2026-09-09

Initial beta implementation.
