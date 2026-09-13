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

The divergences were found by the Rust cross-validation harness
(`tests/rust-validation`, `bc-ur = 0.19.2` over the `ur 0.4.1` crate).
Every part string, UR string and bytewords string is byte-identical; the
divergences are in the fountain decoder's *completion index*, in *error
taxonomy*, in the *case handling* of the reference's multipart decoder, in
one *specification* choice, and in the *safe-integer bound* of a length
argument. Harness on the current tree: **643 vectors — 575 match, 23
expected divergence (D1 13, D2-case 2, D2-code 5, D4 3), 45 js-only, 0
mismatch** (2026-09-12). D5 below is not vectored: the corpus stays inside
the safe-integer range.

### 1.1 The fountain decoder completes earlier (D1)

`FountainDecoder` keeps every mixed part and, whenever a pure fragment
appears, re-reduces all of them until no more progress is possible. The
`ur` crate's decoder (`fountain.rs`) reduces a mixed part against the
fragments it has decoded when the part arrives (`process_complex`) and, if
that leaves a single index, records the new fragment and **queues it — but
only `process_simple` drains the queue**, so a fragment derived from a
mixed part is not used to reduce the buffer until an unrelated simple part
arrives; a duplicate part returns early and does not drain it either.
Executed with three fragments, parts fed `pure{0}`, `mixed{1,2}`,
`mixed{0,1}`: the reference holds pure 0, derives pure 1 and buffers
`{1,2}`, and reports *incomplete* — still incomplete after a duplicate
`pure{0}` — until `mixed{0,2}` arrives; TypeScript completes on the third
part. On out-of-order or lossy sequences TypeScript therefore reports
completion at an **earlier or equal** part index, and can complete where
the reference is still incomplete after the same parts (in the corpus,
`32B max=10 shuffle:23 drop=50%` is incomplete there after all ten parts
and complete here at six). The reassembled message is identical. The
harness allows a vector iff both payloads match and the reference index is
≥ ours (or the reference is incomplete after ≥ our index). Matching would
mean withholding a fragment the decoder already holds. **Upstream fix:**
`ur-rs` `Decoder::process_complex` ends with `self.process_queue()`.

### 1.2 The reference's multipart decoder is case-sensitive (D2-case)

`UR::from_ur_string` lower-cases the whole string; `MultipartDecoder::receive`
does not, so the reference cannot read an upper-case QR alphanumeric
payload directly: executed, `receive("UR:BYTES/1-5/…")` is `InvalidScheme`
(`strip_prefix("ur:")` fails) and `receive("ur:Bad/…")` is `InvalidType`,
while the same strings lower-cased are accepted. TypeScript lower-cases in
`MultipartDecoder.add` as in `UR.parse`. Two vectors carry it: the
upper-case part (read here, `InvalidScheme` there) and `ur:Bad/…` (rejected
on both sides — as an upper-case type there, as a single-part string here
after lower-casing). **Upstream fix:** `receive` lower-cases as
`from_ur_string` does.

### 1.3 Finer error codes (D2-code)

The reference wraps everything raised by the `ur` crate as
`Error::UR(String)` (TypeScript code `Decoder`); its own finer variants
(`Bytewords`, `InvalidType`, `TypeUnspecified`, `NotSinglePart`, …) are
produced only by its pre-checks or by calling `bc_ur::bytewords::decode`
directly. TypeScript reports the finer code with the same inner text. Five
vectors: a bad checksum, an unknown word and an odd-length body inside
`UR.parse` (`Bytewords` here, `Decoder("invalid checksum" / "invalid word" /
"invalid length")` there), and `ur:` / `ur:/…` in `MultipartDecoder.add`
(`InvalidType` here — the empty type is rejected first, D4 — and
`Decoder("No type specified")` / `Decoder("Can't decode single-part UR as
multi-part")` there).

### 1.4 The empty UR type is rejected (D4)

`URType::new("")` succeeds in Rust and `UR::new("", cbor).string()` is
`ur:/…`, which `from_ur_string` reads back (executed). BCR-2020-005 defines
the type as *one or more* of `[a-z0-9-]`, so TypeScript's `URType` rejects
the empty string with `InvalidType` everywhere it can appear (`UR.from`,
`UR.parse`, `UR.encodeBytes`, `MultipartDecoder.add`). The specification,
not the reference, is the contract. Three vectors carry it. **Upstream
fix:** `URType::new` requires a non-empty string.

### 1.5 A `maxFragmentLength` above `2⁵³ − 1` (D5)

