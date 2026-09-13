//! Replays tests/vectors/vectors.json against bc-ur 0.19.2.
//!
//!   cargo run --release -- ../vectors/vectors.json
//!
//! A recipe with an input the reference cannot receive — a
//! `maxFragmentLength` that is not a `u64`, a hand-built fountain part
//! (`ur::fountain::Part` has no public constructor), a `shortIdentifier`
//! input that is not 4 bytes (`&[u8; 4]`) — is counted as `js-only` and
//! never compared.
use bc_ur::{bytewords, MultipartDecoder, MultipartEncoder, UR};
use dcbor::prelude::*;
use serde::Deserialize;
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(Deserialize)]
struct File { count: usize, vectors: Vec<Vector> }
#[derive(Deserialize)]
struct Vector { name: String, recipe: serde_json::Value, expect: String }

fn bytes(v: &serde_json::Value) -> Vec<u8> {
    if let Some(h) = v.get("hex") { return hex::decode(h.as_str().unwrap()).unwrap(); }
    if let Some(t) = v.get("text") { return t.as_str().unwrap().as_bytes().to_vec(); }
    let n = v["cycle"].as_u64().unwrap() as usize;
    let start = v.get("start").and_then(|s| s.as_u64()).unwrap_or(0) as usize;
    (0..n).map(|i| ((start + i) & 0xff) as u8).collect()
}
fn style(s: &str) -> bytewords::Style {
    match s { "standard" => bytewords::Style::Standard, "uri" => bytewords::Style::Uri, _ => bytewords::Style::Minimal }
}
/// bc_ur::Error variant → the TypeScript `URError.code`.
fn code(e: &bc_ur::Error) -> String {
    let d = format!("{e:?}");
    let name = d.split('(').next().unwrap_or(&d);
    match name { "UR" => "Decoder".into(), "Cbor" => "Cbor".into(), n => n.to_string() }
}
type R<T> = Result<T, bc_ur::Error>;

fn ur_of(t: &str, cbor: &[u8]) -> R<UR> {
    let c = CBOR::try_from_data(cbor)?;
    UR::new(t, c)
}
fn ur_out(ur: &UR) -> String { format!("{}|{}", ur.ur_type_str(), hex::encode(ur.cbor().to_cbor_data())) }

