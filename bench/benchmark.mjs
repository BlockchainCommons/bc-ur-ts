/**
 * Baseline vs working tree micro-benchmarks (Phase 2.3).
 *
 *   bun run build && bun bench/benchmark.mjs
 */
import * as baseline from "../tests/baseline/uniform-resources-baseline.mjs";
import * as current from "../dist/index.mjs";
import * as bw from "../dist/bytewords.mjs";
import { decodeCbor } from "@blockchaincommons/dcbor";

const msg = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7 + 3) & 0xff);
const big = Uint8Array.from({ length: 65536 }, (_, i) => (i * 13 + 5) & 0xff);
const cborHex = "5910" + "00" + Buffer.from(msg).toString("hex");
const cborBytes = Uint8Array.from(Buffer.from(cborHex, "hex"));
const urString = "ur:bytes/" + baseline.encodeBytewords(cborBytes, "minimal");
const bUr = baseline.UR.fromURString(urString);
const cUr = current.UR.from("bytes", decodeCbor(cborBytes));
const bigMinimal = baseline.encodeBytewords(big, "minimal");

function time(fn, iters = 5) {
  fn();
  let best = Infinity;
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}
const partsOf = (make, n) => { const e = make(); const out = []; for (let i = 0; i < n; i++) out.push(e.nextPart()); return out; };
const bParts = partsOf(() => new baseline.MultipartEncoder(bUr, 100), 120);
const cParts = partsOf(() => new current.MultipartEncoder(cUr, 100), 120);

const cases = {
  "multipart encode 4 KiB @100, 120 parts": [
    () => partsOf(() => new baseline.MultipartEncoder(bUr, 100), 120),
    () => partsOf(() => new current.MultipartEncoder(cUr, 100), 120),
  ],
  "multipart decode 4 KiB @100 (reverse)": [
    () => { const d = new baseline.MultipartDecoder(); for (const p of [...bParts].reverse()) { d.receive(p); if (d.isComplete()) break; } },
    () => { const d = new current.MultipartDecoder(); for (const p of [...cParts].reverse()) { d.add(p); if (d.done) break; } },
  ],
  "bytewords minimal encode 64 KiB": [() => baseline.encodeBytewords(big, "minimal"), () => bw.encodeBytewords(big, "minimal")],
  "bytewords minimal decode 64 KiB": [() => baseline.decodeBytewords(bigMinimal, "minimal"), () => bw.decodeBytewords(bigMinimal, "minimal")],
  "UR parse 4 KiB ×50": [() => { for (let i = 0; i < 50; i++) baseline.UR.fromURString(urString); }, () => { for (let i = 0; i < 50; i++) current.UR.parse(urString); }],
};

console.log(`${"case".padEnd(40)} ${"baseline".padStart(10)} ${"current".padStart(10)} ${"speedup".padStart(8)}`);
for (const [name, [b, c]] of Object.entries(cases)) {
  const tb = time(b), tc = time(c);
  console.log(`${name.padEnd(40)} ${tb.toFixed(1).padStart(8)}ms ${tc.toFixed(1).padStart(8)}ms ${(tb / tc).toFixed(2).padStart(7)}×`);
}
