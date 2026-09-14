//! Replays the vectors of `tests/vectors/vectors.json` (or the full corpus,
//! `bun run vectors:full` → `tests/vectors/full.json`) against the reference:
//! bc-ur 0.19.2 over the `ur` 0.4.1 and `minicbor` 0.19.1 crates.
//!
//!   cargo run --release --offline --quiet -- ../vectors/vectors.json
//!
//! Outcome classes:
//! - `match`: the reference reproduces the vector's outcome, error code and
//!   message included (`throw:<code>|<message>`; `bc_ur::Error::UR` is the
//!   port's `Decoder`, `Error::Cbor` its `Cbor`).
//! - `panic-mapped`: the reference panics where the port throws one of the
//!   typed errors in `PANIC_MAPPED` (`urFor` / `decodeURWith` over a codec
//!   with no tag, an unnamed first tag, or a name that is not a UR type).
//! - `js-only`: an input the reference's types cannot receive (a length that
//!   is not a `u64`, a `shortIdentifier` input that is not 4 bytes, a
//!   hand-built fountain part with a field outside `u32` or not an integer);
//!   never compared.
//! - `MISMATCH`: anything else. A malformed recipe is `unparsable`. Either
//!   fails the run, and nothing outside a single vector can panic. There is
//!   no allowlist.
//!
//! Integers: a JSON number is compared only up to 2^53 - 1 (serde reads the
//! decimal, which above that bound is not the double the TypeScript side
//! used, and the port rejects such a `number`); a `"<digits>n"` string is a
//! `bigint` and parses exactly as a `u64`; anything else is js-only.
//!
//! Hand-built fountain parts (`fountainDecode`, `fountainAdd`) are encoded
//! with `minicbor` and decoded as `ur::fountain::Part`, the way a part
//! reaches `ur::fountain::Decoder` in the reference.
use bc_ur::{bytewords, MultipartDecoder, MultipartEncoder, URDecodable, UREncodable, UR};
use dcbor::prelude::*;
use serde::Deserialize;
use serde_json::Value;
use std::cell::RefCell;
use std::panic::{catch_unwind, AssertUnwindSafe};

#[derive(Deserialize)]
struct File {
    count: usize,
    vectors: Vec<Vector>,
}
#[derive(Deserialize)]
struct Vector {
    name: String,
    recipe: Value,
    expect: String,
}

/// `(kind, TypeScript code)` pairs where the reference panics and the port throws.
const PANIC_MAPPED: &[(&str, &str)] = &[
    ("urFor", "TagUnnamed"),
    ("urFor", "InvalidType"),
    ("decodeURWith", "TagUnnamed"),
];

/// An integer field of a recipe.
enum Int {
    /// Exactly representable on both sides.
    Exact(u64),
    /// A negative integer (a fountain field may carry one on the wire).
    Negative(i64),
    /// No `u64` form: NaN, an infinity, a fraction, a JSON number above
    /// 2^53 - 1, or a bigint outside `u64`.
    JsOnly,
}
fn int(v: &Value) -> Option<Int> {
    if let Some(n) = v.as_u64() {
        return Some(if n <= 9_007_199_254_740_991 { Int::Exact(n) } else { Int::JsOnly });
    }
    if let Some(n) = v.as_i64() {
        return Some(if n >= -9_007_199_254_740_991 { Int::Negative(n) } else { Int::JsOnly });
    }
    if v.is_number() {
        return Some(Int::JsOnly);
    }
    let s = v.as_str()?;
    if matches!(s, "NaN" | "Infinity" | "-Infinity") {
        return Some(Int::JsOnly);
    }
    let digits = s.strip_suffix('n')?;
    let (negative, digits) = match digits.strip_prefix('-') {
        Some(d) => (true, d),
        None => (false, digits),
    };
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    if negative {
        return Some(Int::JsOnly);
    }
    Some(digits.parse::<u64>().map_or(Int::JsOnly, Int::Exact))
}
/// A `usize` argument: `Some(Some(n))` exact, `Some(None)` js-only, `None` unparsable.
fn usize_of(v: &Value) -> Option<Option<usize>> {
    Some(match int(v)? {
        Int::Exact(n) => Some(n as usize),
        _ => None,
    })
}