/// A deterministic xorshift, identical to `orderParts` in recipes.ts.
struct Lcg(u32);
impl Lcg {
    fn next(&mut self) -> u32 { let mut x = self.0; x ^= x << 13; x ^= x >> 17; x ^= x << 5; self.0 = x; x }
}
fn order(parts: Vec<String>, order: &serde_json::Value, drop: u64) -> Vec<String> {
    if order == "forward" { return parts; }
    if order == "reverse" { return parts.into_iter().rev().collect(); }
    let seed = order["shuffle"].as_u64().unwrap() as u32;
    let mut rnd = Lcg(if seed == 0 { 1 } else { seed });
    let mut out = parts;
    let mut i = out.len();
    while i > 1 { i -= 1; let j = (rnd.next() as usize) % (i + 1); out.swap(i, j); }
    if drop > 0 { out.into_iter().filter(|_| (rnd.next() as u64) % 100 >= drop).collect() } else { out }
}
/// True when the recipe has an input the reference cannot receive.
fn js_only(r: &serde_json::Value) -> bool {
    match r["k"].as_str().unwrap_or("") {
        "fountainDecode" | "fountainAdd" => true,
        "mpEncode" => r["maxLen"].as_u64().is_none(),
        "mpDecode" => r.get("from").map_or(false, |f| f["maxLen"].as_u64().is_none()),
        "bwPlain" => {
            let f = r["fn"].as_str().unwrap_or("");
            (f == "identifier" || f == "bytemojiIdentifier") && bytes(&r["data"]).len() != 4
        }
        _ => false,
    }
}
fn mp_encode(spec: &serde_json::Value) -> R<Vec<String>> {
    let ur = ur_of(spec["type"].as_str().unwrap(), &bytes(&spec["cbor"]))?;
    let max = spec["maxLen"].as_u64().unwrap() as usize;
    let count = spec["parts"].as_u64().unwrap() as usize;
    let mut e = MultipartEncoder::new(&ur, max)?;
    (0..count).map(|_| e.next_part()).collect()
}
fn run(r: &serde_json::Value) -> String {
    let res: Result<R<String>, _> = catch_unwind(AssertUnwindSafe(|| -> R<String> {
        let k = r["k"].as_str().unwrap();
        Ok(match k {
            "bwEncode" => bytewords::encode(bytes(&r["data"]), style(r["style"].as_str().unwrap())),
            "bwRoundtrip" => {
                let st = style(r["style"].as_str().unwrap());
                hex::encode(bytewords::decode(&bytewords::encode(bytes(&r["data"]), st), st)?)
            }
            "bwDecode" => hex::encode(bytewords::decode(r["s"].as_str().unwrap(), style(r["style"].as_str().unwrap()))?),
            "bwPlain" => {
                let d = bytes(&r["data"]);
                match r["fn"].as_str().unwrap() {
                    "words" => bytewords::encode_to_words(&d),
                    "bytemojis" => bytewords::encode_to_bytemojis(&d),
                    "minimal" => bytewords::encode_to_minimal_bytewords(&d),
                    f => {
                        // A wrong length is js-only (filtered before `run`).
                        let a: [u8; 4] = d.try_into().expect("js-only filtered");
                        if f == "identifier" { bytewords::identifier(&a) } else { bytewords::bytemoji_identifier(&a) }
                    }
                }
            }
            "canon" => bytewords::canonicalize_byteword(r["token"].as_str().unwrap()).unwrap_or_else(|| "undefined".into()),
            "urEncode" => { let ur = ur_of(r["type"].as_str().unwrap(), &bytes(&r["cbor"]))?; format!("{}|{}", ur.string(), ur.qr_string()) }
            "urRoundtrip" => { let ur = ur_of(r["type"].as_str().unwrap(), &bytes(&r["cbor"]))?; ur_out(&UR::from_ur_string(ur.string())?) }
            "urDecode" => ur_out(&UR::from_ur_string(r["s"].as_str().unwrap())?),
            "mpEncode" => mp_encode(r)?.join(" "),
            "mpDecode" => {
                let parts: Vec<String> = if let Some(p) = r.get("parts") {
                    p.as_array().unwrap().iter().map(|s| s.as_str().unwrap().to_string()).collect()
                } else {
                    order(mp_encode(&r["from"])?, &r["order"], r.get("drop").and_then(|d| d.as_u64()).unwrap_or(0))
                };
                let mut d = MultipartDecoder::new();
                let mut n = 0;
                for p in &parts {
                    n += 1;
                    d.receive(p)?;
                    if d.is_complete() {
                        let ur = d.message()?.expect("complete");
                        return Ok(format!("done@{n}:{}", ur_out(&ur)));
                    }
                }
                format!("incomplete:{n}")
            }
            _ => panic!("unknown recipe {k}"),
        })
    }));
    match res {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => format!("throw:{}", code(&e)),
        Err(_) => "throw:panic".into(),
    }
}
/// Vectors the reference reproduces differently; each is documented in
/// RUST_DIVERGENCES.md. Consulted only when the outcomes differ.
///
/// D1: the TypeScript fountain decoder reduces mixed parts against every
/// pure fragment it holds (and re-reduces until no progress), so it can
/// complete on an EARLIER part than the `ur` crate's decoder, or complete
/// where the reference is still incomplete; the payload is identical.
///
/// D2, two shapes (D2-single, D2-arg and D2-header closed with 1.0.0-beta.2;
/// their rows must match):
///   D2-case   — `MultipartDecoder::receive` never lower-cases (a reference
///     defect; `UR::from_ur_string` does): an input with upper-case letters
///     is read here and rejected there.
///   D2-code   — Rust collapses everything raised inside the `ur` crate to
///     `Error::UR(_)` (`Decoder`); TypeScript reports the finer code
///     (`Bytewords`, `Cbor`, `InvalidType`, `TypeUnspecified`,
///     `InvalidScheme`, `NotSinglePart`).
///
/// (D3 — case-insensitive `bytewords::decode` — closed with 1.0.0-beta.2.)
///
/// D4: the empty UR type: Rust accepts `ur:/…`, TypeScript rejects it
/// (`InvalidType`), BCR-2020-005 being the contract.

