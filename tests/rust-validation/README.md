# Rust reference cross-validation

Replays `tests/vectors/vectors.json` against `bc-ur = 0.19.2`.

```sh
cd tests/rust-validation
cargo run --release -- ../vectors/vectors.json
```

Bytewords (all styles and the identifier encoders), single-part UR
encode/decode, multipart encode (the exact part strings) and multipart
decode (the part index at which the decoder completes, and the reassembled
UR) compare exactly; error variants are normalised to the TypeScript code
names (`Error::UR(_)` → `Decoder`, `Error::Cbor(_)` → `Cbor`). Exit 0 means every compared vector matches or is an allowed expected difference (D1 fountain
completion index, D2-case, D2-code, D4 — see [RUST_DIVERGENCES.md](../../RUST_DIVERGENCES.md); an
allowlist entry that stops matching any vector is deleted, never kept).
Not wired into CI (needs a Rust toolchain); run manually before any release.

The current corpus has 643 vectors: 575 matches, 23 expected differences, and
45 skipped TypeScript-domain/public-helper cases. Skipped cases are not replayed
against Rust. The expected-difference rules check completion timing, case handling,
error codes, and empty types; unexpected mismatches fail the run.