enum Class {
    Compare,
    JsOnly,
    Unparsable,
}
fn class_of_usize(v: &Value) -> Class {
    match usize_of(v) {
        Some(Some(_)) => Class::Compare,
        Some(None) => Class::JsOnly,
        None => Class::Unparsable,
    }
}
/// The four integer fields of a hand-built part; `ok` decides which values the reference can receive.
fn class_of_fields(v: &Value, ok: impl Fn(&Int) -> bool) -> Class {
    let Some(fields) = v.as_array() else { return Class::Unparsable };
    if fields.len() != 4 {
        return Class::Unparsable;
    }
    let mut class = Class::Compare;
    for f in fields {
        match int(f) {
            None => return Class::Unparsable,
            Some(i) if !ok(&i) => class = Class::JsOnly,
            Some(_) => {}
        }
    }
    class
}
/// Whether the recipe has an input the reference cannot receive.
fn classify(r: &Value) -> Class {
    let Some(k) = r["k"].as_str() else { return Class::Unparsable };
    match k {
        // Any integer encodes; the reference's decoder then decides.
        "fountainDecode" => class_of_fields(&r["part"]["fields"], |i| !matches!(i, Int::JsOnly)),
        // A `Part` reaches the decoder only with `u32` fields.
        "fountainAdd" => match r["parts"].as_array() {
            None => Class::Unparsable,
            Some(parts) => {
                let mut class = Class::Compare;
                for p in parts {
                    match class_of_fields(&p["fields"], |i| {
                        matches!(i, Int::Exact(n) if *n <= u64::from(u32::MAX))
                    }) {
                        Class::Unparsable => return Class::Unparsable,
                        Class::JsOnly => class = Class::JsOnly,
                        Class::Compare => {}
                    }
                }
                class
            }
        },
        "mpEncode" => class_of_usize(&r["maxLen"]),
        "mpDecode" if r.get("parts").is_some() => Class::Compare,
        "mpDecode" | "mpDecodeFrom" => class_of_usize(&r["from"]["maxLen"]),
        "bwPlain" => {
            let f = r["fn"].as_str().unwrap_or("");
            match bytes(&r["data"]) {
                None => Class::Unparsable,
                Some(d) if (f == "identifier" || f == "bytemojiIdentifier") && d.len() != 4 => Class::JsOnly,
                Some(_) => Class::Compare,
            }
        }
        _ => Class::Compare,
    }
}

fn bytes(v: &Value) -> Option<Vec<u8>> {
    if let Some(h) = v.get("hex") {
        return hex::decode(h.as_str()?).ok();
    }
    if let Some(t) = v.get("text") {
        return Some(t.as_str()?.as_bytes().to_vec());
    }
    let n = v.get("cycle")?.as_u64()? as usize;
    let start = match v.get("start") {
        Some(s) => s.as_u64()? as usize,
        None => 0,
    };
    Some((0..n).map(|i| ((start + i) & 0xff) as u8).collect())
}
fn str_of<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key)?.as_str()
}
fn strs(v: &Value) -> Option<Vec<String>> {
    v.as_array()?.iter().map(|s| s.as_str().map(str::to_string)).collect()
}
fn style(s: &str) -> bytewords::Style {
    match s {
        "standard" => bytewords::Style::Standard,
        "uri" => bytewords::Style::Uri,
        _ => bytewords::Style::Minimal,
    }
}
/// bc_ur::Error variant → the TypeScript `URError.code`.
fn code(e: &bc_ur::Error) -> String {
    let d = format!("{e:?}");
    let name = d.split('(').next().unwrap_or(&d);
    match name {
        "UR" => "Decoder".into(),
        n => n.to_string(),
    }
}
fn ur_err(e: &bc_ur::Error) -> String {
    format!("throw:{}|{e}", code(e))
}
/// dcbor::Error → `throw:<variant>|<Display>`.
fn cbor_err(e: &dcbor::Error) -> String {
    let d = format!("{e:?}");
    let name = d.split('(').next().unwrap_or(&d);
    format!("throw:{name}|{e}")
}
/// A `ur` crate error, as bc-ur wraps it (`Error::UR(e.to_string())`).
fn fountain_err(e: impl std::fmt::Display) -> String {
    format!("throw:Decoder|UR decoder error ({e})")
}

