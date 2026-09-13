# Changelog

All notable changes to `@blockchaincommons/uniform-resources` are recorded
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the package follows [Semantic Versioning](https://semver.org/).

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

### Added

- `CHANGELOG.md`, listed in the published files.

### Internal

- Clarify the remaining fountain timing, multipart case, error-code, and empty-
  type differences; distinguish JavaScript validation from additional public APIs.
- Migrate all nine maintenance scripts to TypeScript/Bun and typecheck them.
- Track `bun.lock`, use frozen workflow installs, and remove unused `ajv` and
  `@types/pako` development dependencies.
- Pin Actions to verified commit SHAs and add the Dependabot reviewer.
- Publish with `--tag beta`, then mark the same version `latest` in the publish job.
- Refresh API snapshots to match the existing bytewords and multipart documentation.
- The Rust validation harness drops the D2-single, D2-arg, D2-header and D3
  allowlist rules; D2-case now also covers an upper-case type that the
  reference rejects before the port's later check. Corpus: a `+` header
  (single- and multipart), an upper-case multipart part. Vectors
  regenerated: 640 → 643 (9 changed, 3 added). Harness: 643 — 575 match,
  23 expected (D1 13 · D2-case 2 · D2-code 5 · D4 3), 45 JS-only, 0
  mismatch.
- Differential suite: tombstones T6 (bytewords case), T7 (single-part
  rejected), T8 (header not compared), T9 (`+` header), T10 (last-slash
  parsing).
- Tests: the eleven redundant non-null assertions removed (0 lint
  warnings).

## 1.0.0-beta.1 - 2026-09-09

Initial beta: `UR`, `URType`, `MultipartEncoder`/`MultipartDecoder`, the
fountain codec and bytewords subpaths, `urFor` / `decodeURWith`, with the
Rust validation harness and the differential suite against the
pre-redesign bundle.
