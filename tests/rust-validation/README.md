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
names (`Error::UR(_)` → `Decoder`, `Error::Cbor(_)` → `Cbor`). Exit 0 iff
every vector matches or is an allowlisted expected divergence. Not wired
into CI (needs a Rust toolchain); run manually before any release.