fn ur_of(t: &str, cbor: &[u8]) -> Result<UR, bc_ur::Error> {
    let c = CBOR::try_from_data(cbor)?;
    UR::new(t, c)
}
fn ur_out(ur: &UR) -> String {
    format!("{}|{}", ur.ur_type_str(), hex::encode(ur.cbor().to_cbor_data()))
}

/// A deterministic xorshift, identical to `orderParts` in recipes.ts.
struct Lcg(u32);
impl Lcg {
    fn next(&mut self) -> u32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x
    }
}
fn order(parts: Vec<String>, order: &Value, drop: u64) -> Option<Vec<String>> {
    if order == "forward" {
        return Some(parts);
    }
    if order == "reverse" {
        return Some(parts.into_iter().rev().collect());
    }
    let seed = order.get("shuffle")?.as_u64()? as u32;
    let mut rnd = Lcg(if seed == 0 { 1 } else { seed });
    let mut out = parts;
    let mut i = out.len();
    while i > 1 {
        i -= 1;
        let j = (rnd.next() as usize) % (i + 1);
        out.swap(i, j);
    }
    Some(if drop > 0 {
        out.into_iter().filter(|_| (rnd.next() as u64) % 100 >= drop).collect()
    } else {
        out
    })
}
fn mp_encode(spec: &Value, count: usize) -> Option<Result<Vec<String>, bc_ur::Error>> {
    let ur = match ur_of(str_of(spec, "type")?, &bytes(&spec["cbor"])?) {
        Ok(u) => u,
        Err(e) => return Some(Err(e)),
    };
    let max = usize_of(&spec["maxLen"])??;
    let mut e = match MultipartEncoder::new(&ur, max) {
        Ok(e) => e,
        Err(e) => return Some(Err(e)),
    };
    Some((0..count).map(|_| e.next_part()).collect())
}

// The codable kinds: a type whose tags are set per vector. `UREncodable::ur`
// reads `untagged_cbor()`; `URDecodable::from_ur` checks the first tag's
// name and hands the UR's CBOR to `from_untagged_cbor`.
thread_local! {
    static TAGS: RefCell<Vec<Tag>> = const { RefCell::new(Vec::new()) };
}
struct Probe(CBOR);
impl CBORTagged for Probe {
    fn cbor_tags() -> Vec<Tag> {
        TAGS.with(|t| t.borrow().clone())
    }
}
impl From<Probe> for CBOR {
    fn from(p: Probe) -> CBOR {
        p.tagged_cbor()
    }
}
impl CBORTaggedEncodable for Probe {
    fn untagged_cbor(&self) -> CBOR {
        self.0.clone()
    }
}
impl TryFrom<CBOR> for Probe {
    type Error = dcbor::Error;
    fn try_from(c: CBOR) -> dcbor::Result<Self> {
        Self::from_tagged_cbor(c)
    }
}
impl CBORTaggedDecodable for Probe {
    fn from_untagged_cbor(c: CBOR) -> dcbor::Result<Self> {
        Ok(Probe(c))
    }
}
fn set_tags(v: &Value) -> Option<()> {
    let tags = v
        .as_array()?
        .iter()
        .map(|t| {
            let value = t.get("value")?.as_u64()?;
            Some(match t.get("name").and_then(|n| n.as_str()) {
                Some(name) => Tag::new(value, name),
                None => Tag::with_value(value),
            })
        })
        .collect::<Option<Vec<_>>>()?;
    TAGS.with(|t| *t.borrow_mut() = tags);
    Some(())
}

