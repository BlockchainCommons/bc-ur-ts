# Changelog

## Unreleased

### Changed

- `decodeURWith` accepts a UR named after any of the codec's tags (a type with a legacy tag, or one that dispatches on the tag), wrapping the content in the matching tag.

## 1.0.0-beta.1

Extracted from the [`paritytech/bcts`](https://github.com/paritytech/bcts)
monorepo (`@bcts/uniform-resources`) and redesigned as an idiomatic
TypeScript library; see [MIGRATION.md](./MIGRATION.md). Every string this
package produces is unchanged.

- Built on canonical `@blockchaincommons/dcbor`; `crc32` from
  `@blockchaincommons/crypto`; xoshiro on 32-bit lanes (no BigInt).
- `UR.from` / `UR.parse`, `type` and `cbor` getters, `toString` /
  `toQRString` / `toQRBytes`, `expectType` / `isType`, `encodeBytes` /
  `decodeBytes`; `URType.name`, `URType.isValid`.
- Bytewords on the `/bytewords` subpath with string-literal styles,
  `identifier` / `shortIdentifier`; the fountain code on `/fountain`.
- `MultipartEncoder` is iterable (`index`, `partCount`);
  `MultipartDecoder.add/done/result/progress/reset`.
- One `URError` with `code`, `details`, `cause` and factories; the nine
  error classes, `Result` and `isError` removed.
- `ToUR`, `urFor(value)`, `decodeURWith(ur, codec)` replace the
  encodable/decodable/codable interfaces.
- 2–6× faster: bytewords decode via a packed two-letter lookup, UR parse
  6×, multipart encode 2.4× and decode 1.9× (`bench/benchmark.mjs`).
- 616 golden vectors, a differential corpus against the frozen pre-redesign
  bundle, and a Rust cross-validation harness (`tests/rust-validation`,
  `bc-ur 0.19.2`: 590 match, 26 documented divergences, 0 mismatch).

---

## History as `@bcts/uniform-resources`

## [1.0.0-beta.6] - 2026-07-29

### Changed

- Workspace version bump

## [1.0.0-beta.5] - 2026-07-01

### Changed

- Workspace version bump

## [1.0.0-beta.4] - 2026-06-28

### Changed

- Dependency sync

## [1.0.0-beta.3] - 2026-06-22

### Changed

- Dependencies bump

## [1.0.0-beta.2] - 2026-06-16

### Changed

- Dependencies bump

## [1.0.0-beta.1] - 2026-05-27

### Changed

- Workspace version bump

## [1.0.0-beta.0] - 2026-04-27

### Fixed

- `MultipartEncoder` now always emits the `seqNum-seqLen/` prefix, including when `seqLen === 1`. The previous short-circuit returned a plain UR for single-part messages and diverged from `bc-ur-rust`.

### Changed

- Misc cleanups in `error.ts` and `bytewords-namespace.ts` to align surface with Rust upstream.

## [1.0.0-alpha.23] - 2026-04-24

### Added

- New variable-length ByteWord helpers mirroring `bc-ur-rust` ≥ v0.19.1:
  - `encodeToWords(data)` — space-separated ByteWords for arbitrary byte slices (no CRC).
  - `encodeToBytemojis(data)` — space-separated Bytemojis for arbitrary byte slices.
  - `encodeToMinimalBytewords(data)` — 2-letter minimal ByteWords concatenated without separator.
  - `isValidBytemoji(emoji)` — membership check against the canonical 256-Bytemoji set.
  - `canonicalizeByteword(input)` — normalizes a 2- or 4-letter ByteWord input into its canonical 4-letter form.
- `tests/bytewords-helpers.test.ts` exercising the new helpers.

### Changed

- The existing `encodeBytewordsIdentifier` / `encodeBytemojisIdentifier` are now thin 4-byte wrappers over `encodeToWords` / `encodeToBytemojis`.

## [1.0.0-alpha.22] - 2026-03-01

### Changed

- Workspace version bump

## [1.0.0-alpha.21] - 2026-02-27

### Changed

- Workspace version bump

## [1.0.0-alpha.20] - 2026-02-12

### Changed

- Workspace version bump

## [1.0.0-alpha.19] - 2026-02-05

### Changed

- Workspace version bump

## [1.0.0-alpha.18] - 2025-01-31

### Changed

- Updated Rust reference implementations