`MultipartEncoder::new(&ur, max)` takes a `usize`, which on a 64-bit target
reaches `2⁶⁴ − 1`; any value at least the message length gives one part.
TypeScript's `number` is exact only up to `Number.MAX_SAFE_INTEGER`
(`2⁵³ − 1`), and `MultipartEncoder` / `FountainEncoder` check
`maxFragmentLength` against that bound, so an integer such as `2⁵³` —
representable, but not safe — is `InvalidParameter` here and accepted
there (executed, 20-byte message):

| `maxFragmentLength` | Rust (64-bit) | TypeScript |
|---|---|---|
| `2⁵³ − 1` | one part | one part |
| `2⁵³` | one part | `InvalidParameter` |
| `2⁶³`, `2⁶⁴ − 1` | one part | `InvalidParameter` (`2⁶⁴` is not even an integer `number`) |

A `number` above `2⁵³` may already have been rounded before the call, so
accepting it would accept a length the caller never wrote; exact coverage
of the reference's domain needs a `bigint` argument path, which is not
introduced. No vector carries D5.

### Parity restored

Inputs the port used to treat differently from the reference and now
matches, each pinned by vectors:

- **`bytewords.decode` lower-cased its input** (D3, 1.0.0-beta.1); it is
  case-sensitive as `ur::bytewords::decode` (lower-case tables). `UR.parse`
  and `MultipartDecoder.add` lower-case the whole UR string first, as
  `UR::from_ur_string` does.
- **`MultipartDecoder.add` accepted a single-part UR** (D2-single); it is
  `Decoder("Can't decode single-part UR as multi-part")` on both sides.
- **`MultipartDecoder.add` rejected a URL header that disagreed with the
  CBOR** (D2-header); the reference parses the header as two `u16`s and
  reads the fountain fields from the CBOR, and so does the port. The part
  is now split at the last slash as `ur::decode` splits it (so
  `ur:test/1-2/3/…` is "Invalid indices" on both sides), and a leading `+`
  in a header number is accepted as `u16::from_str` accepts it.
- **`maxFragmentLength` 0 was an argument fault** (D2-arg); it is the
  reference's `Decoder("expected positive maximum fragment length")`, and
  an empty `FountainEncoder` message its `Decoder("expected non-empty
  message")`.
- Earlier: a reassembled message whose padding bytes are not zero (`invalid
  padding`), a part whose CBOR `seqNum` is 0 or whose four integer fields
  are not `u32`s, and a URL header beyond `u16` (`Invalid indices`) are
  `Decoder` on both sides.

## 2. JS-only input domain

Inputs the reference's types cannot receive, or surfaces the reference does
not expose. Every one is a `URError` `InvalidParameter` with `details: {
parameter, value }` and the message `"<parameter> must be …, got <value>"`;
the Rust harness counts their vectors as `js-only`.

- **`maxFragmentLength` / `fragmentLength`** that is not a non-negative
  integer (`NaN`, `1.5`, `Infinity`, `-1`). Zero is representable in `usize`
  and is the reference's `Decoder` (§1, parity restored); an integer above
  `2⁵³ − 1` is D5. `splitMessage` and `partition` mirror crate-private
  helpers (`pub(crate)` `fragment_length` / `partition`) and report
  `InvalidParameter` for 0 as well.
- **A hand-built `FountainPart`** given to `FountainDecoder.add` whose
  `seqNum`, `seqLen`, `messageLen` or `checksum` is not a `u32`, or whose
  `seqNum` is 0 (`ur::fountain::Part` has no public constructor, so the
  reference cannot receive one). On the wire the same fields are `Decoder`.
- **`shortIdentifier`** with data that is not 4 bytes (`&[u8; 4]` in Rust).
- **`mixFragments`** with no indices or an index with no fragment (the
  reference's `xor` helper is crate-private and never sees either).
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
  (`{ expected, found }` for `UnexpectedType`); `Error::UR(_)` ↔ `Decoder`
  (same inner text); `Error::Cbor(_)` ↔ `Cbor`; `InvalidParameter` is
  JS-only (§2). **A tag with no name** in `urFor` / `decodeURWith` is
  `TagUnnamed` with `details: { tag }`; the reference receives the same
  input and panics (`UREncodable::ur`, "CBOR tag … must have a name") — an
  error where the reference has none, not an input it cannot take.
- **Header and case handling.** The `seqNum-seqLen` header is everything
  between the type and the last slash, each number an optional `+` and
  digits at most 65535, informational beyond that; a whole UR string is
  lower-cased before decoding (`UR.parse`, `MultipartDecoder.add`), a bare
  bytewords string is not.
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