enum Out {
    Value(String),
    Panic,
    Unparsable,
}
fn run(r: &Value) -> Out {
    match catch_unwind(AssertUnwindSafe(|| run_recipe(r))) {
        Ok(Some(s)) => Out::Value(s),
        Ok(None) => Out::Unparsable,
        Err(_) => Out::Panic,
    }
}
/// The CBOR of a hand-built part: `[f0, f1, f2, f3, data]` with minimal integer heads.
fn part_cbor(fields: &Value, data: &[u8], u32_only: bool) -> Option<Vec<u8>> {
    let fields = fields.as_array()?;
    let mut enc = minicbor::Encoder::new(Vec::new());
    enc.array(5).ok()?;
    for f in fields {
        match int(f)? {
            Int::Exact(n) if u32_only => {
                enc.u32(u32::try_from(n).ok()?).ok()?;
            }
            Int::Exact(n) => {
                enc.u64(n).ok()?;
            }
            Int::Negative(n) if !u32_only => {
                enc.i64(n).ok()?;
            }
            _ => return None,
        }
    }
    enc.bytes(data).ok()?;
    Some(enc.into_writer())
}
/// A decoded part's fields, read back from its own encoding (the fields are private).
fn part_fields(p: &ur::fountain::Part) -> Option<(u32, u32, u32, u32, Vec<u8>)> {
    let v = minicbor::to_vec(p).ok()?;
    let mut d = minicbor::Decoder::new(&v);
    d.array().ok()?;
    Some((d.u32().ok()?, d.u32().ok()?, d.u32().ok()?, d.u32().ok()?, d.bytes().ok()?.to_vec()))
}

