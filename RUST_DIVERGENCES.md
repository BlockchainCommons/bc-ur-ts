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

All three were found by the Phase 1 harness (`tests/rust-validation`,
`bc-ur = 0.19.2` over the `ur 0.4.1` crate) and are the pre-redesign
behaviour, kept deliberately. Every part string, UR string and bytewords
string is byte-identical; the divergences are in *decoding leniency* and
*error taxonomy*, and TypeScript is a superset in each case.

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

### 1.2 Finer error codes inside the decoders (D2)

The reference wraps everything raised by the `ur` crate as
`Error::UR(String)` (TypeScript code `Decoder`): a bad bytewords checksum
inside `UR::from_ur_string`, an empty payload, an odd-length minimal
string. TypeScript reports `Bytewords` for those, keeps `InvalidType` when
the type is bad, and `Cbor` for CBOR failures. `MultipartDecoder` also
accepts a single-part UR string (completing on it) and lower-cases its
input as `UR::from_ur_string` does, where the reference rejects both (the
reference's multipart path is case-sensitive, so it cannot read an
upper-case QR payload directly). Allowed for `urDecode` vectors where the
reference says `Decoder` and TypeScript `Bytewords`, and for every
explicit-part `mpDecode` vector.

### 1.3 `bytewords.decode` is case-insensitive (D3)

TypeScript lower-cases before decoding in every style; the reference
accepts lower-case only outside `UR::from_ur_string`. Allowed for
`bwDecode` vectors whose input contains upper-case letters.

## 2. JS-only input domain

- **Non-canonical CBOR in `UR.from`.** A `UR` is built from a decoded
  `Cbor` value, so invalid or non-canonical bytes cannot reach it; the
  corpus feeds only canonical dCBOR (`1.5` is `f93e00`, not the f64 form).
- **`URType` accepts the empty string.** Both do (the failure surfaces
  later, at decode, as `TypeUnspecified`).

## 3. Mapping equivalences

- **API shape.** `UR::new(type, cbor)` ↔ `UR.from(type, cbor)`;
  `from_ur_string` ↔ `UR.parse`; `MultipartEncoder::new(&ur, max)` ↔ `new
  MultipartEncoder(ur, max)`; `next_part` ↔ `nextPart`; `MultipartDecoder
  receive/is_complete/message` ↔ `add/done/result`.
- **Errors.** `Error::InvalidScheme` … `Error::UnexpectedType(a, b)` ↔
  `URError` codes of the same name; `Error::UR(_)` ↔ `Decoder`;
  `Error::Cbor(_)` ↔ `Cbor`.
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