fn expected_divergence(r: &serde_json::Value, got: &str, want: &str) -> Option<&'static str> {
    let k = r["k"].as_str().unwrap_or("");
    let note = r.get("note").and_then(|n| n.as_str()).unwrap_or("");
    let done = |s: &str| -> Option<(usize, String)> {
        let (k, payload) = s.strip_prefix("done@")?.split_once(':')?;
        Some((k.parse().ok()?, payload.to_string()))
    };
    let incomplete = |s: &str| -> Option<usize> { s.strip_prefix("incomplete:")?.parse().ok() };
    let finer = |ts: &str| matches!(ts, "throw:Bytewords" | "throw:Cbor" | "throw:InvalidType" | "throw:TypeUnspecified" | "throw:InvalidScheme" | "throw:NotSinglePart");
    let has_upper = |s: &str| s.chars().any(|c| c.is_ascii_uppercase());
    let empty_type = match k {
        "urEncode" | "urRoundtrip" => r["type"].as_str() == Some(""),
        "urDecode" => r["s"].as_str().map_or(false, |s| s.starts_with("ur:/")),
        _ => false,
    };
    match k {
        _ if empty_type && want == "throw:InvalidType" && !got.starts_with("throw:") => Some("D4"),
        "mpDecode" if r.get("parts").is_some() => {
            let parts: Vec<&str> = r["parts"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
            match note {
                // D2-case: an upper-case part is read here and rejected there (`InvalidScheme` for
                // `UR:`, `InvalidType` for an upper-case type — in the latter case TypeScript
                // lower-cases and then reports whatever comes next, e.g. `Decoder` for a
                // single-part string).
                _ if parts.iter().any(|p| has_upper(p)) && ((got.starts_with("throw:") && !want.starts_with("throw:")) || got == "throw:InvalidType") => Some("D2-case"),
                _ if got == "throw:Decoder" && finer(want) => Some("D2-code"),
                _ => None,
            }
        }
        "mpDecode" => match (done(got), done(want), incomplete(got)) {
            (Some((rk, rp)), Some((tk, tp)), _) if rp == tp && rk >= tk => Some("D1"),
            (None, Some((tk, _)), Some(n)) if tk <= n => Some("D1"),
            _ => None,
        },
        "urDecode" if got == "throw:Decoder" && finer(want) => Some("D2-code"),
        _ => None,
    }
}

fn main() {
    let path = std::env::args().nth(1).expect("path");
    let file: File = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    assert_eq!(file.count, file.vectors.len());
    let (mut ok, mut expected, mut js_only_n, mut mismatch) = (0, 0, 0, 0);
    for v in &file.vectors {
        if js_only(&v.recipe) { js_only_n += 1; continue; }
        let got = run(&v.recipe);
        if got == v.expect { ok += 1; continue; }
        if let Some(id) = expected_divergence(&v.recipe, &got, &v.expect) { expected += 1; eprintln!("expected-divergence [{id}] {} | rust={} | ts={} | recipe={}", v.name, &got[..got.len().min(80)], &v.expect[..v.expect.len().min(80)], &v.recipe.to_string()[..v.recipe.to_string().len().min(140)]); continue; }
        mismatch += 1;
        eprintln!("MISMATCH {}\n  rust: {}\n  ts:   {}", v.name, &got[..got.len().min(160)], &v.expect[..v.expect.len().min(160)]);
    }
    println!("{} vectors - {ok} match, {expected} expected-divergence, {js_only_n} js-only, {mismatch} MISMATCH", file.vectors.len());
    std::process::exit(if mismatch == 0 { 0 } else { 1 });
}
