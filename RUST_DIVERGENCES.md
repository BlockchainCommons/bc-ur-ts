# Divergences from the Rust reference implementation

This library is a TypeScript port of
[`BlockchainCommons/bc-ur-rust`](https://github.com/BlockchainCommons/bc-ur-rust),
tracked at version **0.19.2**
([`2f8b4e7`](https://github.com/BlockchainCommons/bc-ur-rust/commit/2f8b4e728945f9dc248eba71911b89371f076924)).

The tracked version and commit are recorded in
[`.github/versions.yml`](./.github/versions.yml), and the `upstream.yml`
workflow opens a tracking issue whenever the reference implementation moves
ahead of it.

This document is the deliberate record of every place the TypeScript behaviour
differs from the Rust reference. It has three kinds of entry:

1. **True behavioral divergences** - the same input produces a different outcome.
2. **JS-only input domain** - inputs that have no Rust analog, so there is nothing to diverge from.
3. **Mapping equivalences** - JS-specific inputs that are validated through the bytes they produce.

## 1. True behavioral divergences

D1–D3 were found by the Rust cross-validation harness (`tests/rust-validation`,
`bc-ur = 0.19.2` over the `ur 0.4.1` crate) and are the pre-redesign
behaviour, kept deliberately; D4 was a deliberate specification decision.
Every part string, UR string and bytewords string is byte-identical; the
divergences are in *decoding leniency*, *error taxonomy*, and one
*specification* choice. Harness on the current tree: **640 vectors — 565
match, 30 expected divergence (D1 13, D2 12, D3 2, D4 3), 45 js-only, 0
mismatch** (2026-09-11).

### 1.1 The fountain decoder completes earlier (D1)

`FountainDecoder` keeps every mixed part and, whenever a pure fragment
appears, re-reduces all of them until no more progress is possible. The
`ur` crate's decoder reduces a mixed part only when it arrives and when a
new simple part is produced from it, so it can need more parts. On
out-of-order or lossy sequences TypeScript therefore reports completion at
an **earlier or equal** part index, and can complete where the reference is
still incomplete after the same parts. The reassembled message is
identical. The harness allows a vector iff both payloads match and the
reference index is ≥ ours (or the reference is incomplete after ≥ our
index).

### 1.2 Finer error codes and a more lenient multipart decoder (D2)

The reference wraps everything raised by the `ur` crate as
`Error::UR(String)` (TypeScript code `Decoder`). The harness allows exactly
five shapes, each named in its output:

- **D2-code** — TypeScript reports the finer code where the reference says
  `Decoder`: `Bytewords` for a bad checksum, an empty payload or an
  odd-length minimal string inside `UR.parse`; `InvalidType`,
  `TypeUnspecified`, `InvalidScheme`, `NotSinglePart`, `Cbor` likewise.
- **D2-single** — `MultipartDecoder.add` accepts a single-part UR string
  and completes on it; the reference rejects it (`NotMultiPart`).
- **D2-case** — `MultipartDecoder.add` lower-cases its input as
  `UR::from_ur_string` does; the reference's multipart path is
  case-sensitive, so it cannot read an upper-case QR payload directly.
- **D2-arg** — `maxFragmentLength` 0 is `Error::UR` in Rust and
  `InvalidParameter` here (§2).
- **D2-header** — `MultipartDecoder.add` rejects a part whose URL header
  (`seqNum-seqLen`) disagrees with the part's CBOR (`Decoder("Multipart
  metadata mismatch …")`); the reference parses the header as two `u16`s
  and otherwise ignores it. A part whose label lies about its sequence is
  malformed; the port is stricter. (The `u16` parse itself is matched:
  `70000-70000` is `Invalid indices` on both sides.)

### 1.3 `bytewords.decode` is case-insensitive (D3)

TypeScript lower-cases before decoding in every style; the reference
accepts lower-case only outside `UR::from_ur_string`. Allowed for
`bwDecode` vectors whose input contains upper-case letters.

### 1.4 The empty UR type is rejected (D4)

`URType::new("")` succeeds in Rust and `UR::new("", cbor).string()` is
`ur:/…`, which `from_ur_string` reads back. BCR-2020-005 defines the type as
*one or more* of `[a-z0-9-]`, so TypeScript's `URType` rejects the empty
string with `InvalidType` everywhere it can appear (`UR.from`, `UR.parse`,
`UR.encodeBytes`, `MultipartDecoder.add`). The specification, not the
reference, is the contract. Three vectors carry it.

### Parity restored

Three inputs the port used to accept and the reference rejects now match
it (`Decoder` on both sides): a reassembled message whose padding bytes
are not zero (`invalid padding`, the reference's message); a part whose
CBOR `seqNum` is 0 or whose four integer fields are not `u32`s; a URL header
beyond `u16` (`Invalid indices`).

## 2. JS-only input domain

Inputs the reference's types cannot receive. Every one is a `URError`
`InvalidParameter` with `details: { parameter, value }` and the message
`"<parameter> must be …, got <value>"`; the Rust harness counts their
vectors as `js-only`.

- **`maxFragmentLength` / `fragmentLength`** that is not an integer ≥ 1
  (`NaN`, `1.5`, `Infinity`, `-1`, and `0`, which the reference reports as
  `Error::UR` — D2-arg). Previously `NaN` leaked `RangeError("no fragments
  to mix")` from inside the fountain and `1.5` was accepted.
- **A hand-built `FountainPart`** given to `FountainDecoder.add` whose
  `seqNum`, `seqLen`, `messageLen` or `checksum` is not a `u32`, or whose
  `seqNum` is 0 (`ur::fountain::Part` has no public constructor, so the
  reference cannot receive one). On the wire the same fields are `Decoder`.
- **`shortIdentifier`** with data that is not 4 bytes (`&[u8; 4]` in Rust).
- **`mixFragments`** with no indices or an index with no fragment.
- **A tag with no name** in `urFor` / `decodeURWith` (the reference panics):
  `TagUnnamed` with `details: { tag }`.
- **Non-canonical CBOR in `UR.from`.** A `UR` is built from a decoded
  `Cbor` value, so invalid or non-canonical bytes cannot reach it; the
  corpus feeds only canonical dCBOR (`1.5` is `f93e00`, not the f64 form).

## 3. Mapping equivalences

- **API shape.** `UR::new(type, cbor)` ↔ `UR.from(type, cbor)`;
  `from_ur_string` ↔ `UR.parse`; `MultipartEncoder::new(&ur, max)` ↔ `new
  MultipartEncoder(ur, max)`; `next_part` ↔ `nextPart`; `MultipartDecoder
  receive/is_complete/message` ↔ `add/done/result`.
- **Errors.** `Error::InvalidScheme` … `Error::UnexpectedType(a, b)` ↔
  `URError` codes of the same name with `details` discriminated by `code`
  (`{ expected, found }` for `UnexpectedType`); `Error::UR(_)` ↔ `Decoder`;
  `Error::Cbor(_)` ↔ `Cbor`; `InvalidParameter` and `TagUnnamed` are
  JS-only (§2).
- **Part ordering in vectors.** Shuffles and drops use an xorshift defined
  identically in `tests/vectors/recipes.ts` and the harness, so both sides
  feed the same subsequence.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires.