/// `None` when the recipe is malformed.
fn run_recipe(r: &Value) -> Option<String> {
    let k = r["k"].as_str()?;
    Some(match k {
        "bwEncode" => bytewords::encode(bytes(&r["data"])?, style(str_of(r, "style")?)),
        "bwRoundtrip" => {
            let st = style(str_of(r, "style")?);
            match bytewords::decode(&bytewords::encode(bytes(&r["data"])?, st), st) {
                Ok(v) => hex::encode(v),
                Err(e) => ur_err(&e),
            }
        }
        "bwDecode" => match bytewords::decode(str_of(r, "s")?, style(str_of(r, "style")?)) {
            Ok(v) => hex::encode(v),
            Err(e) => ur_err(&e),
        },
        "bwPlain" => {
            let d = bytes(&r["data"])?;
            match str_of(r, "fn")? {
                "words" => bytewords::encode_to_words(&d),
                "bytemojis" => bytewords::encode_to_bytemojis(&d),
                "minimal" => bytewords::encode_to_minimal_bytewords(&d),
                f => {
                    // A wrong length is js-only and never reaches here.
                    let a: [u8; 4] = d.try_into().ok()?;
                    if f == "identifier" {
                        bytewords::identifier(&a)
                    } else {
                        bytewords::bytemoji_identifier(&a)
                    }
                }
            }
        }
        "canon" => bytewords::canonicalize_byteword(str_of(r, "token")?)
            .unwrap_or_else(|| "undefined".into()),
        "urEncode" => match ur_of(str_of(r, "type")?, &bytes(&r["cbor"])?) {
            Ok(ur) => format!("{}|{}", ur.string(), ur.qr_string()),
            Err(e) => ur_err(&e),
        },
        "urRoundtrip" => match ur_of(str_of(r, "type")?, &bytes(&r["cbor"])?)
            .and_then(|ur| UR::from_ur_string(ur.string()))
        {
            Ok(ur) => ur_out(&ur),
            Err(e) => ur_err(&e),
        },
        "urDecode" => match UR::from_ur_string(str_of(r, "s")?) {
            Ok(ur) => ur_out(&ur),
            Err(e) => ur_err(&e),
        },
        "mpEncode" => match mp_encode(r, r["parts"].as_u64()? as usize)? {
            Ok(parts) => parts.join(" "),
            Err(e) => ur_err(&e),
        },
        "fountainDecode" => {
            let part = &r["part"];
            let cbor = part_cbor(&part["fields"], &bytes(&part["data"])?, false)?;
            match minicbor::decode::<ur::fountain::Part>(&cbor) {
                Ok(p) => {
                    let (a, b, c, d, data) = part_fields(&p)?;
                    format!("part:{a}-{b}-{c}-{d}-{}", hex::encode(data))
                }
                Err(e) => fountain_err(e),
            }
        }
        "fountainAdd" => {
            let parts = r["parts"].as_array()?;
            let mut d = ur::fountain::Decoder::default();
            let mut added = Vec::new();
            for p in parts {
                let cbor = part_cbor(&p["fields"], &bytes(&p["data"])?, true)?;
                let part: ur::fountain::Part = match minicbor::decode(&cbor) {
                    Ok(part) => part,
                    Err(e) => return Some(fountain_err(e)),
                };
                match d.receive(part) {
                    Ok(b) => added.push(b.to_string()),
                    Err(e) => return Some(fountain_err(e)),
                }
            }
            let result = match d.message() {
                Ok(None) => "undefined".to_string(),
                Ok(Some(v)) => hex::encode(v),
                Err(e) => return Some(fountain_err(e)),
            };
            format!("added={} done={} result={result}", added.join(","), d.complete())
        }
        "mpDecode" => {
            let parts: Vec<String> = if let Some(p) = r.get("parts") {
                strs(p)?
            } else {
                match mp_encode(&r["from"], r["from"]["parts"].as_u64()? as usize)? {
                    Ok(p) => order(p, &r["order"], r.get("drop").and_then(|d| d.as_u64()).unwrap_or(0))?,
                    Err(e) => return Some(ur_err(&e)),
                }
            };
            let mut d = MultipartDecoder::new();
            let mut n = 0;
            for p in &parts {
                n += 1;
                if let Err(e) = d.receive(p) {
                    return Some(ur_err(&e));
                }
                if d.is_complete() {
                    return Some(match d.message() {
                        Ok(Some(ur)) => format!("done@{n}:{}", ur_out(&ur)),
                        Ok(None) => format!("incomplete:{n}"),
                        Err(e) => ur_err(&e),
                    });
                }
            }
            format!("incomplete:{n}")
        }
        "mpScan" => {
            let parts = strs(&r["parts"])?;
            let mut d = MultipartDecoder::new();
            let steps: Vec<String> = parts
                .iter()
                .map(|p| {
                    let recv = match d.receive(p) {
                        Ok(()) => "ok".to_string(),
                        Err(e) => ur_err(&e),
                    };
                    let complete = d.is_complete();
                    let message = match d.message() {
                        Ok(None) => "none".to_string(),
                        Ok(Some(u)) => ur_out(&u),
                        Err(e) => ur_err(&e),
                    };
                    format!("{recv},{complete},{message}")
                })
                .collect();
            steps.join(" ; ")
        }
        "fountainScan" => {
            let parts = strs(&r["parts"])?;
            let mut d = ur::fountain::Decoder::default();
            let mut steps = Vec::new();
            for h in &parts {
                let b = hex::decode(h).ok()?;
                match minicbor::decode::<ur::fountain::Part>(&b) {
                    Err(e) => steps.push(format!("decode-{}", fountain_err(e))),
                    Ok(p) => {
                        let recv = match d.receive(p) {
                            Ok(added) => format!("ok:{added}"),
                            Err(e) => fountain_err(e),
                        };
                        let complete = d.complete();
                        let message = match d.message() {
                            Ok(None) => "none".to_string(),
                            Ok(Some(v)) => hex::encode(v),
                            Err(e) => fountain_err(e),
                        };
                        steps.push(format!("{recv},{complete},{message}"));
                    }
                }
            }
            steps.join(" ; ")
        }
        "fountainDecodeHex" => {
            let b = hex::decode(str_of(r, "hex")?).ok()?;
            match minicbor::decode::<ur::fountain::Part>(&b) {
                Ok(p) => match minicbor::to_vec(&p) {
                    Ok(v) => format!("part:{}", hex::encode(v)),
                    Err(e) => fountain_err(e),
                },
                Err(e) => fountain_err(e),
            }
        }
        "mpDecodeFrom" => {
            let from = &r["from"];
            let ur = match ur_of(str_of(from, "type")?, &bytes(&from["cbor"])?) {
                Ok(u) => u,
                Err(e) => return Some(ur_err(&e)),
            };
            let max = usize_of(&from["maxLen"])??;
            let skip = r["skipBefore"].as_u64()? as usize;
            let mut e = match MultipartEncoder::new(&ur, max) {
                Ok(e) => e,
                Err(e) => return Some(ur_err(&e)),
            };
            let mut d = MultipartDecoder::new();
            let mut n = 0usize;
            for _ in 0..1000 {
                let p = match e.next_part() {
                    Ok(p) => p,
                    Err(e) => return Some(ur_err(&e)),
                };
                n += 1;
                if e.current_index() >= skip {
                    if let Err(x) = d.receive(&p) {
                        return Some(ur_err(&x));
                    }
                }
                if d.is_complete() {
                    return Some(match d.message() {
                        Ok(Some(u)) => format!("done@{}:{}", e.current_index(), ur_out(&u)),
                        Ok(None) => format!("incomplete:{n}"),
                        Err(x) => ur_err(&x),
                    });
                }
            }
            format!("incomplete:{n}")
        }
        "urCheckType" => match UR::from_ur_string(str_of(r, "s")?) {
            Err(e) => ur_err(&e),
            Ok(ur) => match ur.check_type(str_of(r, "type")?) {
                Ok(()) => "ok".into(),
                Err(e) => ur_err(&e),
            },
        },
        "urFor" => {
            set_tags(&r["tags"])?;
            let content = CBOR::try_from_data(bytes(&r["content"])?).ok()?;
            Probe(content).ur_string()
        }
        "decodeURWith" => {
            set_tags(&r["tags"])?;
            match UR::from_ur_string(str_of(r, "s")?) {
                Err(e) => ur_err(&e),
                Ok(ur) => match Probe::from_ur(ur) {
                    Ok(v) => hex::encode(v.0.to_cbor_data()),
                    Err(e) => cbor_err(&e),
                },
            }
        }
        _ => return None,
    })
}

