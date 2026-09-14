# Rust reference cross-validation

Replays the vectors against the reference: `bc-ur = 0.19.2`, which delegates
bytewords, the fountain code and multipart parsing to `ur = 0.4.1` (parts are
decoded by `minicbor = 0.19.1`), over `dcbor = 0.25.2`. All four are pinned
in `Cargo.toml`, and the release profile keeps `overflow-checks = false`: the
reference's `choose_fragments` computes `sequence - 1`, which wraps for a
part whose `seqNum` is 0 in that profile, and the port follows the wrap.

```sh
cd tests/rust-validation
cargo run --release --offline --quiet -- ../vectors/vectors.json   # the golden file
bun run vectors:full                                                # (from the package root) writes tests/vectors/full.json
cargo run --release --offline --quiet -- ../vectors/full.json      # the whole corpus
cargo run --release --offline --quiet -- mismatch.json              # must exit 1 and print `1 MISMATCH`
```

Every vector is one outcome string: bytewords in all styles and the
identifier encoders, single-part UR encode and decode, multipart part
strings, decoder completion (index and reassembled UR), step-by-step
multipart and fountain decoding (every `add` result, `done` and `result`
after each part), raw part CBOR, `expectType`, and the dcbor bridge (`urFor`,
`decodeURWith`). A thrown error is `throw:<code>|<message>`; the code is
the reference's variant name (`Error::UR` is `Decoder`, `Error::Cbor` is
`Cbor`, a `dcbor::Error` its variant) and the message its `Display`.

Outcome classes:

- `match`: the reference reproduces the outcome, message included.
- `panic-mapped`: the reference panics where the port throws a typed error
  (`urFor` / `decodeURWith` over a codec with no tag, an unnamed first tag,
  or a name that is not a UR type); the `(kind, code)` pairs are listed in
  `main.rs`.
- `js-only`: an input the reference's types cannot receive: a length that
  is not a `u64` (a JSON number above 2⁵³ − 1 counts as such, since the
  port rejects it; a `bigint` travels as `"<digits>n"` and is compared
  exactly), a `shortIdentifier` input that is not 4 bytes, a hand-built
  fountain part with a field that is not an integer or, for the decoder,
  not a `u32`. Never compared.
- `MISMATCH`: anything else; `unparsable`: a malformed recipe. Either fails
  the run. There is no allowlist.

Result lines on the current tree (also printed by the `rust-validation` CI
job):

```
763 vectors - 717 match, 5 panic-mapped, 41 js-only, 0 MISMATCH       # vectors.json
2826 vectors - 2718 match, 5 panic-mapped, 103 js-only, 0 MISMATCH    # full.json
```

`mismatch.json` is one golden vector with a changed message; the harness
must reject it, which CI checks.

## Alias-table fixture

`tests/multipart-fixtures.test.ts` pins SHA-256 digests of the alias table
the reference's `Weighted::new` builds for the degree weights 1/1 … 1/n,
n ∈ {3, 11, 410, 1000, 65535}. To regenerate them, build a scratch crate
holding a copy of `ur-0.4.1/src/sampler.rs` with its fields made public,
write one line `<index> <f64 bits as 16 hex digits> <alias>` per index for
each n, and hash each file with SHA-256.