fn panic_mapped(r: &Value, expect: &str) -> bool {
    let k = r["k"].as_str().unwrap_or("");
    let code = expect.strip_prefix("throw:").and_then(|s| s.split('|').next()).unwrap_or("");
    PANIC_MAPPED.contains(&(k, code))
}

fn clip(s: &str, n: usize) -> &str {
    let mut end = s.len().min(n);
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

fn main() {
    assert_eq!(usize::BITS, 64, "the harness compares 64-bit usize values");
    std::panic::set_hook(Box::new(|_| {}));
    let path = std::env::args().nth(1).expect("usage: ur-validation <vectors.json>");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        eprintln!("cannot read {path}: {e}");
        std::process::exit(2)
    });
    let file: File = serde_json::from_str(&text).unwrap_or_else(|e| {
        eprintln!("cannot parse {path}: {e}");
        std::process::exit(2)
    });
    if file.count != file.vectors.len() {
        eprintln!("count {} does not match {} vectors", file.count, file.vectors.len());
        std::process::exit(2);
    }
    let (mut ok, mut panics, mut js_only, mut mismatch, mut unparsable) = (0, 0, 0, 0, 0);
    for v in &file.vectors {
        match classify(&v.recipe) {
            Class::JsOnly => {
                js_only += 1;
                continue;
            }
            Class::Unparsable => {
                unparsable += 1;
                eprintln!("unparsable {}", v.name);
                continue;
            }
            Class::Compare => {}
        }
        let got = match run(&v.recipe) {
            Out::Value(s) => s,
            Out::Panic => "throw:panic".to_string(),
            Out::Unparsable => {
                unparsable += 1;
                eprintln!("unparsable {}", v.name);
                continue;
            }
        };
        if got == v.expect {
            ok += 1;
            continue;
        }
        if got == "throw:panic" && panic_mapped(&v.recipe, &v.expect) {
            panics += 1;
            continue;
        }
        mismatch += 1;
        eprintln!(
            "MISMATCH {}\n  rust: {}\n  ts:   {}",
            v.name,
            clip(&got, 200),
            clip(&v.expect, 200)
        );
    }
    let mut line = format!(
        "{} vectors - {ok} match, {panics} panic-mapped, {js_only} js-only, {mismatch} MISMATCH",
        file.vectors.len()
    );
    if unparsable > 0 {
        line.push_str(&format!(", {unparsable} unparsable"));
    }
    println!("{line}");
    std::process::exit(if mismatch == 0 && unparsable == 0 { 0 } else { 1 });
}
