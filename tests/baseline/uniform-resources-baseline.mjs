//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region ../bc-dcbor-compat-ts/node_modules/@blockchaincommons/dcbor/dist/error-BXLcx8Bl.mjs
const MajorType$1 = {
	Unsigned: 0,
	Negative: 1,
	ByteString: 2,
	Text: 3,
	Array: 4,
	Map: 5,
	Tagged: 6,
	Simple: 7
};
const isCborNumber$1 = (value) => {
	return typeof value === "number" || typeof value === "bigint";
};
const isCbor$1 = (value) => {
	return value !== null && typeof value === "object" && "isCbor" in value && value.isCbor === true;
};
/**
* Compare two tag values for equality, normalizing `number` vs `bigint`.
* A raw `===` would treat `100n` and `100` as unequal, so a large tag that
* decoded to a `bigint` wouldn't match the same value written as a `number`.
*
* @internal Exported for cross-module use; not part of the public surface -
* use `Tag.equals` instead.
*/
const tagValuesEqual$1 = (a, b) => {
	if (typeof a === "bigint" || typeof b === "bigint") return BigInt(a) === BigInt(b);
	return a === b;
};
/**
* Value-type companion for the `Tag` interface: an interface plus a merged
* `const` with a handful of members. It stays small and must not import the
* encode/format graph.
*/
const Tag = {
	/**
	* Create a Tag from its numeric value, optionally with a name.
	*
	* ```typescript
	* Tag.from(1, "date");
	* Tag.from(12345);
	* ```
	*/
	from(value, name) {
		if (name !== void 0) return {
			value,
			name
		};
		return { value };
	},
	/**
	* Compare two tags for equality: compares by `value` only (normalizing
	* `number` vs `bigint`) and ignores the optional `name`.
	*/
	equals(a, b) {
		return tagValuesEqual$1(a.value, b.value);
	}
};
/**
* Get the string representation of a tag.
* Internal function used for error messages.
*
* @param tag - The tag to represent
* @returns String representation (name if available, otherwise value)
*
* @internal
*/
const tagToString$1 = (tag) => tag.name ?? tag.value.toString();
const captureStackTrace = Error.captureStackTrace;
/**
* The single error type thrown by dCBOR encoding, decoding, and extraction.
*
* @example
* ```typescript
* try {
*   decodeCbor(bytes);
* } catch (e) {
*   if (CborError.isCborError(e) && e.code === "WrongTag") {
*     console.log(e.details.expectedTag, e.details.actualTag);
*   }
* }
* ```
*/
var CborError$1 = class CborError extends Error {
	/** Machine-readable discriminant; switch on this to handle errors. */
	code;
	/** Structured, code-specific data (see {@link CborErrorDetails}). */
	details;
	constructor(code, message, details = {}) {
		super(message);
		this.name = "CborError";
		this.code = code;
		this.details = details;
		Object.setPrototypeOf(this, new.target.prototype);
		if (typeof captureStackTrace === "function") captureStackTrace(this, CborError);
	}
	/** Type guard: is `value` a {@link CborError}? Narrows to the
	* code-discriminated {@link CborErrorTyped} union. */
	static isCborError(value) {
		return value instanceof CborError;
	}
	/** The CBOR data ended before a complete item could be decoded. */
	static underrun() {
		return new CborError("Underrun", "early end of CBOR data");
	}
	/** An unsupported/invalid value was found in a CBOR header byte. */
	static unsupportedHeaderValue(headerValue) {
		return new CborError("UnsupportedHeaderValue", "unsupported value in CBOR header", { headerValue });
	}
	/** A numeric value was not in its shortest/canonical dCBOR form. */
	static nonCanonicalNumeric() {
		return new CborError("NonCanonicalNumeric", "a CBOR numeric value was encoded in non-canonical form");
	}
	/** A major-type-7 simple value other than false/true/null/float. */
	static invalidSimpleValue() {
		return new CborError("InvalidSimpleValue", "an invalid CBOR simple value was encountered");
	}
	/** A text string was not valid UTF-8 (with the underlying reason). */
	static invalidString(cause) {
		return new CborError("InvalidString", `an invalidly-encoded UTF-8 string was encountered in the CBOR (${cause})`, { cause });
	}
	/** A text string was not in Unicode NFC. */
	static nonCanonicalString() {
		return new CborError("NonCanonicalString", "a CBOR string was not encoded in Unicode Canonical Normalization Form C");
	}
	/** The decoded item left `count` trailing bytes unconsumed. */
	static unusedData(count) {
		return new CborError("UnusedData", `the decoded CBOR had ${count} extra bytes at the end`, { count });
	}
	/** Map keys were not in canonical ascending byte order. */
	static misorderedMapKey() {
		return new CborError("MisorderedMapKey", "the decoded CBOR map has keys that are not in canonical order");
	}
	/** A map contained a duplicate key. */
	static duplicateMapKey() {
		return new CborError("DuplicateMapKey", "the decoded CBOR map has a duplicate key");
	}
	/** A requested map key was not present. */
	static missingMapKey() {
		return new CborError("MissingMapKey", "missing CBOR map key");
	}
	/** A numeric value could not be represented in the target type. */
	static outOfRange() {
		return new CborError("OutOfRange", "the CBOR numeric value could not be represented in the specified numeric type");
	}
	/** The CBOR value was not the type expected by a conversion. */
	static wrongType() {
		return new CborError("WrongType", "the decoded CBOR value was not the expected type");
	}
	/** A tagged value had a tag other than the one expected. */
	static wrongTag(expected, actual) {
		return new CborError("WrongTag", `expected CBOR tag ${tagToString$1(expected)}, but got ${tagToString$1(actual)}`, {
			expectedTag: expected,
			actualTag: actual
		});
	}
	/** Invalid UTF-8 in a text string (with the underlying reason). */
	static invalidUtf8(cause) {
		return new CborError("InvalidUtf8", `invalid UTF‑8 string: ${cause}`, { cause });
	}
	/** Invalid ISO 8601 / RFC 3339 date string (with the underlying reason). */
	static invalidDate(cause) {
		return new CborError("InvalidDate", `invalid ISO 8601 date string: ${cause}`, { cause });
	}
	/** An arbitrary error carrying a custom message. */
	static custom(message) {
		return new CborError("Custom", message);
	}
};
//#endregion
//#region ../bc-dcbor-compat-ts/node_modules/@blockchaincommons/dcbor/dist/tags-store-BZjfminT.mjs
/**
* Byte-array utilities shared across the library.
*
* @module stdlib
*/
/**
* Check if two byte arrays are equal.
*/
const areBytesEqual = (a, b) => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
};
/**
* Lexicographically compare two byte arrays.
* Returns: -1 if a < b, 0 if a == b, 1 if a > b
*/
const lexicographicallyCompareBytes = (a, b) => {
	const minLen = Math.min(a.length, b.length);
	for (let i = 0; i < minLen; i++) {
		const aVal = a[i];
		const bVal = b[i];
		if (aVal === void 0 || bVal === void 0) throw CborError$1.custom("Unexpected undefined byte in array");
		if (aVal < bVal) return -1;
		if (aVal > bVal) return 1;
	}
	if (a.length < b.length) return -1;
	if (a.length > b.length) return 1;
	return 0;
};
/**
* A map keyed by encoded CBOR key bytes, kept in canonical (lexicographic)
* byte order.
*
* dCBOR needs exactly one specialised container: keys are the encoded bytes of
* a CBOR value, and the map must iterate in ascending lexicographic byte order
* (that ordering is the deterministic wire contract). This is a thin,
* dependency-free structure over a sorted array with binary-search insertion -
* it gives the exact ordering dCBOR requires, and lets the decode hot path
* append in O(1) since canonical input already arrives sorted.
*
* @module sorted-byte-map
*/
var SortedByteMap = class {
	items = [];
	/** Number of entries. */
	get size() {
		return this.items.length;
	}
	/**
	* Binary search for `key`. Returns the index of an exact match, or the
	* negative value `-(insertionPoint) - 1` when absent, so a single search both
	* tests membership and locates where an insert would go (Java
	* `Arrays.binarySearch` convention).
	*/
	indexOf(key) {
		let lo = 0;
		let hi = this.items.length - 1;
		while (lo <= hi) {
			const mid = lo + hi >>> 1;
			const cmp = lexicographicallyCompareBytes(this.items[mid].key, key);
			if (cmp < 0) lo = mid + 1;
			else if (cmp > 0) hi = mid - 1;
			else return mid;
		}
		return -(lo + 1);
	}
	/** Insert or replace the entry for `key`. */
	set(key, value) {
		const i = this.indexOf(key);
		if (i >= 0) this.items[i] = {
			key,
			value
		};
		else this.items.splice(-i - 1, 0, {
			key,
			value
		});
	}
	/**
	* Append an entry whose key is strictly greater than every existing key.
	* Used by canonical decode, where keys arrive already sorted; the caller must
	* guarantee the ordering (this skips the search + shift that {@link set} does).
	*/
	appendGreatest(key, value) {
		this.items.push({
			key,
			value
		});
	}
	/** The value for `key`, or `undefined` if absent. */
	get(key) {
		const i = this.indexOf(key);
		return i >= 0 ? this.items[i].value : void 0;
	}
	/** Whether `key` is present. */
	has(key) {
		return this.indexOf(key) >= 0;
	}
	/** Remove `key`; returns whether it was present. */
	delete(key) {
		const i = this.indexOf(key);
		if (i < 0) return false;
		this.items.splice(i, 1);
		return true;
	}
	/** The greatest key currently stored (ascending order), or `undefined`. */
	maxKey() {
		const n = this.items.length;
		return n > 0 ? this.items[n - 1].key : void 0;
	}
	/** Map over each value (with its key) in ascending key order. */
	map(fn) {
		return this.items.map((e) => fn(e.value, e.key));
	}
};
/**
* Numeric boundary contract and helpers.
*
* ## The `number` / `bigint` contract
*
* dCBOR integers span `[-(2^64), 2^64)`, which exceeds JavaScript's safe
* integer range (`±(2^53 − 1)`). The single, repo-wide rule is:
*
* - An integer that fits in the IEEE-754 **safe** range is represented as a
*   `number`; anything larger (in magnitude) is a `bigint`.
* - Decoding returns the **narrowest exact** representation via
*   {@link narrowInteger}, so small values are ergonomic `number`s and large
*   ones remain lossless `bigint`s.
* - Encoding accepts either at the public edge and normalises once.
*
* Every module funnels its boundary logic through this file - nothing else
* should hard-code `Number.MAX_SAFE_INTEGER`, `2^64`, etc.
*
* @module numeric
*/
/** `BigInt(Number.MAX_SAFE_INTEGER)` - largest integer exact as a `number`. */
const SAFE_MAX_BIG = BigInt(Number.MAX_SAFE_INTEGER);
/** `BigInt(Number.MIN_SAFE_INTEGER)`. */
const SAFE_MIN_BIG = BigInt(Number.MIN_SAFE_INTEGER);
/** Smallest dCBOR-encodable integer: −(2^64). */
const CBOR_INT_MIN = -(1n << 64n);
/**
* Return the narrowest exact representation of an integer: a `number` when it
* fits the safe-integer range, otherwise the `bigint` unchanged. This is the
* canonical way to hand an integer back to callers.
*/
const narrowInteger = (value) => value >= SAFE_MIN_BIG && value <= SAFE_MAX_BIG ? Number(value) : value;
/**
* A growable output buffer for encoding.
*
* The encoder writes a whole CBOR tree into a single `BufWriter` rather than
* allocating a fresh `Uint8Array` per node and concatenating them (which
* re-copies every subtree at every level): one buffer, geometric growth, one
* final right-sized copy.
*
* @module buf-writer
*/
var BufWriter = class {
	buf;
	view;
	pos = 0;
	constructor(initialCapacity = 64) {
		this.buf = new Uint8Array(initialCapacity);
		this.view = new DataView(this.buf.buffer);
	}
	/** Number of bytes written so far. */
	get length() {
		return this.pos;
	}
	/** Grow the backing store so at least `extra` more bytes fit. */
	ensure(extra) {
		const needed = this.pos + extra;
		if (needed <= this.buf.length) return;
		let capacity = this.buf.length * 2;
		while (capacity < needed) capacity *= 2;
		const next = new Uint8Array(capacity);
		next.set(this.buf.subarray(0, this.pos));
		this.buf = next;
		this.view = new DataView(next.buffer);
	}
	writeByte(byte) {
		this.ensure(1);
		this.buf[this.pos] = byte;
		this.pos += 1;
	}
	writeUint16(value) {
		this.ensure(2);
		this.view.setUint16(this.pos, value, false);
		this.pos += 2;
	}
	writeUint32(value) {
		this.ensure(4);
		this.view.setUint32(this.pos, value, false);
		this.pos += 4;
	}
	writeBigUint64(value) {
		this.ensure(8);
		this.view.setBigUint64(this.pos, value, false);
		this.pos += 8;
	}
	writeBytes(bytes) {
		this.ensure(bytes.length);
		this.buf.set(bytes, this.pos);
		this.pos += bytes.length;
	}
	/** Return the written region as a right-sized copy. */
	toBytes() {
		return this.buf.slice(0, this.pos);
	}
};
const typeBits = (t) => {
	return t << 5;
};
/**
* Write a CBOR head (major type + argument) straight into `writer`, avoiding
* the intermediate `Uint8Array` that {@link encodeVarInt} allocates. This is
* the encoder hot path (every node emits a head). It MUST stay byte-identical
* to {@link encodeVarInt}; the golden vectors cover both.
*/
const writeVarInt = (writer, value, majorType) => {
	if (value < 0) throw CborError$1.outOfRange();
	if (typeof value === "number" && hasFractionalPart(value)) throw CborError$1.outOfRange();
	const type = typeBits(majorType);
	if (isCborNumber$1(value) && value <= Number.MAX_SAFE_INTEGER) {
		const n = Number(value);
		if (n <= 23) writer.writeByte(n | type);
		else if (n <= 255) {
			writer.writeByte(24 | type);
			writer.writeByte(n);
		} else if (n <= 65535) {
			writer.writeByte(25 | type);
			writer.writeUint16(n);
		} else if (n <= 4294967295) {
			writer.writeByte(26 | type);
			writer.writeUint32(n);
		} else {
			writer.writeByte(27 | type);
			writer.writeBigUint64(BigInt(n));
		}
	} else {
		const big = BigInt(value);
		if (big > 18446744073709551615n) throw CborError$1.outOfRange();
		writer.writeByte(27 | type);
		writer.writeBigUint64(big);
	}
};
const encodeVarInt = (value, majorType) => {
	if (value < 0) throw CborError$1.outOfRange();
	if (typeof value === "number" && hasFractionalPart(value)) throw CborError$1.outOfRange();
	const type = typeBits(majorType);
	if (isCborNumber$1(value) && value <= Number.MAX_SAFE_INTEGER) {
		value = Number(value);
		if (value <= 23) return new Uint8Array([value | type]);
		else if (value <= 255) return new Uint8Array([24 | type, value]);
		else if (value <= 65535) {
			const buffer = /* @__PURE__ */ new ArrayBuffer(3);
			const view = new DataView(buffer);
			view.setUint8(0, 25 | type);
			view.setUint16(1, value);
			return new Uint8Array(buffer);
		} else if (value <= 4294967295) {
			const buffer = /* @__PURE__ */ new ArrayBuffer(5);
			const view = new DataView(buffer);
			view.setUint8(0, 26 | type);
			view.setUint32(1, value);
			return new Uint8Array(buffer);
		} else {
			const buffer = /* @__PURE__ */ new ArrayBuffer(9);
			const view = new DataView(buffer);
			view.setUint8(0, 27 | type);
			view.setBigUint64(1, BigInt(value));
			return new Uint8Array(buffer);
		}
	} else {
		const big = BigInt(value);
		if (big > 18446744073709551615n) throw CborError$1.outOfRange();
		const buffer = /* @__PURE__ */ new ArrayBuffer(9);
		const view = new DataView(buffer);
		view.setUint8(0, 27 | type);
		view.setBigUint64(1, big);
		return new Uint8Array(buffer);
	}
};
const hasFract = (n) => {
	return n % 1 !== 0;
};
/**
* Shared float→integer exactness gate for every `Exact<Int>.exactFromF*`. A
* float is an exact integer of a width iff it is finite, whole, and inside that
* width's exclusive `(loEx, hiEx)` bounds (use ±Infinity to skip a side). The
* bounds encode the per-width / per-source-precision limits. The three typed
* wrappers below shape the truncated result.
*/
const isExactIntFloat = (source, loEx, hiEx) => Number.isFinite(source) && source > loEx && source < hiEx && !hasFract(source);
/** float → small integer (`number`). */
const intFromFloatNum = (source, loEx, hiEx) => isExactIntFloat(source, loEx, hiEx) ? Math.trunc(source) : void 0;
/** float → 64-bit integer (`number` if safe, else `bigint`). */
const intFromFloatNarrow = (source, loEx, hiEx) => isExactIntFloat(source, loEx, hiEx) ? narrowInteger(BigInt(Math.trunc(source))) : void 0;
/** float → 128-bit integer (`bigint`). */
const intFromFloatBig = (source, loEx, hiEx) => isExactIntFloat(source, loEx, hiEx) ? BigInt(Math.trunc(source)) : void 0;
/**
* Exact conversions for i128 (JavaScript bigint).
*/
var ExactI128 = class {
	static MIN = -(2n ** 127n);
	static MAX = 2n ** 127n - 1n;
	static exactFromF16(source) {
		return intFromFloatBig(source, -Infinity, Infinity);
	}
	static exactFromF32(source) {
		return intFromFloatBig(source, -Infinity, Infinity);
	}
	static exactFromF64(source) {
		return intFromFloatBig(source, -Infinity, Infinity);
	}
	static exactFromU64(source) {
		return BigInt(source);
	}
	static exactFromI64(source) {
		return BigInt(source);
	}
	static exactFromU128(source) {
		if (source > 2n ** 127n - 1n) return void 0;
		return source;
	}
	static exactFromI128(source) {
		return source;
	}
};
/**
* Exact conversions for u16 (0 to 65535).
*/
var ExactU16 = class {
	static MIN = 0;
	static MAX = 65535;
	static exactFromF16(source) {
		return intFromFloatNum(source, -1, Infinity);
	}
	static exactFromF32(source) {
		return intFromFloatNum(source, -1, 65536);
	}
	static exactFromF64(source) {
		return intFromFloatNum(source, -1, 65536);
	}
	static exactFromU64(source) {
		const n = typeof source === "bigint" ? Number(source) : source;
		if (n > 65535) return void 0;
		return n;
	}
	static exactFromI64(source) {
		const n = typeof source === "bigint" ? Number(source) : source;
		if (n < 0 || n > 65535) return void 0;
		return n;
	}
	static exactFromU128(source) {
		if (source > 65535n) return void 0;
		return Number(source);
	}
	static exactFromI128(source) {
		if (source < 0n || source > 65535n) return void 0;
		return Number(source);
	}
};
/**
* Exact conversions for u32 (0 to 4294967295).
*/
var ExactU32 = class {
	static MIN = 0;
	static MAX = 4294967295;
	static exactFromF16(source) {
		return intFromFloatNum(source, -1, Infinity);
	}
	static exactFromF32(source) {
		return intFromFloatNum(source, -1, 4294967296);
	}
	static exactFromF64(source) {
		return intFromFloatNum(source, -1, 4294967296);
	}
	static exactFromU64(source) {
		const n = typeof source === "bigint" ? Number(source) : source;
		if (n > 4294967295) return void 0;
		return n;
	}
	static exactFromI64(source) {
		const n = typeof source === "bigint" ? Number(source) : source;
		if (n < 0 || n > 4294967295) return void 0;
		return n;
	}
	static exactFromU128(source) {
		if (source > 4294967295n) return void 0;
		return Number(source);
	}
	static exactFromI128(source) {
		if (source < 0n || source > 4294967295n) return void 0;
		return Number(source);
	}
};
/**
* Exact conversions for u64 (0 to 18446744073709551615).
*/
var ExactU64 = class {
	static MIN = 0n;
	static MAX = 18446744073709551615n;
	static exactFromF16(source) {
		return intFromFloatNarrow(source, -1, Infinity);
	}
	static exactFromF32(source) {
		return intFromFloatNarrow(source, -1, 0x10000000000000000);
	}
	static exactFromF64(source) {
		return intFromFloatNarrow(source, -1, 0x10000000000000000);
	}
	static exactFromU64(source) {
		return source;
	}
	static exactFromI64(source) {
		if ((typeof source === "bigint" ? source : BigInt(source)) < 0n) return void 0;
		return source;
	}
	static exactFromU128(source) {
		if (source > 18446744073709551615n) return void 0;
		return narrowInteger(source);
	}
	static exactFromI128(source) {
		if (source < 0n || source > 18446744073709551615n) return void 0;
		return narrowInteger(source);
	}
};
/**
* Float encoding and conversion utilities for dCBOR.
*
* # Floating Point Number Support in dCBOR
*
* dCBOR provides canonical encoding for floating point values.
*
* Per the dCBOR specification, the canonical encoding rules ensure
* deterministic representation:
*
* - Numeric reduction: Floating point values with zero fractional part in
*   range [-2^63, 2^64-1] are automatically encoded as integers (e.g., 42.0
*   becomes 42)
* - Values are encoded in the smallest possible representation that preserves
*   their value
* - All NaN values are canonicalized to a single representation: 0xf97e00
* - Positive/negative infinity are canonicalized to half-precision
*   representations
*
* @module float
*/
/**
* Canonical NaN representation in CBOR: 0xf97e00
*/
const CBOR_NAN = new Uint8Array([
	249,
	126,
	0
]);
/**
* Check if a number has a fractional part.
*/
const hasFractionalPart = (n) => n !== Math.floor(n);
/**
* Read a big-endian IEEE-754 double from the first 8 bytes of `data`.
* @internal
*/
const binary64ToNumber = (data) => new DataView(data.buffer, data.byteOffset, data.byteLength).getFloat64(0, false);
/**
* Encode a number as 4 big-endian bytes of an IEEE-754 single (f32).
*/
const numberToBinary32 = (n) => {
	const data = /* @__PURE__ */ new Uint8Array(4);
	new DataView(data.buffer).setFloat32(0, n, false);
	return data;
};
/**
* Read a big-endian IEEE-754 single (f32) from the first 4 bytes of `data`.
*/
const binary32ToNumber = (data) => new DataView(data.buffer, data.byteOffset, data.byteLength).getFloat32(0, false);
const f32ScratchView = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4));
/**
* Compute the 16-bit pattern of the IEEE-754 half-precision value nearest `n`,
* rounding ties to even.
*
* All call sites pass values already exactly representable in binary16 (the
* reduction gates in {@link f16CborData} ensure this), so no rounding occurs on
* a value that is actually stored; the rounding path exists only so the
* reduction round-trip probe (`binary16ToNumber(numberToBinary16(n)) === n`)
* answers correctly for non-representable inputs.
*/
const float16Bits = (n) => {
	f32ScratchView.setFloat32(0, n, false);
	const f = f32ScratchView.getUint32(0, false);
	const sign = f >>> 16 & 32768;
	const exp = f >>> 23 & 255;
	const mant = f & 8388607;
	if (exp === 255) return sign | (mant !== 0 ? 32256 : 31744);
	const e = exp - 127 + 15;
	if (e >= 31) return sign | 31744;
	if (e <= 0) {
		if (e < -10) return sign;
		const significand = mant | 8388608;
		const shift = 14 - e;
		let result = significand >>> shift;
		const remainder = significand & (1 << shift) - 1;
		const halfway = 1 << shift - 1;
		if (remainder > halfway || remainder === halfway && (result & 1) === 1) result += 1;
		return sign | result;
	}
	let fraction = mant >>> 13;
	const remainder = mant & 8191;
	let exponent = e;
	if (remainder > 4096 || remainder === 4096 && (fraction & 1) === 1) {
		fraction += 1;
		if (fraction === 1024) {
			fraction = 0;
			exponent += 1;
			if (exponent >= 31) return sign | 31744;
		}
	}
	return sign | exponent << 10 | fraction;
};
/**
* Encode a number as 2 big-endian bytes of an IEEE-754 half (f16).
*/
const numberToBinary16 = (n) => {
	const bits = float16Bits(n);
	return new Uint8Array([bits >> 8 & 255, bits & 255]);
};
/**
* Read a big-endian IEEE-754 half (f16) from the first 2 bytes of `data`.
*/
const binary16ToNumber = (data) => {
	const bits = data[0] << 8 | data[1];
	const sign = (bits & 32768) !== 0 ? -1 : 1;
	const exponent = bits >> 10 & 31;
	const fraction = bits & 1023;
	if (exponent === 0) return sign * fraction * 2 ** -24;
	if (exponent === 31) return fraction !== 0 ? NaN : sign * Infinity;
	return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
};
/**
* Encode f64 value to CBOR data bytes.
* Implements numeric reduction and canonical encoding rules.
* @internal
*/
const f64CborData = (value) => {
	const n = value;
	const f32Bytes = numberToBinary32(n);
	const f = binary32ToNumber(f32Bytes);
	if (f === n) return f32CborData(f);
	if (n < 0) {
		const i128 = ExactI128.exactFromF64(n);
		if (i128 !== void 0) {
			const i = ExactU64.exactFromI128(-1n - i128);
			if (i !== void 0) return encodeVarInt(i, MajorType$1.Negative);
		}
	}
	const u = ExactU64.exactFromF64(n);
	if (u !== void 0) return encodeVarInt(u, MajorType$1.Unsigned);
	if (Number.isNaN(value)) return CBOR_NAN;
	const buffer = /* @__PURE__ */ new ArrayBuffer(8);
	new DataView(buffer).setFloat64(0, n, false);
	const bytes = new Uint8Array(buffer);
	return new Uint8Array([251, ...bytes]);
};
/**
* Encode f32 value to CBOR data bytes.
* Implements numeric reduction and canonical encoding rules.
* @internal
*/
const f32CborData = (value) => {
	const n = value;
	const f16Bytes = numberToBinary16(n);
	const f = binary16ToNumber(f16Bytes);
	if (f === n) return f16CborData(f);
	if (n < 0) {
		const u = ExactU64.exactFromF32(Math.fround(-1 - n));
		if (u !== void 0) return encodeVarInt(u, MajorType$1.Negative);
	}
	const u = ExactU32.exactFromF32(n);
	if (u !== void 0) return encodeVarInt(u, MajorType$1.Unsigned);
	if (Number.isNaN(value)) return CBOR_NAN;
	const bytes = numberToBinary32(n);
	return new Uint8Array([250, ...bytes]);
};
/**
* Encode f16 value to CBOR data bytes.
* Implements numeric reduction and canonical encoding rules.
* @internal
*/
const f16CborData = (value) => {
	const n = value;
	if (n < 0) {
		const u = ExactU64.exactFromF64(-1 - n);
		if (u !== void 0) return encodeVarInt(u, MajorType$1.Negative);
	}
	const u = ExactU16.exactFromF64(n);
	if (u !== void 0) return encodeVarInt(u, MajorType$1.Unsigned);
	if (Number.isNaN(value)) return CBOR_NAN;
	const bytes = numberToBinary16(value);
	return new Uint8Array([249, ...bytes]);
};
/**
* Render a float to its diagnostic string.
*
* Finite non-zero values with magnitude in [1e-4, 1e16) print in decimal with
* at least one fractional digit (whole values get a trailing `.0`); everything
* else prints in exponential form. Zero prints as `0.0`/`-0.0`.
*
* JS already produces the same shortest round-tripping digits; we only fix up
* the notation threshold, the `e+` → `e` exponent, and the `.0` suffix.
*
* @param value - The float value
* @returns The diagnostic string
*/
const floatDisplayString = (value) => {
	if (Number.isNaN(value)) return "NaN";
	if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
	if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";
	const abs = Math.abs(value);
	if (abs >= 1e-4 && abs < 0x2386f26fc10000) {
		let str = String(value);
		if (!str.includes(".")) str = `${str}.0`;
		return str;
	}
	return value.toExponential().replace("e+", "e");
};
/**
* A forward-only cursor over the input bytes.
*
* Decoding advances a single `pos` through one shared `DataView` rather than
* slicing a fresh sub-view per nested item and threading a consumed-length back
* up the recursion. Every read is bounds-checked against the remaining bytes.
*/
var ByteReader = class {
	view;
	pos = 0;
	constructor(data) {
		this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	}
	get byteLength() {
		return this.view.byteLength;
	}
	get remaining() {
		return this.view.byteLength - this.pos;
	}
	/** Read the byte at `offset` relative to the current position (no advance). */
	peek(offset) {
		return this.view.getUint8(this.pos + offset);
	}
	/** Advance the cursor by `count` bytes. */
	advance(count) {
		this.pos += count;
	}
	/** A zero-copy view of `len` bytes at the given absolute offset. */
	bytesAt(offset, len) {
		return new Uint8Array(this.view.buffer, this.view.byteOffset + offset, len);
	}
};
/**
* Decode a single dCBOR item from `data`, enforcing every deterministic
* encoding rule (canonical numeric forms, NFC text, map-key order, no
* trailing bytes). Throws {@link CborError} on any violation.
*
* @example
* ```typescript
* const value = decodeCbor(hexToBytes("a1616101")); // {"a": 1}
* expectMap(value).size; // 1
* ```
*
* @throws {CborError} `Underrun` | `UnsupportedHeaderValue` |
*   `NonCanonicalNumeric` | `InvalidSimpleValue` | `InvalidUtf8` |
*   `NonCanonicalString` | `UnusedData` | `MisorderedMapKey` |
*   `DuplicateMapKey` - see {@link CborErrorDetailsByCode}.
* @public
*
* @remarks Decoded byte strings are zero-copy views aliasing the input
* buffer - mutating the input after decoding (or mutating the returned
* bytes) changes the other side. Call `.slice()` first if you need an
* independent copy. This is deliberate: the zero-copy decode performance
* profile is part of the library's contract.
*/
function decodeCbor$1(data) {
	const reader = new ByteReader(data);
	const cbor = readCbor(reader);
	const remaining = reader.byteLength - reader.pos;
	if (remaining !== 0) throw CborError$1.unusedData(remaining);
	return cbor;
}
function parseHeader(header) {
	return {
		majorType: header >> 5,
		headerValue: header & 31
	};
}
/**
* Read a CBOR head (major type + argument) at the cursor, advancing past it.
* `varIntLen` is the head length (1/2/3/5/9); the argument value is validated
* for canonical minimal-length encoding.
*/
function readHeaderVarint(reader) {
	if (reader.remaining < 1) throw CborError$1.underrun();
	const header = reader.peek(0);
	const { majorType, headerValue } = parseHeader(header);
	const dataRemaining = reader.remaining - 1;
	let value;
	let varIntLen;
	if (headerValue <= 23) {
		value = headerValue;
		varIntLen = 1;
	} else if (headerValue === 24) {
		if (dataRemaining < 1) throw CborError$1.underrun();
		value = reader.peek(1);
		if (value < 24) throw CborError$1.nonCanonicalNumeric();
		varIntLen = 2;
	} else if (headerValue === 25) {
		if (dataRemaining < 2) throw CborError$1.underrun();
		value = (reader.peek(1) << 8 | reader.peek(2)) >>> 0;
		if (value <= 255 && header !== 249) throw CborError$1.nonCanonicalNumeric();
		varIntLen = 3;
	} else if (headerValue === 26) {
		if (dataRemaining < 4) throw CborError$1.underrun();
		value = (reader.peek(1) << 24 | reader.peek(2) << 16 | reader.peek(3) << 8 | reader.peek(4)) >>> 0;
		if (value <= 65535 && header !== 250) throw CborError$1.nonCanonicalNumeric();
		varIntLen = 5;
	} else if (headerValue === 27) {
		if (dataRemaining < 8) throw CborError$1.underrun();
		const a = BigInt(reader.peek(1)) << 56n;
		const b = BigInt(reader.peek(2)) << 48n;
		const c = BigInt(reader.peek(3)) << 40n;
		const d = BigInt(reader.peek(4)) << 32n;
		const e = BigInt(reader.peek(5)) << 24n;
		const f = BigInt(reader.peek(6)) << 16n;
		const g = BigInt(reader.peek(7)) << 8n;
		const h = BigInt(reader.peek(8));
		value = narrowInteger(a | b | c | d | e | f | g | h);
		if (value <= 4294967295 && header !== 251) throw CborError$1.nonCanonicalNumeric();
		varIntLen = 9;
	} else throw CborError$1.unsupportedHeaderValue(headerValue);
	reader.advance(varIntLen);
	return {
		majorType,
		value,
		varIntLen
	};
}
function readCbor(reader) {
	if (reader.remaining < 1) throw CborError$1.underrun();
	const headStart = reader.pos;
	const { majorType, value, varIntLen } = readHeaderVarint(reader);
	switch (majorType) {
		case MajorType$1.Unsigned: {
			const cbor = attachMethods$1({
				isCbor: true,
				type: MajorType$1.Unsigned,
				value
			});
			checkCanonicalEncoding(cbor, reader.bytesAt(headStart, varIntLen));
			return cbor;
		}
		case MajorType$1.Negative: {
			const cbor = attachMethods$1({
				isCbor: true,
				type: MajorType$1.Negative,
				value
			});
			checkCanonicalEncoding(cbor, reader.bytesAt(headStart, varIntLen));
			return cbor;
		}
		case MajorType$1.ByteString: {
			if (typeof value === "bigint") throw CborError$1.underrun();
			if (reader.remaining < value) throw CborError$1.underrun();
			const bytes = reader.bytesAt(reader.pos, value);
			reader.advance(value);
			return attachMethods$1({
				isCbor: true,
				type: MajorType$1.ByteString,
				value: bytes
			});
		}
		case MajorType$1.Text: {
			if (typeof value === "bigint") throw CborError$1.underrun();
			if (reader.remaining < value) throw CborError$1.underrun();
			const textBytes = reader.bytesAt(reader.pos, value);
			reader.advance(value);
			let text;
			try {
				text = new TextDecoder("utf-8", { fatal: true }).decode(textBytes);
			} catch (e) {
				throw CborError$1.invalidUtf8(e instanceof Error ? e.message : String(e));
			}
			if (text.normalize("NFC") !== text) throw CborError$1.nonCanonicalString();
			return attachMethods$1({
				isCbor: true,
				type: MajorType$1.Text,
				value: text
			});
		}
		case MajorType$1.Array: {
			const items = [];
			for (let i = 0; i < value; i++) items.push(readCbor(reader));
			return attachMethods$1({
				isCbor: true,
				type: MajorType$1.Array,
				value: items
			});
		}
		case MajorType$1.Map: {
			const map = new CborMap$1();
			for (let i = 0; i < value; i++) {
				const key = readCbor(reader);
				const val = readCbor(reader);
				map.setNext(key, val);
			}
			return attachMethods$1({
				isCbor: true,
				type: MajorType$1.Map,
				value: map
			});
		}
		case MajorType$1.Tagged: {
			const item = readCbor(reader);
			return attachMethods$1({
				isCbor: true,
				type: MajorType$1.Tagged,
				tag: value,
				value: item
			});
		}
		case MajorType$1.Simple: switch (varIntLen) {
			case 3: {
				const f = binary16ToNumber(reader.bytesAt(headStart + 1, 2));
				checkCanonicalEncoding(f, reader.bytesAt(headStart, varIntLen));
				return attachMethods$1({
					isCbor: true,
					type: MajorType$1.Simple,
					value: {
						type: "Float",
						value: f
					}
				});
			}
			case 5: {
				const f = binary32ToNumber(reader.bytesAt(headStart + 1, 4));
				checkCanonicalEncoding(f, reader.bytesAt(headStart, varIntLen));
				return attachMethods$1({
					isCbor: true,
					type: MajorType$1.Simple,
					value: {
						type: "Float",
						value: f
					}
				});
			}
			case 9: {
				const f = binary64ToNumber(reader.bytesAt(headStart + 1, 8));
				checkCanonicalEncoding(f, reader.bytesAt(headStart, varIntLen));
				return attachMethods$1({
					isCbor: true,
					type: MajorType$1.Simple,
					value: {
						type: "Float",
						value: f
					}
				});
			}
			default: switch (value) {
				case 20: return attachMethods$1({
					isCbor: true,
					type: MajorType$1.Simple,
					value: { type: "False" }
				});
				case 21: return attachMethods$1({
					isCbor: true,
					type: MajorType$1.Simple,
					value: { type: "True" }
				});
				case 22: return attachMethods$1({
					isCbor: true,
					type: MajorType$1.Simple,
					value: { type: "Null" }
				});
				default: throw CborError$1.invalidSimpleValue();
			}
		}
	}
}
function checkCanonicalEncoding(cbor, buf) {
	if (!areBytesEqual(buf, encodeCbor(cbor))) throw CborError$1.nonCanonicalNumeric();
}
/**
* Extract native JavaScript value from CBOR.
* Converts CBOR types to their JavaScript equivalents.
*
* Returns the closed union {@link CborNative}. Note the two asymmetries
* documented there: maps come back as `CborMap` and tagged values as `Cbor`.
*/
const extractCbor$1 = (cbor) => {
	let c;
	if (cbor instanceof Uint8Array) c = decodeCbor$1(cbor);
	else c = cbor;
	switch (c.type) {
		case MajorType$1.Unsigned: return c.value;
		case MajorType$1.Negative: if (typeof c.value === "bigint") return -c.value - 1n;
		else return -c.value - 1;
		case MajorType$1.ByteString: return c.value;
		case MajorType$1.Text: return c.value;
		case MajorType$1.Array: return c.value.map(extractCbor$1);
		case MajorType$1.Map: return c.value;
		case MajorType$1.Tagged: return c;
		case MajorType$1.Simple: {
			const simple = c.value;
			switch (simple.type) {
				case "True": return true;
				case "False": return false;
				case "Null": return null;
				case "Float": return simple.value;
				default: return simple;
			}
		}
		default: return c;
	}
};
/**
* Map Support in dCBOR
*
* A deterministic CBOR map implementation that ensures maps with the same
* content always produce identical binary encodings, regardless of insertion
* order.
*
* ## Deterministic Map Representation
*
* The `CborMap` type follows strict deterministic encoding rules as specified by
* dCBOR:
*
* - Map keys are always sorted in lexicographic order of their encoded CBOR bytes
* - Duplicate keys are not allowed (enforced by the implementation)
* - Keys and values can be any type that can be converted to CBOR
* - Numeric reduction is applied (e.g., 3.0 is stored as integer 3)
*
* ## Vocabulary
*
* `CborMap` mirrors the JS `Map` protocol: `set`, `get`, `getOrThrow`, `has`,
* `delete`, `clear`, `size`, `keys()`, `values()`, `entries()`, `forEach`,
* iteration. `get` returns the STORED `Cbor` node (symmetric with
* `entries()`); extract natives explicitly with `extractCbor(map.get(k))`.
*
* @module map
*/
/**
* A deterministic CBOR map implementation.
*
* Maps are always encoded with keys sorted lexicographically by their
* encoded CBOR representation, ensuring deterministic encoding.
*/
var CborMap$1 = class {
	/** Debug label: `Object.prototype.toString` reports `[object CborMap]`. */
	get [Symbol.toStringTag]() {
		return "CborMap";
	}
	_dict;
	/**
	* Creates a new, empty CBOR Map.
	* Optionally initializes from a JavaScript Map (every key and value must
	* itself be encodable).
	*/
	constructor(map) {
		this._dict = new SortedByteMap();
		if (map !== void 0) for (const [key, value] of map.entries()) this.set(key, value);
	}
	/**
	* Inserts a key-value pair into the map (replacing any entry whose key has
	* the same canonical encoding). Any insertion order is accepted - entries
	* are kept in canonical ascending encoded-key order.
	*
	* @example
	* ```typescript
	* const m = new CborMap();
	* m.set("z", 1);
	* m.set(10, "ten"); // sorts before "z" in the encoding
	* encodeCbor(m);    // deterministic regardless of insertion order
	* ```
	* @public
	*/
	set(key, value) {
		const keyCbor = cbor$1(key);
		const valueCbor = cbor$1(value);
		const keyData = encodeCbor(keyCbor);
		this._dict.set(keyData, {
			key: keyCbor,
			value: valueCbor
		});
	}
	_makeKey(key) {
		return encodeCbor(cbor$1(key));
	}
	/**
	* Get the STORED `Cbor` node for a key, or `undefined` if absent.
	*
	* This is symmetric with `entries()` - no hidden native extraction, no
	* unwitnessed generics. To read a native value, compose explicitly:
	*
	* ```typescript
	* asNumber(map.get("age"));          // number | undefined, checked
	* extractCbor(map.getOrThrow("age")); // CborNative, throws if absent
	* ```
	* @public
	*/
	get(key) {
		return this._dict.get(this._makeKey(key))?.value;
	}
	/**
	* Get the stored `Cbor` node for a key.
	*
	* @throws {CborError} `MissingMapKey` - the key is not present.
	*/
	getOrThrow(key) {
		const value = this.get(key);
		if (value === void 0) throw CborError$1.missingMapKey();
		return value;
	}
	delete(key) {
		const keyData = this._makeKey(key);
		const existed = this._dict.has(keyData);
		this._dict.delete(keyData);
		return existed;
	}
	has(key) {
		return this._dict.has(this._makeKey(key));
	}
	clear() {
		this._dict = new SortedByteMap();
	}
	/** The number of entries in the map. */
	get size() {
		return this._dict.size;
	}
	/**
	* Get the entries of the map as an array, sorted in canonical ascending
	* encoded-key order.
	*
	* @internal Public because the encoder, diagnostic formatter, and hex
	* annotator consume it cross-module; not part of the supported surface.
	*/
	get entriesArray() {
		return this._dict.map((value, _key) => ({
			key: value.key,
			value: value.value
		}));
	}
	/** Iterate keys in canonical (sorted encoded-key) order. */
	*keys() {
		for (const entry of this.entriesArray) yield entry.key;
	}
	/** Iterate values in canonical key order. */
	*values() {
		for (const entry of this.entriesArray) yield entry.value;
	}
	/**
	* Iterate `[key, value]` tuples in canonical key order (the JS
	* `Map.entries()` shape).
	*/
	*entries() {
		for (const entry of this.entriesArray) yield [entry.key, entry.value];
	}
	/** JS `Map.forEach` mirror (value first, then key, then the map). */
	forEach(callback, thisArg) {
		for (const entry of this.entriesArray) callback.call(thisArg, entry.value, entry.key, this);
	}
	*[Symbol.iterator]() {
		for (const entry of this.entriesArray) yield [entry.key, entry.value];
	}
	/**
	* Inserts the next key-value pair into the map during decoding.
	* This is used for efficient map building during CBOR decoding.
	* Throws if the key is not in ascending order or is a duplicate.
	*
	* @internal The decoder's append path; not part of the supported surface.
	*/
	setNext(key, value) {
		const keyCbor = cbor$1(key);
		const newKey = encodeCbor(keyCbor);
		if (this._dict.has(newKey)) throw CborError$1.duplicateMapKey();
		const greatest = this._dict.maxKey();
		if (greatest !== void 0) {
			if (lexicographicallyCompareBytes(newKey, greatest) <= 0) throw CborError$1.misorderedMapKey();
		}
		this._dict.appendGreatest(newKey, {
			key: keyCbor,
			value: cbor$1(value)
		});
	}
	/**
	* Convert to a plain JavaScript `Map` of extracted native values.
	* Tagged values come back as `Cbor` nodes and nested maps as `CborMap`
	* (the {@link CborNative} asymmetries).
	*/
	toMap() {
		const map = /* @__PURE__ */ new Map();
		for (const entry of this.entriesArray) map.set(extractCbor$1(entry.key), extractCbor$1(entry.value));
		return map;
	}
};
/**
* Encodes the simple value to its raw CBOR byte representation.
*
* Returns the CBOR bytes that represent this simple value according to the
* dCBOR deterministic encoding rules:
* - `False` encodes as `0xf4`
* - `True` encodes as `0xf5`
* - `Null` encodes as `0xf6`
* - `Float` values encode according to the IEEE 754 floating point rules,
*   using the shortest representation that preserves precision.
*/
const simpleCborData = (simple) => {
	switch (simple.type) {
		case "False": return encodeVarInt(20, MajorType$1.Simple);
		case "True": return encodeVarInt(21, MajorType$1.Simple);
		case "Null": return encodeVarInt(22, MajorType$1.Simple);
		case "Float": return f64CborData(simple.value);
	}
};
Uint8Array.fromHex;
/**
* Convert bytes to a lowercase hex string.
*
* Delegates to the native `Uint8Array.prototype.toHex` where available.
*/
const bytesToHex$1 = (bytes) => {
	const native = bytes.toHex;
	if (typeof native === "function") return native.call(bytes);
	let out = "";
	for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
	return out;
};
/**
* The dCBOR value core: the `Cbor` union type, the polymorphic constructor
* `cbor()`, the encoder entry `encodeCbor()`, and the tagged-value
* constructor `taggedValue()`.
*
* ## The API in one paragraph
*
* Construct with `cbor(input)` (the single polymorphic constructor) or
* `taggedValue(tag, content)` (the only explicit tagged-value constructor);
* custom types participate by implementing the one structural protocol
* `ToCbor { toCbor(): Cbor }`. Encode with `encodeCbor(value)`. Decode with
* `decodeCbor(bytes)` (throws) or `tryDecode(bytes)` (returns `Result`).
* Read with the free `isX`/`asX`/`expectX` accessor functions. The only
* instance conveniences on a `Cbor` value are `toData()`, `toHex()`, and a
* cheap `toString()`.
*
* @module cbor
*/
/**
* The instance methods shared by every `Cbor` value: exactly three cheap
* conveniences (plus debug symbols below). Everything else is a free function
* so decode-only bundles never carry the diagnostic formatter, hex annotator,
* tag store, or walker.
*
* `String(c)`/template literals/`console.log` produce `Cbor(0x…)`. Diagnostic
* rendering lives in `@blockchaincommons/dcbor/diagnostic`; opt-in diag-flavored debug
* output lives in `@blockchaincommons/dcbor/debug` (`installDebugHooks()`).
*/
const CBOR_METHODS = {
	toData() {
		return encodeCbor(this);
	},
	toHex() {
		return bytesToHex$1(encodeCbor(this));
	},
	toString() {
		return `Cbor(0x${bytesToHex$1(encodeCbor(this))})`;
	},
	[Symbol.toStringTag]: "Cbor",
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return this.toString();
	}
};
/**
* Decorate a bare CBOR value (`{ isCbor, type, value[, tag] }`) with the shared
* instance methods. The methods live on {@link CBOR_METHODS} and are installed
* via the prototype - constructed with `Object.create` (not `setPrototypeOf`,
* which would drop the object off V8's fast path). Only the handful of data
* properties are own-properties; the methods are shared, not per-object.
*
* @internal
*/
const attachMethods$1 = (obj) => {
	const decorated = Object.create(CBOR_METHODS);
	return Object.assign(decorated, obj);
};
const CBOR_FALSE = attachMethods$1({
	isCbor: true,
	type: MajorType$1.Simple,
	value: { type: "False" }
});
const CBOR_TRUE = attachMethods$1({
	isCbor: true,
	type: MajorType$1.Simple,
	value: { type: "True" }
});
const CBOR_NULL = attachMethods$1({
	isCbor: true,
	type: MajorType$1.Simple,
	value: { type: "Null" }
});
const hasTaggedCbor$1 = (value) => {
	return typeof value === "object" && value !== null && "taggedCbor" in value && typeof value.taggedCbor === "function";
};
const hasToCbor$1 = (value) => {
	return typeof value === "object" && value !== null && "toCbor" in value && typeof value.toCbor === "function";
};
/**
* Convert any supported value to its CBOR representation - the single
* polymorphic constructor.
*
* Custom types participate by implementing {@link ToCbor}
* (`toCbor(): Cbor` - the `toJSON` precedent). Tagged values are built with
* {@link taggedValue}.
*
* @example
* ```typescript
* cbor(42);                          // integer
* cbor("héllo");                     // NFC-normalized text
* cbor([1, "two", true, null]);      // array
* cbor(new Map([["k", 1]]));         // map (canonical key order)
* cbor({ name: "Alice", age: 30 });  // plain object -> map
* ```
*
* @throws {CborError} `OutOfRange` - bigint outside `[-(2^64), 2^64 - 1]`.
* @throws {CborError} `Custom` - unsupported input type, or one of the two
*   directive errors below.
* @public
*
* ## Directive errors
*
* Two input shapes throw a directive `CborError` because encoding them
* silently would produce ambiguous or divergent bytes:
*
* - plain objects shaped exactly `{tag, value}`: use
*   `taggedValue(tag, content)` for a tagged value, or add/rename a key for
*   a map;
* - objects implementing `taggedCbor()` but not `toCbor()`: add
*   `toCbor() { return this.taggedCbor(); }`.
*/
const cbor$1 = (value) => {
	if (isCbor$1(value) && "toData" in value) return value;
	if (isCbor$1(value)) return attachMethods$1(value);
	let result;
	if (isCborNumber$1(value)) if (typeof value === "number" && Number.isNaN(value)) result = {
		isCbor: true,
		type: MajorType$1.Simple,
		value: {
			type: "Float",
			value: NaN
		}
	};
	else if (typeof value === "number" && hasFractionalPart(value)) result = {
		isCbor: true,
		type: MajorType$1.Simple,
		value: {
			type: "Float",
			value
		}
	};
	else if (value == Infinity) result = {
		isCbor: true,
		type: MajorType$1.Simple,
		value: {
			type: "Float",
			value: Infinity
		}
	};
	else if (value == -Infinity) result = {
		isCbor: true,
		type: MajorType$1.Simple,
		value: {
			type: "Float",
			value: -Infinity
		}
	};
	else if (typeof value === "number" && !Number.isSafeInteger(value)) {
		const big = BigInt(value);
		if (big >= 0n && big <= 18446744073709551615n) result = {
			isCbor: true,
			type: MajorType$1.Unsigned,
			value: big
		};
		else if (big < 0n && big >= CBOR_INT_MIN) result = {
			isCbor: true,
			type: MajorType$1.Negative,
			value: -big - 1n
		};
		else result = {
			isCbor: true,
			type: MajorType$1.Simple,
			value: {
				type: "Float",
				value
			}
		};
	} else if (typeof value === "bigint" && (value > 18446744073709551615n || value < CBOR_INT_MIN)) throw CborError$1.outOfRange();
	else if (value < 0) if (typeof value === "bigint") result = {
		isCbor: true,
		type: MajorType$1.Negative,
		value: -value - 1n
	};
	else result = {
		isCbor: true,
		type: MajorType$1.Negative,
		value: -value - 1
	};
	else result = {
		isCbor: true,
		type: MajorType$1.Unsigned,
		value
	};
	else if (typeof value === "string") {
		const normalized = value.normalize("NFC");
		result = {
			isCbor: true,
			type: MajorType$1.Text,
			value: normalized
		};
	} else if (value === null || value === void 0) return CBOR_NULL;
	else if (value === true) return CBOR_TRUE;
	else if (value === false) return CBOR_FALSE;
	else if (Array.isArray(value)) result = {
		isCbor: true,
		type: MajorType$1.Array,
		value: value.map(cbor$1)
	};
	else if (value instanceof Uint8Array) result = {
		isCbor: true,
		type: MajorType$1.ByteString,
		value
	};
	else if (value instanceof CborMap$1) result = {
		isCbor: true,
		type: MajorType$1.Map,
		value
	};
	else if (value instanceof Map) result = {
		isCbor: true,
		type: MajorType$1.Map,
		value: new CborMap$1(value)
	};
	else if (value instanceof Set) result = {
		isCbor: true,
		type: MajorType$1.Array,
		value: Array.from(value).map(cbor$1)
	};
	else if (hasToCbor$1(value)) return value.toCbor();
	else if (hasTaggedCbor$1(value)) throw CborError$1.custom("objects implementing taggedCbor() are no longer auto-wrapped by cbor(); implement toCbor() (e.g. `toCbor() { return this.taggedCbor(); }`)");
	else if (typeof value === "object" && "tag" in value && "value" in value) {
		const keys = Object.keys(value);
		if (keys.length === 2 && keys.includes("tag") && keys.includes("value")) throw CborError$1.custom("plain { tag, value } objects are ambiguous and no longer encode as tagged values; use taggedValue(tag, content) for a tagged value, or add/rename a key to encode a map");
		const map = new CborMap$1();
		for (const [key, val] of Object.entries(value)) map.set(cbor$1(key), cbor$1(val));
		result = {
			isCbor: true,
			type: MajorType$1.Map,
			value: map
		};
	} else if (typeof value === "object") {
		const map = new CborMap$1();
		for (const [key, val] of Object.entries(value)) map.set(cbor$1(key), cbor$1(val));
		result = {
			isCbor: true,
			type: MajorType$1.Map,
			value: map
		};
	} else throw CborError$1.custom("Unsupported type for CBOR encoding");
	return attachMethods$1(result);
};
const textEncoder = new TextEncoder();
/**
* Write a CBOR value into `writer`. The whole tree encodes into one growable
* buffer, so nested containers don't allocate-and-concatenate a fresh array
* per level.
*/
const writeCborInto = (writer, value) => {
	const c = cbor$1(value);
	switch (c.type) {
		case MajorType$1.Unsigned:
			writeVarInt(writer, c.value, MajorType$1.Unsigned);
			return;
		case MajorType$1.Negative:
			writeVarInt(writer, c.value, MajorType$1.Negative);
			return;
		case MajorType$1.ByteString:
			if (c.value instanceof Uint8Array) {
				writeVarInt(writer, c.value.length, MajorType$1.ByteString);
				writer.writeBytes(c.value);
				return;
			}
			break;
		case MajorType$1.Text:
			if (typeof c.value === "string") {
				const utf8Bytes = textEncoder.encode(c.value);
				writeVarInt(writer, utf8Bytes.length, MajorType$1.Text);
				writer.writeBytes(utf8Bytes);
				return;
			}
			break;
		case MajorType$1.Tagged:
			if (typeof c.tag === "bigint" || typeof c.tag === "number") {
				writeVarInt(writer, c.tag, MajorType$1.Tagged);
				writeCborInto(writer, c.value);
				return;
			}
			break;
		case MajorType$1.Simple:
			writer.writeBytes(simpleCborData(c.value));
			return;
		case MajorType$1.Array:
			writeVarInt(writer, c.value.length, MajorType$1.Array);
			for (const item of c.value) writeCborInto(writer, item);
			return;
		case MajorType$1.Map: {
			const entries = c.value.entriesArray;
			writeVarInt(writer, entries.length, MajorType$1.Map);
			for (const { key, value: entryValue } of entries) {
				writeCborInto(writer, key);
				writeCborInto(writer, entryValue);
			}
			return;
		}
	}
	throw CborError$1.wrongType();
};
/**
* Encode a value to deterministic CBOR bytes. Accepts anything `cbor()`
* accepts; equal values always produce identical bytes (dCBOR determinism).
*
* @example
* ```typescript
* encodeCbor({ a: 1 });            // Uint8Array [0xa1, 0x61, 0x61, 0x01]
* bytesToHex(encodeCbor("Hello")); // "6548656c6c6f"
* ```
*
* @throws {CborError} Whatever `cbor(value)` throws for unsupported inputs
*   (`OutOfRange`, `Custom`).
* @remarks The decoder's canonicality check re-encodes every decoded value
*   through this function, so it is wire-critical.
* @public
*/
const encodeCbor = (value) => {
	const c = cbor$1(value);
	switch (c.type) {
		case MajorType$1.Unsigned: return encodeVarInt(c.value, MajorType$1.Unsigned);
		case MajorType$1.Negative: return encodeVarInt(c.value, MajorType$1.Negative);
		case MajorType$1.Simple: return simpleCborData(c.value);
		default: {
			const writer = new BufWriter();
			writeCborInto(writer, c);
			return writer.toBytes();
		}
	}
};
/**
* Tag registry implementation.
*
* Stores tags with their names and optional summarizer functions.
*/
var TagsStore$1 = class {
	/** Debug label: `Object.prototype.toString` reports `[object TagsStore]`. */
	get [Symbol.toStringTag]() {
		return "TagsStore";
	}
	_tagsByValue = /* @__PURE__ */ new Map();
	_tagsByName = /* @__PURE__ */ new Map();
	_summarizers = /* @__PURE__ */ new Map();
	constructor() {}
	/**
	* Insert a tag into the registry.
	*
	* - Throws if the tag name is undefined or empty
	* - Throws if a tag with the same value exists with a different name
	* - Allows re-registering the same tag value with the same name
	*
	* @param tag - The tag to register (must have a non-empty name)
	* @throws Error if tag has no name, empty name, or conflicts with existing registration
	*
	* @example
	* ```typescript
	* const store = new TagsStore();
	* store.register(Tag.from(12345, 'myCustomTag'));
	* ```
	*/
	register(tag) {
		const name = tag.name;
		if (name === void 0 || name === "") throw new Error(`Tag ${tag.value} must have a non-empty name`);
		const key = this._valueKey(tag.value);
		const existing = this._tagsByValue.get(key);
		if (existing?.name !== void 0 && existing.name !== name) throw new Error(`Attempt to register tag: ${tag.value} '${existing.name}' with different name: '${name}'`);
		this._tagsByValue.set(key, tag);
		this._tagsByName.set(name, tag);
	}
	/**
	* Register multiple tags; the conflict-throwing validation in `register()`
	* applies per tag.
	*/
	registerAll(tags) {
		for (const tag of tags) this.register(tag);
	}
	/**
	* Register a custom summarizer function for a tag.
	*
	* @param tagValue - The numeric tag value
	* @param summarizer - The summarizer function
	*
	* @example
	* ```typescript
	* store.setSummarizer(1, (cbor, flat) => {
	*   // Custom date formatting
	*   return `Date(${extractCbor(cbor)})`;
	* });
	* ```
	*/
	setSummarizer(tagValue, summarizer) {
		const key = this._valueKey(tagValue);
		this._summarizers.set(key, summarizer);
	}
	assignedNameForTag(tag) {
		const key = this._valueKey(tag.value);
		return this._tagsByValue.get(key)?.name;
	}
	nameForTag(tag) {
		return this.assignedNameForTag(tag) ?? tag.value.toString();
	}
	tagForValue(value) {
		const key = this._valueKey(value);
		return this._tagsByValue.get(key);
	}
	tagForName(name) {
		return this._tagsByName.get(name);
	}
	nameForValue(value) {
		const tag = this.tagForValue(value);
		return tag !== void 0 ? this.nameForTag(tag) : value.toString();
	}
	summarizer(tag) {
		const key = this._valueKey(tag);
		return this._summarizers.get(key);
	}
	/**
	* Create a string key for a numeric tag value.
	* Handles both number and bigint types.
	*
	* @private
	*/
	_valueKey(value) {
		return value.toString();
	}
};
/**
* Global singleton instance of the tags store.
*/
let globalTagsStore$1;
/**
* Get the global tags store instance.
*
* Creates the instance on first access.
*
* @returns The global TagsStore instance
*
* @example
* ```typescript
* const store = getGlobalTagsStore();
* store.register(Tag.from(999, 'myTag'));
* ```
*/
const getGlobalTagsStore$1 = () => {
	globalTagsStore$1 ??= new TagsStore$1();
	return globalTagsStore$1;
};
//#endregion
//#region ../bc-dcbor-compat-ts/node_modules/@blockchaincommons/dcbor/dist/diag-BpAWXEUJ.mjs
/**
* String utilities for dCBOR, including Unicode normalization.
*
* @module string-util
*/
/**
* Flank a string with left and right strings.
*
* @param s - String to flank
* @param left - Left flanking string
* @param right - Right flanking string
* @returns Flanked string
*/
const flanked = (s, left, right) => left + s + right;
/**
* Check if a character is printable. Internal helper for {@link sanitized}.
*
* @param c - Character to check
* @returns True if printable
*/
const isPrintable = (c) => {
	if (c.length !== 1) return false;
	const code = c.charCodeAt(0);
	return code > 127 || code >= 32 && code <= 126;
};
/**
* Sanitize a string by replacing non-printable characters with dots.
* Returns None if the string has no printable characters.
*
* @param str - String to sanitize
* @returns Sanitized string or undefined if no printable characters
*/
const sanitized = (str) => {
	let hasPrintable = false;
	const chars = [];
	for (const c of str) if (isPrintable(c)) {
		hasPrintable = true;
		chars.push(c);
	} else chars.push(".");
	if (!hasPrintable) return;
	return chars.join("");
};
const resolveOpts = (opts) => {
	const summarize = opts?.summarize ?? false;
	return {
		annotate: opts?.annotate ?? false,
		summarize,
		flat: summarize || (opts?.flat ?? false),
		tags: opts?.tags ?? "global"
	};
};
/**
* Format a CBOR value - or a walk visitor's `WalkElement` - as CBOR
* diagnostic notation.
*
* ```typescript
* diagnostic(value);                       // pretty-printed
* diagnostic(value, { flat: true });       // single line
* diagnostic(value, { annotate: true });   // tag names as annotations
* diagnostic(value, { summarize: true });  // registered summarizers (implies flat)
* ```
*
* @param input - CBOR value, or a `WalkElement` from a walk visitor
* @param opts - Formatting options (explicit `undefined` fields mean
*   "use the default")
* @public
*/
function diagnostic$1(input, opts) {
	const state = resolveOpts(opts);
	if (typeof input === "object" && "type" in input && (input.type === "single" || input.type === "keyvalue")) {
		if (input.type === "single") return diagFormat(diagItem(input.cbor, state), state);
		return `${diagFormat(diagItem(input.key, state), state)}: ${diagFormat(diagItem(input.value, state), state)}`;
	}
	return diagFormat(diagItem(input, state), state);
}
const item = (value) => ({
	kind: "item",
	value
});
const group = (begin, end, items, isPairs, comment) => {
	const g = {
		kind: "group",
		begin,
		end,
		items,
		isPairs
	};
	if (comment !== void 0) g.comment = comment;
	return g;
};
const isGroup = (i) => i.kind === "group";
const containsGroup = (i) => i.kind === "group" && i.items.some(isGroup);
const totalStringsLen = (i) => i.kind === "item" ? i.value.length : i.items.reduce((acc, c) => acc + totalStringsLen(c), 0);
const greatestStringsLen = (i) => i.kind === "item" ? i.value.length : i.items.reduce((acc, c) => Math.max(acc, totalStringsLen(c)), 0);
/**
* Alternates between `pairSeparator` (after even-indexed items - keys) and
* `itemSeparator` (after odd-indexed items - values). Falls back to
* `itemSeparator` for non-pair groups.
*/
function joined(elements, itemSeparator, pairSeparator) {
	const sep = pairSeparator ?? itemSeparator;
	let result = "";
	const len = elements.length;
	for (let i = 0; i < len; i++) {
		result += elements[i];
		if (i !== len - 1) result += (i & 1) !== 0 ? itemSeparator : sep;
	}
	return result;
}
const diagFormat = (i, opts) => diagFormatOpt(i, 0, "", opts);
function diagFormatOpt(i, level, separator, opts) {
	if (i.kind === "item") return formatLine(level, opts, i.value, separator, void 0);
	if (opts.flat !== true && (containsGroup(i) || totalStringsLen(i) > 20 || greatestStringsLen(i) > 20)) return multilineComposition(i, level, separator, opts);
	return singleLineComposition(i, level, separator, opts);
}
function formatLine(level, opts, string, separator, comment) {
	const result = `${opts.flat === true ? "" : " ".repeat(level * 4)}${string}${separator}`;
	if (comment !== void 0) return `${result}   / ${comment} /`;
	return result;
}
function singleLineComposition(i, level, separator, opts) {
	let str;
	let comment;
	if (i.kind === "item") {
		str = i.value;
		comment = void 0;
	} else {
		str = flanked(joined(i.items.map((c) => c.kind === "item" ? c.value : singleLineComposition(c, level + 1, separator, opts)), ", ", i.isPairs ? ": " : ", "), i.begin, i.end);
		comment = i.comment;
	}
	return formatLine(level, opts, str, separator, comment);
}
function multilineComposition(i, level, separator, opts) {
	if (i.kind === "item") return i.value;
	const lines = [];
	const openOpts = {
		...opts,
		flat: false
	};
	lines.push(formatLine(level, openOpts, i.begin, "", i.comment));
	for (let idx = 0; idx < i.items.length; idx++) {
		const sep = idx === i.items.length - 1 ? "" : i.isPairs && (idx & 1) === 0 ? ":" : ",";
		lines.push(diagFormatOpt(i.items[idx], level + 1, sep, opts));
	}
	lines.push(formatLine(level, opts, i.end, separator, void 0));
	return lines.join("\n");
}
function diagItem(cbor, opts) {
	switch (cbor.type) {
		case MajorType$1.Unsigned: return item(formatUnsigned(cbor.value));
		case MajorType$1.Negative: return item(formatNegative(cbor.value));
		case MajorType$1.ByteString: return item(formatBytes(cbor.value));
		case MajorType$1.Text: return item(formatText(cbor.value));
		case MajorType$1.Array: return item_array(cbor.value, opts);
		case MajorType$1.Map: return item_map(cbor.value, opts);
		case MajorType$1.Tagged: return item_tagged(cbor.tag, cbor.value, opts);
		case MajorType$1.Simple: return item(formatSimple(cbor.value));
	}
}
function item_array(items, opts) {
	return group("[", "]", items.map((it) => diagItem(it, opts)), false);
}
function item_map(map, opts) {
	const entries = map?.entriesArray ?? [];
	const flatItems = [];
	for (const e of entries) {
		flatItems.push(diagItem(e.key, opts));
		flatItems.push(diagItem(e.value, opts));
	}
	return group("{", "}", flatItems, true);
}
function item_tagged(tag, content, opts) {
	if (opts.summarize === true) {
		const summarizer = resolveTagsStore(opts.tags)?.summarizer(tag);
		if (summarizer !== void 0) {
			const result = summarizer(content, opts.flat ?? false);
			if (result.ok) return item(result.value);
			return item(`<error: ${result.error.message}>`);
		}
	}
	let comment;
	if (opts.annotate === true) {
		const store = resolveTagsStore(opts.tags);
		const tagObj = { value: tag };
		const assignedName = store?.assignedNameForTag(tagObj);
		if (assignedName !== void 0) comment = assignedName;
	}
	return group(`${String(tag)}(`, ")", [diagItem(content, opts)], false, comment);
}
function formatUnsigned(value) {
	return String(value);
}
function formatNegative(value) {
	if (typeof value === "bigint") return String(-value - 1n);
	return String(-value - 1);
}
function formatBytes(value) {
	return `h'${bytesToHex$1(value)}'`;
}
function formatText(value) {
	return `"${value.replace(/"/g, "\\\"")}"`;
}
function formatSimple(value) {
	switch (value.type) {
		case "True": return "true";
		case "False": return "false";
		case "Null": return "null";
		case "Float": return formatFloat(value.value);
	}
}
/**
* Format a CBOR float for diagnostic output. Shared with the hex-dump
* annotation path; see {@link floatDisplayString}.
*/
function formatFloat(value) {
	return floatDisplayString(value);
}
function resolveTagsStore(tags) {
	if (tags === "none") return void 0;
	if (tags === "global" || tags === void 0) return getGlobalTagsStore$1();
	return tags;
}
//#endregion
//#region ../bc-dcbor-compat-ts/node_modules/@blockchaincommons/dcbor/dist/diagnostic.mjs
/**
* Hex dump utilities for CBOR data.
*
* Affordances for viewing the encoded binary representation of CBOR as hexadecimal.
* Optionally annotates the output, breaking it up into semantically meaningful lines,
* formatting dates, and adding names of known tags.
*
* @module dump
*/
/**
* Render CBOR as an annotated hex dump: the encoding broken into
* semantically meaningful lines with offsets, values, and tag names
* resolved through the tags store.
*
* For plain hex use `c.toHex()` or `bytesToHex(encodeCbor(v))`.
*
* @param cbor - CBOR value to render
* @param opts - Formatting options (explicit `undefined` fields mean
*   "use the default")
*/
const hexAnnotated = (cbor, opts) => {
	const items = dumpItems(cbor, 0, opts?.tagsStore ?? getGlobalTagsStore$1());
	const roundedNoteColumn = (items.reduce((largest, item) => {
		return Math.max(largest, item.formatFirstColumn().length);
	}, 0) + 4 & -4) - 1;
	return items.map((item) => item.format(roundedNoteColumn)).join("\n");
};
/**
* Internal structure for dump items.
*/
var DumpItem = class {
	level;
	data;
	note;
	constructor(level, data, note) {
		this.level = level;
		this.data = data;
		this.note = note;
	}
	format(noteColumn) {
		const column1 = this.formatFirstColumn();
		let column2 = "";
		let padding = "";
		if (this.note !== void 0) {
			const paddingCount = Math.max(1, Math.min(39, noteColumn) - column1.length + 1);
			padding = " ".repeat(paddingCount);
			column2 = `# ${this.note}`;
		}
		return column1 + padding + column2;
	}
	formatFirstColumn() {
		return " ".repeat(this.level * 4) + this.data.map(bytesToHex$1).filter((x) => x.length > 0).join(" ");
	}
};
/**
* Generate dump items for a CBOR value (recursive).
*/
function dumpItems(cbor, level, tagsStore) {
	const items = [];
	switch (cbor.type) {
		case MajorType$1.Unsigned: {
			const data = encodeCbor(cbor);
			items.push(new DumpItem(level, [data], `unsigned(${cbor.value})`));
			break;
		}
		case MajorType$1.Negative: {
			const data = encodeCbor(cbor);
			const actualValue = typeof cbor.value === "bigint" ? -1n - cbor.value : -1 - cbor.value;
			items.push(new DumpItem(level, [data], `negative(${actualValue})`));
			break;
		}
		case MajorType$1.ByteString: {
			const header = encodeVarInt(cbor.value.length, MajorType$1.ByteString);
			items.push(new DumpItem(level, [header], `bytes(${cbor.value.length})`));
			if (cbor.value.length > 0) {
				let note = void 0;
				try {
					const sanitizedText = sanitized(new TextDecoder("utf-8", { fatal: true }).decode(cbor.value));
					if (sanitizedText !== void 0 && sanitizedText !== "") note = flanked(sanitizedText, "\"", "\"");
				} catch {}
				items.push(new DumpItem(level + 1, [cbor.value], note));
			}
			break;
		}
		case MajorType$1.Text: {
			const utf8Data = new TextEncoder().encode(cbor.value);
			const header = encodeVarInt(utf8Data.length, MajorType$1.Text);
			const firstByte = header[0];
			if (firstByte === void 0) throw CborError$1.custom("Invalid varint encoding");
			const headerData = [new Uint8Array([firstByte]), header.slice(1)];
			items.push(new DumpItem(level, headerData, `text(${utf8Data.length})`));
			items.push(new DumpItem(level + 1, [utf8Data], flanked(cbor.value, "\"", "\"")));
			break;
		}
		case MajorType$1.Array: {
			const header = encodeVarInt(cbor.value.length, MajorType$1.Array);
			const firstByte = header[0];
			if (firstByte === void 0) throw CborError$1.custom("Invalid varint encoding");
			const headerData = [new Uint8Array([firstByte]), header.slice(1)];
			items.push(new DumpItem(level, headerData, `array(${cbor.value.length})`));
			for (const item of cbor.value) items.push(...dumpItems(item, level + 1, tagsStore));
			break;
		}
		case MajorType$1.Map: {
			const header = encodeVarInt(cbor.value.size, MajorType$1.Map);
			const firstByte = header[0];
			if (firstByte === void 0) throw CborError$1.custom("Invalid varint encoding");
			const headerData = [new Uint8Array([firstByte]), header.slice(1)];
			items.push(new DumpItem(level, headerData, `map(${cbor.value.size})`));
			for (const entry of cbor.value.entriesArray) {
				items.push(...dumpItems(entry.key, level + 1, tagsStore));
				items.push(...dumpItems(entry.value, level + 1, tagsStore));
			}
			break;
		}
		case MajorType$1.Tagged: {
			const tagValue = cbor.tag;
			if (tagValue === void 0) throw CborError$1.custom("Tagged CBOR value must have a tag");
			const header = encodeVarInt(tagValue, MajorType$1.Tagged);
			const firstByte = header[0];
			if (firstByte === void 0) throw CborError$1.custom("Invalid varint encoding");
			const headerData = [new Uint8Array([firstByte]), header.slice(1)];
			const noteComponents = [`tag(${tagValue})`];
			const tag = Tag.from(tagValue);
			const tagName = tagsStore.assignedNameForTag(tag);
			if (tagName !== void 0) noteComponents.push(tagName);
			const tagNote = noteComponents.join(" ");
			items.push(new DumpItem(level, headerData, tagNote));
			items.push(...dumpItems(cbor.value, level + 1, tagsStore));
			break;
		}
		case MajorType$1.Simple: {
			const data = encodeCbor(cbor);
			const simple = cbor.value;
			let note;
			if (simple.type === "True") note = "true";
			else if (simple.type === "False") note = "false";
			else if (simple.type === "Null") note = "null";
			else if (simple.type === "Float") note = floatDisplayString(simple.value);
			else note = "simple";
			items.push(new DumpItem(level, [data], note));
			break;
		}
	}
	return items;
}
//#endregion
//#region ../bc-dcbor-compat-ts/dist/index.mjs
/**
* Compare two tag values for equality, normalizing `number` vs `bigint`.
* A raw `===` would treat `100n` and `100` as unequal, so a large tag that
* decoded to a `bigint` wouldn't match the same value written as a `number`.
*/
const tagValuesEqual = (a, b) => {
	if (typeof a === "bigint" || typeof b === "bigint") return BigInt(a) === BigInt(b);
	return a === b;
};
/**
* Get the string representation of a tag.
* Internal function used for error messages.
*
* @param tag - The tag to represent
* @returns String representation (name if available, otherwise value)
*
* @internal
*/
const tagToString = (tag) => tag.name ?? tag.value.toString();
/**
* Convert an Error to a display string.
*
* Matches Rust's `Display` trait / `to_string()` method.
*/
const errorToString = (error) => {
	switch (error.type) {
		case "Underrun": return "early end of CBOR data";
		case "UnsupportedHeaderValue": return "unsupported value in CBOR header";
		case "NonCanonicalNumeric": return "a CBOR numeric value was encoded in non-canonical form";
		case "InvalidSimpleValue": return "an invalid CBOR simple value was encountered";
		case "InvalidString": return `an invalidly-encoded UTF-8 string was encountered in the CBOR (${error.message})`;
		case "NonCanonicalString": return "a CBOR string was not encoded in Unicode Canonical Normalization Form C";
		case "UnusedData": return `the decoded CBOR had ${error.count} extra bytes at the end`;
		case "MisorderedMapKey": return "the decoded CBOR map has keys that are not in canonical order";
		case "DuplicateMapKey": return "the decoded CBOR map has a duplicate key";
		case "MissingMapKey": return "missing CBOR map key";
		case "OutOfRange": return "the CBOR numeric value could not be represented in the specified numeric type";
		case "WrongType": return "the decoded CBOR value was not the expected type";
		case "WrongTag": return `expected CBOR tag ${tagToString(error.expected)}, but got ${tagToString(error.actual)}`;
		case "InvalidUtf8": return `invalid UTF‑8 string: ${error.message}`;
		case "InvalidDate": return `invalid ISO 8601 date string: ${error.message}`;
		case "Custom": return error.message;
	}
};
/**
* Typed error class for all CBOR-related errors.
*
* Wraps the discriminated union Error type in a JavaScript Error object
* for proper error handling with stack traces.
*
* @example
* ```typescript
* throw new CborError({ type: 'Underrun' });
* throw new CborError({ type: 'WrongTag', expected: tag1, actual: tag2 });
* ```
*/
var CborError = class CborError extends Error {
	/**
	* The structured error information.
	*/
	errorType;
	/**
	* Create a new CborError.
	*
	* @param errorType - The discriminated union error type
	* @param message - Optional custom message (defaults to errorToString(errorType))
	*/
	constructor(errorType, message) {
		super(message ?? errorToString(errorType));
		this.name = "CborError";
		this.errorType = errorType;
		if ("captureStackTrace" in Error) Error.captureStackTrace(this, CborError);
	}
	/**
	* Check if an error is a CborError.
	*
	* @param error - Error to check
	* @returns True if error is a CborError
	*/
	static isCborError(error) {
		return error instanceof CborError;
	}
};
/**
* Convert a legacy node into a canonical `@blockchaincommons/dcbor` node.
*
* Leaves are shared, not copied: the canonical functions never mutate their
* inputs. Map nodes unwrap to the inner canonical `CborMap`, so later
* mutations through the legacy wrapper stay visible.
*/
const toNew = (c) => {
	switch (c.type) {
		case MajorType.Array: return {
			isCbor: true,
			type: MajorType.Array,
			value: c.value.map(toNew)
		};
		case MajorType.Map: return {
			isCbor: true,
			type: MajorType.Map,
			value: c.value._inner
		};
		case MajorType.Tagged: return {
			isCbor: true,
			type: MajorType.Tagged,
			tag: c.tag,
			value: toNew(c.value)
		};
		default: return {
			isCbor: true,
			type: c.type,
			value: c.value
		};
	}
};
/**
* Convert a canonical node into a legacy node with the legacy method set.
* Map nodes wrap the canonical `CborMap` without copying entries.
*/
const fromNew = (n) => {
	switch (n.type) {
		case MajorType.Array: return attachMethods({
			isCbor: true,
			type: MajorType.Array,
			value: n.value.map(fromNew)
		});
		case MajorType.Map: return attachMethods({
			isCbor: true,
			type: MajorType.Map,
			value: CborMap._fromInner(n.value)
		});
		case MajorType.Tagged: return attachMethods({
			isCbor: true,
			type: MajorType.Tagged,
			tag: n.tag,
			value: fromNew(n.value)
		});
		default: return attachMethods({
			isCbor: true,
			type: n.type,
			value: n.value
		});
	}
};
/**
* Translate a canonical `CborError` (code + details) back into the legacy
* discriminated-union `CborError`. Non-CborError values are re-thrown as-is.
*/
const toLegacyError = (e) => {
	if (!CborError$1.isCborError(e)) {
		if (e instanceof CborError) return e;
		throw e;
	}
	const details = e.details;
	let errorType;
	switch (e.code) {
		case "UnsupportedHeaderValue":
			errorType = {
				type: "UnsupportedHeaderValue",
				value: details["headerValue"]
			};
			break;
		case "UnusedData":
			errorType = {
				type: "UnusedData",
				count: details["count"]
			};
			break;
		case "WrongTag":
			errorType = {
				type: "WrongTag",
				expected: details["expectedTag"],
				actual: details["actualTag"]
			};
			break;
		case "InvalidString":
			errorType = {
				type: "InvalidString",
				message: details["cause"] ?? e.message
			};
			break;
		case "InvalidUtf8":
			errorType = {
				type: "InvalidUtf8",
				message: details["cause"] ?? e.message
			};
			break;
		case "InvalidDate":
			errorType = {
				type: "InvalidDate",
				message: details["cause"] ?? e.message
			};
			break;
		case "Custom":
			errorType = {
				type: "Custom",
				message: e.message
			};
			break;
		default: errorType = { type: e.code };
	}
	return new CborError(errorType);
};
/** Run a canonical-package operation, translating thrown errors. */
const delegating = (op) => {
	try {
		return op();
	} catch (e) {
		throw toLegacyError(e);
	}
};
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Tag registry and management system.
*
* The TagsStore provides a centralized registry for CBOR tags,
* including name resolution and custom summarizer functions.
*
* The store wraps the `@blockchaincommons/dcbor` `TagsStore` — and the
* global singleton wraps the canonical package's *global* store — so tag
* names and summarizers registered through this legacy API are visible to
* the delegated diagnostic/hex formatters (and vice versa).
*
* @module tags-store
*/
/**
* Convert a canonical tag (whose `name` may be explicitly `undefined`) to the
* legacy `Tag` shape, which omits the property instead.
*/
const toLegacyTag = (tag) => {
	if (tag === void 0) return void 0;
	return tag.name !== void 0 ? {
		value: tag.value,
		name: tag.name
	} : { value: tag.value };
};
/**
* Tag registry implementation.
*
* Stores tags with their names and optional summarizer functions, delegating
* storage to the canonical `@blockchaincommons/dcbor` store.
*/
var TagsStore = class TagsStore {
	_store;
	/** Original (legacy-signature) summarizers, for the `summarizer()` accessor. */
	_legacySummarizers = /* @__PURE__ */ new Map();
	constructor() {
		this._store = new TagsStore$1();
	}
	/**
	* The wrapped canonical `@blockchaincommons/dcbor` store.
	* @internal
	*/
	get _inner() {
		return this._store;
	}
	/**
	* Wrap an existing canonical store without copying registrations.
	* @internal
	*/
	static _fromInner(inner) {
		const store = new TagsStore();
		store._store = inner;
		return store;
	}
	/**
	* Insert a tag into the registry.
	*
	* Matches Rust's TagsStore::insert() behavior:
	* - Throws if the tag name is undefined or empty
	* - Throws if a tag with the same value exists with a different name
	* - Allows re-registering the same tag value with the same name
	*
	* @param tag - The tag to register (must have a non-empty name)
	* @throws Error if tag has no name, empty name, or conflicts with existing registration
	*
	* @example
	* ```typescript
	* const store = new TagsStore();
	* store.insert(createTag(12345, 'myCustomTag'));
	* ```
	*/
	insert(tag) {
		const name = tag.name;
		if (name === void 0 || name === "") throw new Error(`Tag ${tag.value} must have a non-empty name`);
		const existing = this._store.tagForValue(tag.value);
		if (existing?.name !== void 0 && existing.name !== name) throw new Error(`Attempt to register tag: ${tag.value} '${existing.name}' with different name: '${name}'`);
		this._store.register(Tag.from(tag.value, name));
	}
	/**
	* Insert multiple tags into the registry.
	* Matches Rust's insert_all() method.
	*
	* @param tags - Array of tags to register
	*
	* @example
	* ```typescript
	* const store = new TagsStore();
	* store.insertAll([
	*   createTag(1, 'date'),
	*   createTag(100, 'custom')
	* ]);
	* ```
	*/
	insertAll(tags) {
		for (const tag of tags) this.insert(tag);
	}
	/**
	* Register a custom summarizer function for a tag.
	*
	* The summarizer is adapted and forwarded to the canonical store, so the
	* delegated diagnostic formatters invoke it (with a legacy-shaped node).
	*
	* @param tagValue - The numeric tag value
	* @param summarizer - The summarizer function
	*
	* @example
	* ```typescript
	* store.setSummarizer(1, (cbor, flat) => {
	*   // Custom date formatting
	*   return `Date(${extractCbor(cbor)})`;
	* });
	* ```
	*/
	setSummarizer(tagValue, summarizer) {
		this._legacySummarizers.set(this._valueKey(tagValue), summarizer);
		this._store.setSummarizer(tagValue, (cbor, flat) => {
			const result = summarizer(fromNew(cbor), flat);
			if (result.ok) return result;
			return {
				ok: false,
				error: CborError$1.custom(errorToString(result.error))
			};
		});
	}
	assignedNameForTag(tag) {
		return this._store.tagForValue(tag.value)?.name;
	}
	nameForTag(tag) {
		return this.assignedNameForTag(tag) ?? tag.value.toString();
	}
	tagForValue(value) {
		return toLegacyTag(this._store.tagForValue(value));
	}
	tagForName(name) {
		return toLegacyTag(this._store.tagForName(name));
	}
	nameForValue(value) {
		const tag = this.tagForValue(value);
		return tag !== void 0 ? this.nameForTag(tag) : value.toString();
	}
	summarizer(tag) {
		return this._legacySummarizers.get(this._valueKey(tag));
	}
	_valueKey(value) {
		return value.toString();
	}
};
/**
* Global singleton instance of the tags store.
*/
let globalTagsStore;
/**
* Get the global tags store instance.
*
* Creates the instance on first access, wrapping the canonical package's
* global store so registrations are shared with the delegated formatters.
*
* @returns The global TagsStore instance
*
* @example
* ```typescript
* const store = getGlobalTagsStore();
* store.insert(createTag(999, 'myTag'));
* ```
*/
const getGlobalTagsStore = () => {
	globalTagsStore ??= TagsStore._fromInner(getGlobalTagsStore$1());
	return globalTagsStore;
};
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Hex dump utilities for CBOR data.
*
* Affordances for viewing the encoded binary representation of CBOR as hexadecimal.
* Optionally annotates the output, breaking it up into semantically meaningful lines,
* formatting dates, and adding names of known tags.
*
* The annotated rendering delegates to `@blockchaincommons/dcbor/diagnostic`.
*
* @module dump
*/
/**
* Convert bytes to hex string.
*/
const bytesToHex = (bytes) => {
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};
/**
* Returns the encoded hexadecimal representation of CBOR.
*
* @param cbor - CBOR value to convert
* @returns Hex string
*/
const hex = (cbor) => bytesToHex(cborData(cbor));
/**
* Returns the encoded hexadecimal representation of CBOR with options.
*
* Optionally annotates the output, e.g., breaking the output up into
* semantically meaningful lines, formatting dates, and adding names of
* known tags.
*
* @param cbor - CBOR value to convert
* @param opts - Formatting options
* @returns Hex string (possibly annotated)
*/
const hexOpt = (cbor, opts = {}) => {
	if (opts.annotate !== true) return hex(cbor);
	const tagsStore = opts.tagsStore ?? getGlobalTagsStore();
	return delegating(() => hexAnnotated(toNew(cbor), { tagsStore: tagsStore._inner }));
};
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Enhanced diagnostic formatting for CBOR values.
*
* Provides multiple formatting options including
* - Annotated diagnostics with tag names
* - Summarized values using custom summarizers
* - Flat (single-line) vs. pretty (multi-line) formatting
* - Configurable tag store usage
*
* Rendering delegates to `@blockchaincommons/dcbor/diagnostic` (which shares
* this module's option vocabulary); summarizers registered through this
* package's `TagsStore` are consulted through the wrapped canonical store.
*
* @module diag
*/
/**
* Convert the legacy tags-store option to the canonical one (unwrap a
* wrapped store; pass the string variants through).
*/
const toBcTagsOpt = (tags) => {
	if (tags instanceof TagsStore) return tags._inner;
	return tags;
};
/**
* Format CBOR value as diagnostic notation with options.
*
* @param cbor - CBOR value to format
* @param opts - Formatting options
* @returns Diagnostic string
*
* @example
* ```typescript
* const value = cbor({ name: 'Alice', age: 30 });
* console.log(diagnosticOpt(value, { flat: true }));
* // {\"name\": \"Alice\", \"age\": 30}
* ```
*/
function diagnosticOpt(cbor, opts) {
	return delegating(() => diagnostic$1(toNew(cbor), {
		annotate: opts?.annotate,
		summarize: opts?.summarize,
		flat: opts?.summarize === true ? true : opts?.flat,
		tags: toBcTagsOpt(opts?.tags)
	}));
}
/**
* Format CBOR value as standard diagnostic notation.
*
* @param cbor - CBOR value to format
* @returns Diagnostic string (pretty-printed with multiple lines for complex structures)
*
* @example
* ```typescript
* const value = cbor([1, 2, 3]);
* console.log(diagnostic(value));
* // For simple arrays: "[1, 2, 3]"
* // For nested structures: multi-line formatted output
* ```
*/
function diagnostic(cbor) {
	return diagnosticOpt(cbor);
}
/**
* Checks if the simple value is a floating point number.
*/
const isFloat$1 = (simple) => simple.type === "Float";
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* dCBOR decoding — delegates to `@blockchaincommons/dcbor`, the canonical
* implementation, then rewraps the result into this package's legacy node
* shape. All deterministic-encoding enforcement (canonical numeric forms,
* NFC text, map-key order, no trailing bytes) happens in the canonical
* decoder; thrown errors are translated back to the legacy `CborError`.
*/
function decodeCbor(data) {
	return fromNew(delegating(() => decodeCbor$1(data)));
}
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Convenience utilities for working with CBOR values.
*
* Provides type-safe helpers for checking types, extracting values,
* and working with arrays, maps, and tagged values.
*
* @module conveniences
*/
/**
* Extract native JavaScript value from CBOR.
* Converts CBOR types to their JavaScript equivalents.
*/
const extractCbor = (cbor) => {
	let c;
	if (cbor instanceof Uint8Array) c = decodeCbor(cbor);
	else c = cbor;
	switch (c.type) {
		case MajorType.Unsigned: return c.value;
		case MajorType.Negative: if (typeof c.value === "bigint") return -c.value - 1n;
		else return -c.value - 1;
		case MajorType.ByteString: return c.value;
		case MajorType.Text: return c.value;
		case MajorType.Array: return c.value.map(extractCbor);
		case MajorType.Map: return c.value;
		case MajorType.Tagged: return c;
		case MajorType.Simple:
			if (c.value.type === "True") return true;
			if (c.value.type === "False") return false;
			if (c.value.type === "Null") return null;
			if (c.value.type === "Float") return c.value.value;
			return c;
	}
};
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Map Support in dCBOR
*
* A deterministic CBOR map that ensures maps with the same content always
* produce identical binary encodings, regardless of insertion order.
*
* This class keeps the historical `@blockchaincommons/dcbor-compat` map API (Rust-flavored
* `insert`/`containsKey`/`len`/`iter` alongside the JS `Map` vocabulary) but
* stores its entries in a `@blockchaincommons/dcbor` `CborMap` — the
* canonical implementation owns key ordering (lexicographic by encoded CBOR
* bytes), duplicate handling, and the decode-time `setNext` ordering checks.
*
* @module map
*/
/**
* A deterministic CBOR map implementation.
*
* Maps are always encoded with keys sorted lexicographically by their
* encoded CBOR representation, ensuring deterministic encoding.
*/
var CborMap = class CborMap {
	_map;
	/**
	* Creates a new, empty CBOR Map.
	* Optionally initializes from a JavaScript Map.
	*/
	constructor(map) {
		this._map = new CborMap$1();
		if (map !== void 0) for (const [key, value] of map.entries()) this.set(key, value);
	}
	/**
	* The wrapped canonical `@blockchaincommons/dcbor` map.
	* @internal
	*/
	get _inner() {
		return this._map;
	}
	/**
	* Wrap an existing canonical map without copying entries.
	* @internal
	*/
	static _fromInner(inner) {
		const map = new CborMap();
		map._map = inner;
		return map;
	}
	/**
	* Creates a new, empty CBOR Map.
	* Matches Rust's Map::new().
	*/
	static new() {
		return new CborMap();
	}
	/**
	* Inserts a key-value pair into the map.
	* Matches Rust's Map::insert().
	*/
	set(key, value) {
		const keyCbor = cbor(key);
		const valueCbor = cbor(value);
		delegating(() => this._map.set(toNew(keyCbor), toNew(valueCbor)));
	}
	/**
	* Alias for set() to match Rust's insert() method.
	*/
	insert(key, value) {
		this.set(key, value);
	}
	/**
	* Get a value from the map, given a key.
	* Returns undefined if the key is not present in the map.
	* Matches Rust's Map::get().
	*/
	get(key) {
		const stored = delegating(() => this._map.get(toNew(cbor(key))));
		if (stored === void 0) return;
		return extractCbor(fromNew(stored));
	}
	/**
	* Get a value from the map, given a key.
	* Throws an error if the key is not present.
	* Matches Rust's Map::extract().
	*/
	extract(key) {
		const value = this.get(key);
		if (value === void 0) throw new CborError({ type: "MissingMapKey" });
		return value;
	}
	/**
	* Tests if the map contains a key.
	* Matches Rust's Map::contains_key().
	*/
	containsKey(key) {
		return delegating(() => this._map.has(toNew(cbor(key))));
	}
	delete(key) {
		return delegating(() => this._map.delete(toNew(cbor(key))));
	}
	has(key) {
		return this.containsKey(key);
	}
	clear() {
		this._map.clear();
	}
	/**
	* Returns the number of entries in the map.
	* Matches Rust's Map::len().
	*/
	get length() {
		return this._map.size;
	}
	/**
	* Alias for length to match JavaScript Map API.
	* Also matches Rust's Map::len().
	*/
	get size() {
		return this._map.size;
	}
	/**
	* Returns the number of entries in the map.
	* Matches Rust's Map::len().
	*/
	len() {
		return this._map.size;
	}
	/**
	* Checks if the map is empty.
	* Matches Rust's Map::is_empty().
	*/
	isEmpty() {
		return this._map.size === 0;
	}
	/**
	* Get the entries of the map as an array.
	* Keys are sorted in lexicographic order of their encoded CBOR bytes.
	*/
	get entriesArray() {
		const entries = [];
		for (const [key, value] of this._map.entries()) entries.push({
			key: fromNew(key),
			value: fromNew(value)
		});
		return entries;
	}
	/**
	* Gets an iterator over the entries of the CBOR map, sorted by key.
	* Key sorting order is lexicographic by the key's binary-encoded CBOR.
	* Matches Rust's Map::iter().
	*/
	iter() {
		return this.entriesArray;
	}
	/**
	* Returns an iterator of [key, value] tuples for JavaScript Map API compatibility.
	* This matches the standard JavaScript Map.entries() method behavior.
	*/
	*entries() {
		for (const entry of this.entriesArray) yield [entry.key, entry.value];
	}
	/**
	* Inserts the next key-value pair into the map during decoding.
	* This is used for efficient map building during CBOR decoding.
	* Throws if the key is not in ascending order or is a duplicate.
	* Matches Rust's Map::insert_next().
	*/
	setNext(key, value) {
		const keyCbor = cbor(key);
		const valueCbor = cbor(value);
		delegating(() => this._map.setNext(toNew(keyCbor), toNew(valueCbor)));
	}
	get debug() {
		return `map({${this.entriesArray.map(CborMap.entryDebug).join(", ")}})`;
	}
	get diagnostic() {
		return `{${this.entriesArray.map(CborMap.entryDiagnostic).join(", ")}}`;
	}
	static entryDebug(entry) {
		const keyDebug = CborMap.formatDebug(entry.key);
		const valueDebug = CborMap.formatDebug(entry.value);
		return `0x${bytesToHex(encodeCbor$1(entry.key))}: (${keyDebug}, ${valueDebug})`;
	}
	static formatDebug(cbor) {
		switch (cbor.type) {
			case MajorType.Unsigned: return `unsigned(${cbor.value})`;
			case MajorType.Negative: return `negative(${typeof cbor.value === "bigint" ? -cbor.value - 1n : -cbor.value - 1})`;
			case MajorType.ByteString: return `bytes(${bytesToHex(cbor.value)})`;
			case MajorType.Text: return `text("${cbor.value}")`;
			case MajorType.Array: return `array([${cbor.value.map(CborMap.formatDebug).join(", ")}])`;
			case MajorType.Map: return cbor.value.debug;
			case MajorType.Tagged: return `tagged(${cbor.tag}, ${CborMap.formatDebug(cbor.value)})`;
			case MajorType.Simple: {
				const simple = cbor.value;
				if (typeof simple === "object" && simple !== null && "type" in simple) switch (simple.type) {
					case "True": return "simple(true)";
					case "False": return "simple(false)";
					case "Null": return "simple(null)";
					case "Float": return `simple(${simple.value})`;
				}
				return "simple";
			}
			default: return diagnostic(cbor);
		}
	}
	static entryDiagnostic(entry) {
		return `${diagnostic(entry.key)}: ${diagnostic(entry.value)}`;
	}
	*[Symbol.iterator]() {
		for (const entry of this.entriesArray) yield [entry.key, entry.value];
	}
	toMap() {
		const map = /* @__PURE__ */ new Map();
		for (const entry of this.entriesArray) map.set(extractCbor(entry.key), extractCbor(entry.value));
		return map;
	}
};
/**
* Clone helper used to give each descendant subtree an independent copy of
* the post-visit state — mirrors Rust `State: Clone` + `state.clone()` per
* child in `walk.rs`. Falls back to the value as-is for primitives (which
* don't need cloning) and uses `structuredClone` for objects.
*/
const cloneState = (s) => {
	if (s === null) return s;
	const t = typeof s;
	if (t !== "object" && t !== "function") return s;
	return globalThis.structuredClone(s);
};
/**
* Walk a CBOR tree, visiting each element with a visitor function.
*
* The visitor function is called for each element in the tree, in depth-first order.
* State semantics mirror Rust's `walk_internal`:
*
* - The visitor's returned `newState` propagates **down** to descendants of
*   the just-visited node only.
* - Sibling subtrees each receive an independent clone of the parent's
*   post-visit state, so accumulating mutations in one subtree never leak
*   into a sibling.
* - State changes do not propagate **up**: the public `walk` returns `void`.
*
* For maps, the visitor is called with:
* 1. A 'keyvalue' element containing both key and value
* 2. The key individually (if descent wasn't stopped)
* 3. The value individually (if descent wasn't stopped)
*
* @template State - The type of state to pass into each visit
* @param cbor - The CBOR value to traverse
* @param initialState - Initial state value
* @param visitor - Function to call for each element
*/
const walk = (cbor, initialState, visitor) => {
	walkInternal(cbor, 0, { type: "none" }, initialState, visitor);
};
/**
* Internal recursive walk implementation.
*
* @internal
*/
function walkInternal(cbor, level, edge, state, visitor) {
	const [postVisitState, stop] = visitor({
		type: "single",
		cbor
	}, level, edge, state);
	if (stop) return;
	switch (cbor.type) {
		case MajorType.Array:
			walkArray(cbor, level, postVisitState, visitor);
			break;
		case MajorType.Map:
			walkMap(cbor, level, postVisitState, visitor);
			break;
		case MajorType.Tagged: walkTagged(cbor, level, postVisitState, visitor);
	}
}
/**
* Walk an array's elements. Each element is visited with an independent
* clone of `parentState`.
*
* @internal
*/
function walkArray(cbor, level, parentState, visitor) {
	for (let index = 0; index < cbor.value.length; index++) {
		const item = cbor.value[index];
		if (item === void 0) throw new CborError({
			type: "Custom",
			message: `Array element at index ${index} is undefined`
		});
		walkInternal(item, level + 1, {
			type: "array_element",
			index
		}, cloneState(parentState), visitor);
	}
}
/**
* Walk a map's key-value pairs.
*
* Each kv pair receives a clone of `parentState`. If descent isn't stopped,
* the key and value subtrees receive independent clones of the kv-visit's
* post-visit state.
*
* @internal
*/
function walkMap(cbor, level, parentState, visitor) {
	for (const entry of cbor.value.entriesArray) {
		const { key, value } = entry;
		const [kvPostState, kvStop] = visitor({
			type: "keyvalue",
			key,
			value
		}, level + 1, { type: "map_key_value" }, cloneState(parentState));
		if (kvStop) continue;
		walkInternal(key, level + 1, { type: "map_key" }, cloneState(kvPostState), visitor);
		walkInternal(value, level + 1, { type: "map_value" }, cloneState(kvPostState), visitor);
	}
}
/**
* Walk a tagged value's content. The content visit receives a clone of
* `parentState`.
*
* @internal
*/
function walkTagged(cbor, level, parentState, visitor) {
	walkInternal(cbor.value, level + 1, { type: "tagged_content" }, cloneState(parentState), visitor);
}
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*/
const MajorType = {
	Unsigned: 0,
	Negative: 1,
	ByteString: 2,
	Text: 3,
	Array: 4,
	Map: 5,
	Tagged: 6,
	Simple: 7
};
const MajorTypeNames = {
	[MajorType.Unsigned]: "Unsigned",
	[MajorType.Negative]: "Negative",
	[MajorType.ByteString]: "ByteString",
	[MajorType.Text]: "Text",
	[MajorType.Array]: "Array",
	[MajorType.Map]: "Map",
	[MajorType.Tagged]: "Tagged",
	[MajorType.Simple]: "Simple"
};
const getMajorTypeName = (type) => MajorTypeNames[type];
const isCborNumber = (value) => {
	return typeof value === "number" || typeof value === "bigint";
};
const isCbor = (value) => {
	return value !== null && typeof value === "object" && "isCbor" in value && value.isCbor === true;
};
/**
* Type guard to check if value has taggedCbor method.
*/
/**
* Resolve a numeric/bigint tag value to a `Tag` object, looking up the
* canonical name from the global tags store (matches Rust's
* `try_into_tagged_value` returning the stored `Tag`). Falls back to a
* name-less `{ value }` if no name is registered — never synthesizes a
* placeholder `tag-${value}` string.
*/
const resolveTag = (value) => {
	const stored = getGlobalTagsStore().tagForValue(value);
	if (stored !== void 0) return stored;
	return { value };
};
const hasTaggedCbor = (value) => {
	return typeof value === "object" && value !== null && "taggedCbor" in value && typeof value.taggedCbor === "function";
};
/**
* Type guard to check if value has toCbor method.
*/
const hasToCbor = (value) => {
	return typeof value === "object" && value !== null && "toCbor" in value && typeof value.toCbor === "function";
};
/**
* Convert any value to a CBOR representation.
* Matches Rust's `From` trait implementations for CBOR.
*/
const cbor = (value) => {
	if (isCbor(value) && "toData" in value) return value;
	if (isCbor(value)) return attachMethods(value);
	let result;
	if (isCborNumber(value)) {
		if (typeof value === "number" && Number.isNaN(value)) result = {
			isCbor: true,
			type: MajorType.Simple,
			value: {
				type: "Float",
				value: NaN
			}
		};
		else if (typeof value === "number" && hasFractionalPart(value)) result = {
			isCbor: true,
			type: MajorType.Simple,
			value: {
				type: "Float",
				value
			}
		};
		else if (value == Infinity) result = {
			isCbor: true,
			type: MajorType.Simple,
			value: {
				type: "Float",
				value: Infinity
			}
		};
		else if (value == -Infinity) result = {
			isCbor: true,
			type: MajorType.Simple,
			value: {
				type: "Float",
				value: -Infinity
			}
		};
		else if (typeof value === "number" && !Number.isSafeInteger(value)) {
			const big = BigInt(value);
			if (big >= 0n && big <= 18446744073709551615n) result = {
				isCbor: true,
				type: MajorType.Unsigned,
				value: big
			};
			else if (big < 0n && big >= -18446744073709551616n) result = {
				isCbor: true,
				type: MajorType.Negative,
				value: -big - 1n
			};
			else result = {
				isCbor: true,
				type: MajorType.Simple,
				value: {
					type: "Float",
					value
				}
			};
		} else if (typeof value === "bigint" && (value > 18446744073709551615n || value < -18446744073709551616n)) throw new CborError({ type: "OutOfRange" });
		else if (value < 0) {
			if (typeof value === "bigint") result = {
				isCbor: true,
				type: MajorType.Negative,
				value: -value - 1n
			};
			else result = {
				isCbor: true,
				type: MajorType.Negative,
				value: -value - 1
			};
		} else result = {
			isCbor: true,
			type: MajorType.Unsigned,
			value
		};
	} else if (typeof value === "string") {
		const normalized = value.normalize("NFC");
		result = {
			isCbor: true,
			type: MajorType.Text,
			value: normalized
		};
	} else if (value === null || value === void 0) result = {
		isCbor: true,
		type: MajorType.Simple,
		value: { type: "Null" }
	};
	else if (value === true) result = {
		isCbor: true,
		type: MajorType.Simple,
		value: { type: "True" }
	};
	else if (value === false) result = {
		isCbor: true,
		type: MajorType.Simple,
		value: { type: "False" }
	};
	else if (Array.isArray(value)) result = {
		isCbor: true,
		type: MajorType.Array,
		value: value.map(cbor)
	};
	else if (value instanceof Uint8Array) result = {
		isCbor: true,
		type: MajorType.ByteString,
		value
	};
	else if (value instanceof CborMap) result = {
		isCbor: true,
		type: MajorType.Map,
		value
	};
	else if (value instanceof Map) result = {
		isCbor: true,
		type: MajorType.Map,
		value: new CborMap(value)
	};
	else if (value instanceof Set) result = {
		isCbor: true,
		type: MajorType.Array,
		value: Array.from(value).map((v) => cbor(v))
	};
	else if (hasTaggedCbor(value)) return value.taggedCbor();
	else if (hasToCbor(value)) return value.toCbor();
	else if (typeof value === "object" && value !== null && "tag" in value && "value" in value) {
		const keys = Object.keys(value);
		const objValue = value;
		if (keys.length === 2 && keys.includes("tag") && keys.includes("value")) return taggedCbor(objValue.tag, objValue.value);
		const map = new CborMap();
		for (const [key, val] of Object.entries(value)) map.set(cbor(key), cbor(val));
		result = {
			isCbor: true,
			type: MajorType.Map,
			value: map
		};
	} else if (typeof value === "object" && value !== null) {
		const map = new CborMap();
		for (const [key, val] of Object.entries(value)) map.set(cbor(key), cbor(val));
		result = {
			isCbor: true,
			type: MajorType.Map,
			value: map
		};
	} else throw new CborError({
		type: "Custom",
		message: "Unsupported type for CBOR encoding"
	});
	return attachMethods(result);
};
/**
* Encode a CBOR value to binary data.
* Matches Rust's `CBOR::to_cbor_data()` method.
*
* Delegates to `@blockchaincommons/dcbor` — the canonical encoder — via the
* structural node bridge.
*/
const cborData = (value) => {
	const c = cbor(value);
	return delegating(() => encodeCbor(toNew(c)));
};
const encodeCbor$1 = (value) => {
	return cborData(cbor(value));
};
const taggedCbor = (tag, value) => {
	const tagNumber = typeof tag === "number" || typeof tag === "bigint" ? tag : Number(tag);
	return attachMethods({
		isCbor: true,
		type: MajorType.Tagged,
		tag: tagNumber,
		value: cbor(value)
	});
};
/**
* Attaches instance methods to a CBOR value.
* This enables method chaining like cbor.toHex() instead of Cbor.toHex(cbor).
* @internal
*/
const attachMethods = (obj) => {
	return Object.assign(obj, {
		toData() {
			return cborData(this);
		},
		toHex() {
			return bytesToHex(cborData(this));
		},
		toHexAnnotated(tagsStore) {
			tagsStore = tagsStore ?? getGlobalTagsStore();
			return hexOpt(this, {
				annotate: true,
				tagsStore
			});
		},
		toString() {
			return diagnosticOpt(this, { flat: true });
		},
		toDebugString() {
			return diagnosticOpt(this, { flat: false });
		},
		toDiagnostic() {
			return diagnosticOpt(this, { flat: false });
		},
		toDiagnosticAnnotated() {
			return diagnosticOpt(this, { annotate: true });
		},
		isByteString() {
			return this.type === MajorType.ByteString;
		},
		isText() {
			return this.type === MajorType.Text;
		},
		isArray() {
			return this.type === MajorType.Array;
		},
		isMap() {
			return this.type === MajorType.Map;
		},
		isTagged() {
			return this.type === MajorType.Tagged;
		},
		isSimple() {
			return this.type === MajorType.Simple;
		},
		isBool() {
			return this.type === MajorType.Simple && (this.value.type === "True" || this.value.type === "False");
		},
		isTrue() {
			return this.type === MajorType.Simple && this.value.type === "True";
		},
		isFalse() {
			return this.type === MajorType.Simple && this.value.type === "False";
		},
		isNull() {
			return this.type === MajorType.Simple && this.value.type === "Null";
		},
		isNumber() {
			if (this.type === MajorType.Unsigned || this.type === MajorType.Negative) return true;
			if (this.type === MajorType.Simple) return isFloat$1(this.value);
			return false;
		},
		isInteger() {
			return this.type === MajorType.Unsigned || this.type === MajorType.Negative;
		},
		isUnsigned() {
			return this.type === MajorType.Unsigned;
		},
		isNegative() {
			return this.type === MajorType.Negative;
		},
		isNaN() {
			return this.type === MajorType.Simple && this.value.type === "Float" && Number.isNaN(this.value.value);
		},
		isFloat() {
			return this.type === MajorType.Simple && isFloat$1(this.value);
		},
		asByteString() {
			return this.type === MajorType.ByteString ? this.value : void 0;
		},
		asText() {
			return this.type === MajorType.Text ? this.value : void 0;
		},
		asArray() {
			return this.type === MajorType.Array ? this.value : void 0;
		},
		asMap() {
			return this.type === MajorType.Map ? this.value : void 0;
		},
		asTagged() {
			if (this.type !== MajorType.Tagged) return;
			return [resolveTag(this.tag), this.value];
		},
		asBool() {
			if (this.type !== MajorType.Simple) return void 0;
			if (this.value.type === "True") return true;
			if (this.value.type === "False") return false;
		},
		asInteger() {
			if (this.type === MajorType.Unsigned) return this.value;
			else if (this.type === MajorType.Negative) {
				if (typeof this.value === "bigint") return -this.value - 1n;
				else return -this.value - 1;
			}
		},
		asNumber() {
			if (this.type === MajorType.Unsigned) return this.value;
			else if (this.type === MajorType.Negative) {
				if (typeof this.value === "bigint") return -this.value - 1n;
				else return -this.value - 1;
			} else if (this.type === MajorType.Simple && isFloat$1(this.value)) return this.value.value;
		},
		asSimpleValue() {
			return this.type === MajorType.Simple ? this.value : void 0;
		},
		toByteString() {
			if (this.type !== MajorType.ByteString) throw new TypeError(`Cannot convert CBOR to ByteString: expected ByteString type, got ${getMajorTypeName(this.type)}`);
			return this.value;
		},
		toText() {
			if (this.type !== MajorType.Text) throw new TypeError(`Cannot convert CBOR to Text: expected Text type, got ${getMajorTypeName(this.type)}`);
			return this.value;
		},
		toArray() {
			if (this.type !== MajorType.Array) throw new TypeError(`Cannot convert CBOR to Array: expected Array type, got ${getMajorTypeName(this.type)}`);
			return this.value;
		},
		toMap() {
			if (this.type !== MajorType.Map) throw new TypeError(`Cannot convert CBOR to Map: expected Map type, got ${getMajorTypeName(this.type)}`);
			return this.value;
		},
		toTagged() {
			if (this.type !== MajorType.Tagged) throw new TypeError(`Cannot convert CBOR to Tagged: expected Tagged type, got ${getMajorTypeName(this.type)}`);
			return [resolveTag(this.tag), this.value];
		},
		toBool() {
			const result = this.asBool();
			if (result === void 0) throw new TypeError(`Cannot convert CBOR to boolean: expected Simple(True/False) type, got ${getMajorTypeName(this.type)}`);
			return result;
		},
		toInteger() {
			const result = this.asInteger();
			if (result === void 0) throw new TypeError(`Cannot convert CBOR to integer: expected Unsigned or Negative type, got ${getMajorTypeName(this.type)}`);
			return result;
		},
		toNumber() {
			const result = this.asNumber();
			if (result === void 0) throw new TypeError(`Cannot convert CBOR to number: expected Unsigned, Negative, or Float type, got ${getMajorTypeName(this.type)}`);
			return result;
		},
		toSimpleValue() {
			if (this.type !== MajorType.Simple) throw new TypeError(`Cannot convert CBOR to Simple: expected Simple type, got ${getMajorTypeName(this.type)}`);
			return this.value;
		},
		expectTag(expectedTag) {
			if (this.type !== MajorType.Tagged) throw new CborError({ type: "WrongType" });
			const expected = typeof expectedTag === "object" && "value" in expectedTag ? expectedTag : { value: expectedTag };
			if (!tagValuesEqual(this.tag, expected.value)) throw new CborError({
				type: "WrongTag",
				expected,
				actual: { value: this.tag }
			});
			return this.value;
		},
		walk(initialState, visitor) {
			walk(this, initialState, visitor);
		},
		validateTag(expectedTags) {
			if (this.type !== MajorType.Tagged) throw new CborError({ type: "WrongType" });
			const tagValue = this.tag;
			const matchingTag = expectedTags.find((t) => tagValuesEqual(t.value, tagValue));
			if (matchingTag === void 0) throw new CborError({
				type: "WrongTag",
				expected: expectedTags[0],
				actual: { value: tagValue }
			});
			return matchingTag;
		},
		untagged() {
			if (this.type !== MajorType.Tagged) throw new CborError({ type: "WrongType" });
			return this.value;
		}
	});
};
attachMethods({
	isCbor: true,
	type: MajorType.Simple,
	value: { type: "False" }
}), attachMethods({
	isCbor: true,
	type: MajorType.Simple,
	value: { type: "True" }
}), attachMethods({
	isCbor: true,
	type: MajorType.Simple,
	value: { type: "Null" }
}), attachMethods({
	isCbor: true,
	type: MajorType.Simple,
	value: {
		type: "Float",
		value: NaN
	}
});
//#endregion
//#region src/error.ts
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Error type for UR encoding/decoding operations.
*/
var URError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "URError";
	}
};
/**
* Error type for invalid UR schemes.
*
* Message matches Rust bc-ur-rust/src/error.rs: `invalid UR scheme`.
*/
var InvalidSchemeError = class extends URError {
	constructor() {
		super("invalid UR scheme");
		this.name = "InvalidSchemeError";
	}
};
/**
* Error type for unspecified UR types.
*
* Message matches Rust bc-ur-rust/src/error.rs: `no UR type specified`.
*/
var TypeUnspecifiedError = class extends URError {
	constructor() {
		super("no UR type specified");
		this.name = "TypeUnspecifiedError";
	}
};
/**
* Error type for invalid UR types.
*
* Message matches Rust bc-ur-rust/src/error.rs: `invalid UR type`.
*/
var InvalidTypeError = class extends URError {
	constructor() {
		super("invalid UR type");
		this.name = "InvalidTypeError";
	}
};
/**
* Error type for non-single-part URs.
*/
var NotSinglePartError = class extends URError {
	constructor() {
		super("UR is not a single-part");
		this.name = "NotSinglePartError";
	}
};
/**
* Error type for unexpected UR types.
*
* Message matches Rust bc-ur-rust/src/error.rs:
* `expected UR type {expected}, but found {found}`.
*/
var UnexpectedTypeError = class extends URError {
	constructor(expected, found) {
		super(`expected UR type ${expected}, but found ${found}`);
		this.name = "UnexpectedTypeError";
	}
};
/**
* Error type for Bytewords encoding/decoding errors.
*
* Message matches Rust bc-ur-rust/src/error.rs: `Bytewords error ({0})`.
*/
var BytewordsError = class extends URError {
	constructor(message) {
		super(`Bytewords error (${message})`);
		this.name = "BytewordsError";
	}
};
/**
* Error type for CBOR encoding/decoding errors.
*
* Message matches Rust bc-ur-rust/src/error.rs: `CBOR error ({0})`.
*/
var CBORError = class extends URError {
	constructor(message) {
		super(`CBOR error (${message})`);
		this.name = "CBORError";
	}
};
/**
* Error type for UR decoder errors.
* Matches Rust's Error::UR(String) variant.
*/
var URDecodeError = class extends URError {
	constructor(message) {
		super(`UR decoder error (${message})`);
		this.name = "URDecodeError";
	}
};
/**
* Helper function to check if a result is an error.
*/
function isError(result) {
	return result instanceof Error;
}
//#endregion
//#region src/utils.ts
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*/
/**
* Checks if a character is a valid UR type character.
*
* Mirrors Rust's `URTypeChar::is_ur_type` (`bc-ur-rust/src/utils.rs:6-19`):
* lowercase a-z, digits 0-9, and the hyphen `-`.
*/
function isURTypeChar(char) {
	const code = char.charCodeAt(0);
	if (code >= 97 && code <= 122) return true;
	if (code >= 48 && code <= 57) return true;
	if (code === 45) return true;
	return false;
}
/**
* Checks if a string is a valid UR type.
*
* Mirrors Rust's `URTypeString::is_ur_type` (`bc-ur-rust/src/utils.rs:26-32`)
* which is `self.chars().all(...)` — meaning **the empty string is accepted**
* (a vacuously-true `all` over no chars). We mirror that here so that
* `URType::new("")` succeeds in both ports; the round-trip then fails at
* decode-time with `TypeUnspecified`.
*/
function isValidURType(urType) {
	return Array.from(urType).every((char) => isURTypeChar(char));
}
/**
* Validates and returns a UR type, or throws an error if invalid.
*/
function validateURType(urType) {
	if (!isValidURType(urType)) throw new InvalidTypeError();
	return urType;
}
/**
* Bytewords for encoding/decoding bytes as words.
* See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-004-bytewords.md
*/
const BYTEWORDS = [
	"able",
	"acid",
	"also",
	"apex",
	"aqua",
	"arch",
	"atom",
	"aunt",
	"away",
	"axis",
	"back",
	"bald",
	"barn",
	"belt",
	"beta",
	"bias",
	"blue",
	"body",
	"brag",
	"brew",
	"bulb",
	"buzz",
	"calm",
	"cash",
	"cats",
	"chef",
	"city",
	"claw",
	"code",
	"cola",
	"cook",
	"cost",
	"crux",
	"curl",
	"cusp",
	"cyan",
	"dark",
	"data",
	"days",
	"deli",
	"dice",
	"diet",
	"door",
	"down",
	"draw",
	"drop",
	"drum",
	"dull",
	"duty",
	"each",
	"easy",
	"echo",
	"edge",
	"epic",
	"even",
	"exam",
	"exit",
	"eyes",
	"fact",
	"fair",
	"fern",
	"figs",
	"film",
	"fish",
	"fizz",
	"flap",
	"flew",
	"flux",
	"foxy",
	"free",
	"frog",
	"fuel",
	"fund",
	"gala",
	"game",
	"gear",
	"gems",
	"gift",
	"girl",
	"glow",
	"good",
	"gray",
	"grim",
	"guru",
	"gush",
	"gyro",
	"half",
	"hang",
	"hard",
	"hawk",
	"heat",
	"help",
	"high",
	"hill",
	"holy",
	"hope",
	"horn",
	"huts",
	"iced",
	"idea",
	"idle",
	"inch",
	"inky",
	"into",
	"iris",
	"iron",
	"item",
	"jade",
	"jazz",
	"join",
	"jolt",
	"jowl",
	"judo",
	"jugs",
	"jump",
	"junk",
	"jury",
	"keep",
	"keno",
	"kept",
	"keys",
	"kick",
	"kiln",
	"king",
	"kite",
	"kiwi",
	"knob",
	"lamb",
	"lava",
	"lazy",
	"leaf",
	"legs",
	"liar",
	"limp",
	"lion",
	"list",
	"logo",
	"loud",
	"love",
	"luau",
	"luck",
	"lung",
	"main",
	"many",
	"math",
	"maze",
	"memo",
	"menu",
	"meow",
	"mild",
	"mint",
	"miss",
	"monk",
	"nail",
	"navy",
	"need",
	"news",
	"next",
	"noon",
	"note",
	"numb",
	"obey",
	"oboe",
	"omit",
	"onyx",
	"open",
	"oval",
	"owls",
	"paid",
	"part",
	"peck",
	"play",
	"plus",
	"poem",
	"pool",
	"pose",
	"puff",
	"puma",
	"purr",
	"quad",
	"quiz",
	"race",
	"ramp",
	"real",
	"redo",
	"rich",
	"road",
	"rock",
	"roof",
	"ruby",
	"ruin",
	"runs",
	"rust",
	"safe",
	"saga",
	"scar",
	"sets",
	"silk",
	"skew",
	"slot",
	"soap",
	"solo",
	"song",
	"stub",
	"surf",
	"swan",
	"taco",
	"task",
	"taxi",
	"tent",
	"tied",
	"time",
	"tiny",
	"toil",
	"tomb",
	"toys",
	"trip",
	"tuna",
	"twin",
	"ugly",
	"undo",
	"unit",
	"urge",
	"user",
	"vast",
	"very",
	"veto",
	"vial",
	"vibe",
	"view",
	"visa",
	"void",
	"vows",
	"wall",
	"wand",
	"warm",
	"wasp",
	"wave",
	"waxy",
	"webs",
	"what",
	"when",
	"whiz",
	"wolf",
	"work",
	"yank",
	"yawn",
	"yell",
	"yoga",
	"yurt",
	"zaps",
	"zero",
	"zest",
	"zinc",
	"zone",
	"zoom"
];
/**
* Create a reverse mapping for fast byteword lookup.
*/
function createBytewordsMap() {
	const map = /* @__PURE__ */ new Map();
	BYTEWORDS.forEach((word, index) => {
		map.set(word, index);
	});
	return map;
}
const BYTEWORDS_MAP = createBytewordsMap();
/**
* Bytemojis for encoding/decoding bytes as emojis.
* See: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2024-008-bytemoji.md
*/
const BYTEMOJIS = [
	"😀",
	"😂",
	"😆",
	"😉",
	"🙄",
	"😋",
	"😎",
	"😍",
	"😘",
	"😭",
	"🫠",
	"🥱",
	"🤩",
	"😶",
	"🤨",
	"🫥",
	"🥵",
	"🥶",
	"😳",
	"🤪",
	"😵",
	"😡",
	"🤢",
	"😇",
	"🤠",
	"🤡",
	"🥳",
	"🥺",
	"😬",
	"🤑",
	"🙃",
	"🤯",
	"😈",
	"👹",
	"👺",
	"💀",
	"👻",
	"👽",
	"😺",
	"😹",
	"😻",
	"😽",
	"🙀",
	"😿",
	"🫶",
	"🤲",
	"🙌",
	"🤝",
	"👍",
	"👎",
	"👈",
	"👆",
	"💪",
	"👄",
	"🦷",
	"👂",
	"👃",
	"🧠",
	"👀",
	"🤚",
	"🦶",
	"🍎",
	"🍊",
	"🍋",
	"🍌",
	"🍉",
	"🍇",
	"🍓",
	"🫐",
	"🍒",
	"🍑",
	"🍍",
	"🥝",
	"🍆",
	"🥑",
	"🥦",
	"🍅",
	"🌽",
	"🥕",
	"🫒",
	"🧄",
	"🥐",
	"🥯",
	"🍞",
	"🧀",
	"🥚",
	"🍗",
	"🌭",
	"🍔",
	"🍟",
	"🍕",
	"🌮",
	"🥙",
	"🍱",
	"🍜",
	"🍤",
	"🍚",
	"🥠",
	"🍨",
	"🍦",
	"🎂",
	"🪴",
	"🌵",
	"🌱",
	"💐",
	"🍁",
	"🍄",
	"🌹",
	"🌺",
	"🌼",
	"🌻",
	"🌸",
	"💨",
	"🌊",
	"💧",
	"💦",
	"🌀",
	"🌈",
	"🌞",
	"🌝",
	"🌛",
	"🌜",
	"🌙",
	"🌎",
	"💫",
	"⭐",
	"🪐",
	"🌐",
	"💛",
	"💔",
	"💘",
	"💖",
	"💕",
	"🏁",
	"🚩",
	"💬",
	"💯",
	"🚫",
	"🔴",
	"🔷",
	"🟩",
	"🛑",
	"🔺",
	"🚗",
	"🚑",
	"🚒",
	"🚜",
	"🛵",
	"🚨",
	"🚀",
	"🚁",
	"🛟",
	"🚦",
	"🏰",
	"🎡",
	"🎢",
	"🎠",
	"🏠",
	"🔔",
	"🔑",
	"🚪",
	"🪑",
	"🎈",
	"💌",
	"📦",
	"📫",
	"📖",
	"📚",
	"📌",
	"🧮",
	"🔒",
	"💎",
	"📷",
	"⏰",
	"⏳",
	"📡",
	"💡",
	"💰",
	"🧲",
	"🧸",
	"🎁",
	"🎀",
	"🎉",
	"🪭",
	"👑",
	"🫖",
	"🔭",
	"🛁",
	"🏆",
	"🥁",
	"🎷",
	"🎺",
	"🏀",
	"🏈",
	"🎾",
	"🏓",
	"✨",
	"🔥",
	"💥",
	"👕",
	"👚",
	"👖",
	"🩳",
	"👗",
	"👔",
	"🧢",
	"👓",
	"🧶",
	"🧵",
	"💍",
	"👠",
	"👟",
	"🧦",
	"🧤",
	"👒",
	"👜",
	"🐱",
	"🐶",
	"🐭",
	"🐹",
	"🐰",
	"🦊",
	"🐻",
	"🐼",
	"🐨",
	"🐯",
	"🦁",
	"🐮",
	"🐷",
	"🐸",
	"🐵",
	"🐔",
	"🐥",
	"🦆",
	"🦉",
	"🐴",
	"🦄",
	"🐝",
	"🐛",
	"🦋",
	"🐌",
	"🐞",
	"🐢",
	"🐺",
	"🐍",
	"🪽",
	"🐙",
	"🦑",
	"🪼",
	"🦞",
	"🦀",
	"🐚",
	"🦭",
	"🐟",
	"🐬",
	"🐳"
];
/**
* Encodes an arbitrary byte slice as a string of space-separated bytewords.
*
* Mirrors `bytewords::encode_to_words` in `bc-ur-rust` (≥ v0.19.1). Does not
* add a CRC32 checksum — use {@link encodeBytewords} for UR-style encoding.
*/
function encodeToWords(data) {
	const words = [];
	for (const byte of data) {
		const word = BYTEWORDS[byte];
		if (word === void 0) throw new Error(`Invalid byte value: ${byte}`);
		words.push(word);
	}
	return words.join(" ");
}
/**
* Encodes an arbitrary byte slice as a string of space-separated bytemojis.
*
* Mirrors `bytewords::encode_to_bytemojis` in `bc-ur-rust` (≥ v0.19.1).
*/
function encodeToBytemojis(data) {
	const emojis = [];
	for (const byte of data) {
		const emoji = BYTEMOJIS[byte];
		if (emoji === void 0) throw new Error(`Invalid byte value: ${byte}`);
		emojis.push(emoji);
	}
	return emojis.join(" ");
}
/**
* Encodes an arbitrary byte slice as minimal bytewords (first + last letter of
* each word, concatenated with no separator).
*
* Mirrors `bytewords::encode_to_minimal_bytewords` in `bc-ur-rust`
* (≥ v0.19.1). Does not add a CRC32 checksum.
*/
function encodeToMinimalBytewords(data) {
	let out = "";
	for (const byte of data) {
		const word = BYTEWORDS[byte];
		if (word === void 0) throw new Error(`Invalid byte value: ${byte}`);
		out += word[0] + word[word.length - 1];
	}
	return out;
}
/**
* Encodes a 4-byte slice as a string of bytewords for identification.
*
* Thin wrapper over {@link encodeToWords} that enforces the 4-byte length
* contract historically used by `bc-ur-rust`'s `bytewords::identifier`.
*/
function encodeBytewordsIdentifier(data) {
	if (data.length !== 4) throw new Error("Identifier data must be exactly 4 bytes");
	return encodeToWords(data);
}
/**
* Encodes a 4-byte slice as a string of bytemojis for identification.
*
* Thin wrapper over {@link encodeToBytemojis} that enforces the 4-byte length
* contract historically used by `bc-ur-rust`'s `bytewords::bytemoji_identifier`.
*/
function encodeBytemojisIdentifier(data) {
	if (data.length !== 4) throw new Error("Identifier data must be exactly 4 bytes");
	return encodeToBytemojis(data);
}
/**
* Returns `true` if `emoji` is one of the 256 bytemojis.
*
* Mirrors `bytewords::is_valid_bytemoji` in `bc-ur-rust` (≥ v0.19.1).
*/
function isValidBytemoji(emoji) {
	return BYTEMOJI_SET.has(emoji);
}
/**
* Canonicalises a byteword token (2–4 ASCII letters, case-insensitive) to its
* full 4-letter lowercase form. Returns `undefined` if the token is not a
* valid byteword or any of its short forms.
*
* Mirrors `bytewords::canonicalize_byteword` in `bc-ur-rust` (≥ v0.19.1).
*
* - 2-letter tokens are matched against the first + last letter of each
*   byteword (identical to the minimal bytewords encoding).
* - 3-letter tokens are matched against the first 3 and the last 3 letters of
*   each byteword; if both match different entries, the first-3 match wins
*   (matching rust's `or_else` priority).
* - 4-letter tokens must exactly match a full byteword (after lower-casing).
*/
function canonicalizeByteword(token) {
	const lower = token.toLowerCase();
	switch (lower.length) {
		case 4: return BYTEWORDS_MAP.has(lower) ? lower : void 0;
		case 2: return BYTEWORD_FIRST_LAST_MAP.get(lower);
		case 3: return BYTEWORD_FIRST_THREE_MAP.get(lower) ?? BYTEWORD_LAST_THREE_MAP.get(lower);
		default: return;
	}
}
/**
* Bytewords encoding style.
*/
let BytewordsStyle = /* @__PURE__ */ function(BytewordsStyle) {
	/** Full 4-letter words separated by spaces */
	BytewordsStyle["Standard"] = "standard";
	/** Full 4-letter words separated by hyphens (URI-safe) */
	BytewordsStyle["Uri"] = "uri";
	/** First and last character only (minimal) - used by UR encoding */
	BytewordsStyle["Minimal"] = "minimal";
	return BytewordsStyle;
}({});
/**
* Create a reverse mapping for minimal bytewords (first+last char) lookup.
*/
function createMinimalBytewordsMap() {
	const map = /* @__PURE__ */ new Map();
	BYTEWORDS.forEach((word, index) => {
		const minimal = word[0] + word[3];
		map.set(minimal, index);
	});
	return map;
}
const MINIMAL_BYTEWORDS_MAP = createMinimalBytewordsMap();
/**
* Set of all 256 bytemojis for fast membership testing. Backs
* {@link isValidBytemoji}.
*/
const BYTEMOJI_SET = new Set(BYTEMOJIS);
/**
* Lookup from a 2-letter (first+last) byteword short-form to its full
* lowercase 4-letter form. Backs {@link canonicalizeByteword}.
*/
const BYTEWORD_FIRST_LAST_MAP = (() => {
	const map = /* @__PURE__ */ new Map();
	for (const word of BYTEWORDS) map.set(word[0] + word[word.length - 1], word);
	return map;
})();
/**
* Lookup from the first 3 letters of a byteword to its full lowercase 4-letter
* form. Backs {@link canonicalizeByteword}.
*/
const BYTEWORD_FIRST_THREE_MAP = (() => {
	const map = /* @__PURE__ */ new Map();
	for (const word of BYTEWORDS) map.set(word.slice(0, 3), word);
	return map;
})();
/**
* Lookup from the last 3 letters of a byteword to its full lowercase 4-letter
* form. Backs {@link canonicalizeByteword}.
*/
const BYTEWORD_LAST_THREE_MAP = (() => {
	const map = /* @__PURE__ */ new Map();
	for (const word of BYTEWORDS) map.set(word.slice(1), word);
	return map;
})();
/**
* CRC32 lookup table (IEEE polynomial).
*/
const CRC32_TABLE$1 = (() => {
	const table = [];
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) c = (c & 1) !== 0 ? 3988292384 ^ c >>> 1 : c >>> 1;
		table.push(c >>> 0);
	}
	return table;
})();
/**
* Calculate CRC32 checksum of data.
*/
function crc32(data) {
	let crc = 4294967295;
	for (const byte of data) crc = (CRC32_TABLE$1[(crc ^ byte) & 255] ^ crc >>> 8) >>> 0;
	return (crc ^ 4294967295) >>> 0;
}
/**
* Convert a 32-bit number to 4 bytes (big-endian).
*/
function uint32ToBytes(value) {
	return new Uint8Array([
		value >>> 24 & 255,
		value >>> 16 & 255,
		value >>> 8 & 255,
		value & 255
	]);
}
/**
* Encode data as bytewords with the specified style.
* Includes CRC32 checksum.
*/
function encodeBytewords(data, style = "minimal") {
	const checksumBytes = uint32ToBytes(crc32(data));
	const dataWithChecksum = new Uint8Array(data.length + 4);
	dataWithChecksum.set(data);
	dataWithChecksum.set(checksumBytes, data.length);
	const words = [];
	for (const byte of dataWithChecksum) {
		const word = BYTEWORDS[byte];
		if (word === void 0) throw new Error(`Invalid byte value: ${byte}`);
		switch (style) {
			case "standard":
				words.push(word);
				break;
			case "uri":
				words.push(word);
				break;
			case "minimal": words.push(word[0] + word[3]);
		}
	}
	switch (style) {
		case "standard": return words.join(" ");
		case "uri": return words.join("-");
		case "minimal": return words.join("");
	}
}
/**
* Returns true if every code unit of `s` is in the ASCII range (0..=127).
*
* Mirrors Rust's `str::is_ascii` used at `ur::bytewords::decode` line 105.
* We test the raw code units (rather than Array.from + codepoint) because
* any non-BMP character has surrogate pairs both ≥ 0xD800, which already
* exceed 0x7F.
*/
function isAsciiString(s) {
	for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) return false;
	return true;
}
/**
* Decode bytewords string back to data.
* Validates and removes CRC32 checksum.
*
* Errors mirror the upstream Rust `ur::bytewords::Error` enum
* (`ur-0.4.1/src/bytewords.rs`):
* - `NonAscii` — input contains non-ASCII characters (checked first).
* - `InvalidLength` — minimal-style input has odd length.
* - `InvalidWord` — a token does not map to a byteword index.
* - `InvalidChecksum` — the trailing 4-byte CRC32 does not match.
*
* All variants are surfaced as {@link BytewordsError} with the same default
* `Display` strings as Rust (e.g. "invalid checksum", "non-ASCII"), so
* callers can branch on the error class rather than the bare `Error`
* thrown by earlier revisions of this port.
*/
function decodeBytewords(encoded, style = "minimal") {
	if (!isAsciiString(encoded)) throw new BytewordsError("bytewords string contains non-ASCII characters");
	const lowercased = encoded.toLowerCase();
	let bytes;
	switch (style) {
		case "standard":
			bytes = lowercased.split(" ").map((word) => {
				const index = BYTEWORDS_MAP.get(word);
				if (index === void 0) throw new BytewordsError("invalid word");
				return index;
			});
			break;
		case "uri":
			bytes = lowercased.split("-").map((word) => {
				const index = BYTEWORDS_MAP.get(word);
				if (index === void 0) throw new BytewordsError("invalid word");
				return index;
			});
			break;
		case "minimal":
			if (lowercased.length % 2 !== 0) throw new BytewordsError("invalid length");
			bytes = [];
			for (let i = 0; i < lowercased.length; i += 2) {
				const minimal = lowercased.slice(i, i + 2);
				const index = MINIMAL_BYTEWORDS_MAP.get(minimal);
				if (index === void 0) throw new BytewordsError("invalid word");
				bytes.push(index);
			}
	}
	if (bytes.length < 4) throw new BytewordsError("invalid checksum");
	const dataWithChecksum = new Uint8Array(bytes);
	const data = dataWithChecksum.slice(0, -4);
	const checksumBytes = dataWithChecksum.slice(-4);
	if (crc32(data) !== (checksumBytes[0] << 24 | checksumBytes[1] << 16 | checksumBytes[2] << 8 | checksumBytes[3]) >>> 0) throw new BytewordsError("invalid checksum");
	return data;
}
//#endregion
//#region src/ur-type.ts
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*/
/**
* Represents a UR (Uniform Resource) type identifier.
*
* Valid UR types contain only lowercase letters, digits, and hyphens.
*
* @example
* ```typescript
* const urType = new URType('test');
* console.log(urType.string()); // "test"
* ```
*/
var URType = class URType {
	_type;
	/**
	* Creates a new URType from the provided type string.
	*
	* @param urType - The UR type as a string
	* @throws {InvalidTypeError} If the type contains invalid characters
	*
	* @example
	* ```typescript
	* const urType = new URType('test');
	* ```
	*/
	constructor(urType) {
		if (!isValidURType(urType)) throw new InvalidTypeError();
		this._type = urType;
	}
	/**
	* Returns the string representation of the URType.
	*
	* @example
	* ```typescript
	* const urType = new URType('test');
	* console.log(urType.string()); // "test"
	* ```
	*/
	string() {
		return this._type;
	}
	/**
	* Checks equality with another URType based on the type string.
	*/
	equals(other) {
		return this._type === other._type;
	}
	/**
	* Returns the string representation.
	*/
	toString() {
		return this._type;
	}
	/**
	* Creates a URType from a string, throwing an error if invalid.
	*
	* @param value - The UR type string
	* @returns A new URType instance
	* @throws {InvalidTypeError} If the type is invalid
	*/
	static from(value) {
		return new URType(value);
	}
	/**
	* Safely creates a URType, returning a typed `Result`-shaped
	* discriminated union instead of throwing.
	*
	* Mirrors Rust `impl TryFrom<&str> for URType` /
	* `impl TryFrom<String> for URType` (`bc-ur-rust/src/ur_type.rs`),
	* which return `Result<URType, Error>`. The TS shape is the
	* idiomatic discriminated form so callers can branch on `ok`
	* without `instanceof`:
	*
	* @example
	* ```typescript
	* const r = URType.tryFrom("test");
	* if (r.ok) {
	*   console.log(r.value.string()); // "test"
	* } else {
	*   console.error(r.error.message);
	* }
	* ```
	*
	* @param value - The UR type string
	* @returns A typed Result: `{ ok: true; value: URType }` on success,
	*   `{ ok: false; error: InvalidTypeError }` on failure.
	*/
	static tryFrom(value) {
		try {
			return {
				ok: true,
				value: new URType(value)
			};
		} catch (error) {
			return {
				ok: false,
				error
			};
		}
	}
};
//#endregion
//#region src/ur.ts
/**
* A Uniform Resource (UR) is a URI-encoded CBOR object.
*
* URs are defined in [BCR-2020-005: Uniform Resources](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md).
*
* @example
* ```typescript
* import { UR } from '@blockchaincommons/uniform-resources';
* import { CBOR } from '@blockchaincommons/dcbor-compat';
*
* // Create a UR from a CBOR object
* const cbor = CBOR.fromArray([1, 2, 3]);
* const ur = UR.new('test', cbor);
*
* // Encode to string
* const urString = ur.string();
* console.log(urString); // "ur:test/..."
*
* // Decode from string
* const decodedUR = UR.fromURString(urString);
* console.log(decodedUR.urTypeStr()); // "test"
* ```
*/
var UR = class UR {
	_urType;
	_cbor;
	/**
	* Creates a new UR from the provided type and CBOR data.
	*
	* @param urType - The UR type (will be validated)
	* @param cbor - The CBOR data to encode
	* @throws {InvalidTypeError} If the type is invalid
	*
	* @example
	* ```typescript
	* const ur = UR.new('bytes', CBOR.fromString('hello'));
	* ```
	*/
	static new(urType, cbor) {
		const type = typeof urType === "string" ? new URType(urType) : urType;
		return new UR(type, cbor);
	}
	/**
	* Creates a new UR from a UR string.
	*
	* Mirrors Rust's `UR::from_ur_string` (`bc-ur-rust/src/ur.rs:25-38`):
	* 1. lowercase the entire string.
	* 2. strip the `"ur:"` prefix → {@link InvalidSchemeError} if absent.
	* 3. split on the first `/` → {@link TypeUnspecifiedError} if absent.
	* 4. validate the type via {@link URType} → {@link InvalidTypeError}.
	* 5. delegate the data section to the upstream-style decoder, which
	*    classifies the UR as single- or multi-part. Multi-part input is
	*    rejected with {@link NotSinglePartError}.
	* 6. decode the bytewords payload (CRC32 + minimal mapping) →
	*    {@link BytewordsError} on failure.
	* 7. parse the resulting bytes as CBOR → {@link CBORError} on failure.
	*
	* @param urString - A UR string like "ur:test/..."
	* @throws {InvalidSchemeError} If the string doesn't start with "ur:"
	* @throws {TypeUnspecifiedError} If no `/` separator is present
	* @throws {InvalidTypeError} If the type contains invalid characters
	* @throws {NotSinglePartError} If the UR is multi-part
	* @throws {URDecodeError} For upstream-decoder errors (invalid indices, etc.)
	* @throws {BytewordsError} If bytewords decoding fails
	* @throws {CBORError} If CBOR parsing fails
	*
	* @example
	* ```typescript
	* const ur = UR.fromURString('ur:test/lsadaoaxjygonesw');
	* ```
	*/
	static fromURString(urString) {
		const { urType, cbor } = URStringDecoder.decode(urString);
		return new UR(urType, cbor);
	}
	constructor(urType, cbor) {
		this._urType = urType;
		this._cbor = cbor;
	}
	/**
	* Returns the UR type.
	*/
	urType() {
		return this._urType;
	}
	/**
	* Returns the UR type as a string.
	*/
	urTypeStr() {
		return this._urType.string();
	}
	/**
	* Returns the CBOR data.
	*/
	cbor() {
		return this._cbor;
	}
	/**
	* Returns the string representation of the UR (lowercase, suitable for display).
	*
	* @example
	* ```typescript
	* const ur = UR.new('test', CBOR.fromArray([1, 2, 3]));
	* console.log(ur.string()); // "ur:test/lsadaoaxjygonesw"
	* ```
	*/
	string() {
		const cborData = this._cbor.toData();
		return URStringEncoder.encode(this._urType.string(), cborData);
	}
	/**
	* Returns the QR string representation (uppercase, most efficient for QR codes).
	*/
	qrString() {
		return this.string().toUpperCase();
	}
	/**
	* Returns the QR data as bytes (uppercase UR string as UTF-8).
	*
	* Mirrors Rust's `UR::qr_data` (`ur.rs:52`) which does
	* `self.qr_string().as_bytes().to_vec()` — the string's UTF-8 byte
	* representation. We use `TextEncoder` rather than per-codepoint
	* truncation so the behaviour stays correct if the QR string ever
	* contains non-ASCII characters.
	*/
	qrData() {
		return new TextEncoder().encode(this.qrString());
	}
	/**
	* Checks if the UR type matches the expected type.
	*
	* @param expectedType - The expected type
	* @throws {UnexpectedTypeError} If the types don't match
	*/
	checkType(expectedType) {
		const expected = typeof expectedType === "string" ? new URType(expectedType) : expectedType;
		if (!this._urType.equals(expected)) throw new UnexpectedTypeError(expected.string(), this._urType.string());
	}
	/**
	* Returns the string representation.
	*/
	toString() {
		return this.string();
	}
	/**
	* Checks equality with another UR.
	*
	* Mirrors Rust's derived `PartialEq for UR` which compares the inner
	* `ur_type` and the inner `cbor` field directly. We compare CBOR
	* bytewise — `Uint8Array` equality, not `Array#toString` (which would
	* coerce to a comma-joined string and could collide on pathological
	* inputs).
	*/
	equals(other) {
		if (!this._urType.equals(other._urType)) return false;
		const a = this._cbor.toData();
		const b = other._cbor.toData();
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
		return true;
	}
};
/**
* Encodes a UR string using Bytewords minimal encoding.
* This handles single-part URs according to BCR-2020-005.
*/
var URStringEncoder = class {
	static encode(urType, cborData) {
		return `ur:${urType}/${encodeBytewords(cborData, "minimal")}`;
	}
};
/**
* Decodes a UR string back to its components.
*
* Mirrors the validation pipeline of Rust's `UR::from_ur_string`
* (`bc-ur-rust/src/ur.rs:25-38`) plus the upstream `ur::decode`
* (`ur-0.4.1/src/ur.rs:238-266`):
*
*   1. lowercase
*   2. strip `"ur:"`               → {@link InvalidSchemeError}
*   3. find `/`                     → {@link TypeUnspecifiedError}
*   4. validate the type            → {@link InvalidTypeError}
*   5. classify single- vs multi-part by looking at the data section
*   6. multi-part                   → {@link NotSinglePartError}
*   7. invalid multi-part indices   → {@link URDecodeError("Invalid indices")}
*   8. minimal bytewords decode     → {@link BytewordsError}
*   9. CBOR parse                   → {@link CBORError}
*/
var URStringDecoder = class {
	static decode(urString) {
		const lowercased = urString.toLowerCase();
		if (!lowercased.startsWith("ur:")) throw new InvalidSchemeError();
		const afterScheme = lowercased.substring(3);
		const slashIdx = afterScheme.indexOf("/");
		if (slashIdx === -1) throw new TypeUnspecifiedError();
		const typeStr = afterScheme.substring(0, slashIdx);
		const dataSection = afterScheme.substring(slashIdx + 1);
		const urType = new URType(typeStr);
		const lastSlash = dataSection.lastIndexOf("/");
		if (lastSlash !== -1) {
			const indices = dataSection.substring(0, lastSlash);
			const dashIdx = indices.indexOf("-");
			if (dashIdx === -1) throw new URDecodeError("Invalid indices");
			const seqNumStr = indices.substring(0, dashIdx);
			const seqLenStr = indices.substring(dashIdx + 1);
			if (!/^\d+$/.test(seqNumStr) || !/^\d+$/.test(seqLenStr)) throw new URDecodeError("Invalid indices");
			const seqNum = Number(seqNumStr);
			const seqLen = Number(seqLenStr);
			if (seqNum > 65535 || seqLen > 65535) throw new URDecodeError("Invalid indices");
			throw new NotSinglePartError();
		}
		let cborData;
		try {
			cborData = decodeBytewords(dataSection, "minimal");
		} catch (error) {
			if (error instanceof BytewordsError) throw error;
			throw new BytewordsError(error instanceof Error ? error.message : String(error));
		}
		let cbor;
		try {
			cbor = decodeCbor(cborData);
		} catch (error) {
			if (error instanceof CBORError) throw error;
			throw new CBORError(error instanceof Error ? error.message : String(error));
		}
		return {
			urType,
			cbor
		};
	}
};
//#endregion
//#region src/ur-encodable.ts
/**
* Concrete equivalent of Rust's default `UREncodable::ur` impl
* (`bc-ur-rust/src/ur_encodable.rs:8-18`):
*
* - Reads the first tag returned by `encodable.cborTags()`.
* - Uses that tag's `name` as the UR type, throwing if no name is set —
*   matching Rust's `panic!("CBOR tag {} must have a name. Did you call
*   `register_tags()`?", tag.value())`.
* - Wraps the encodable's `untaggedCbor()` in a fresh {@link UR} bound to
*   that type.
*
* Use from a class implementing both `UREncodable` and
* `CborTaggedEncodable` to skip writing the boilerplate yourself.
*/
function urFromEncodable(encodable) {
	const tag = encodable.cborTags()[0];
	if (tag === void 0) throw new Error("UREncodable: cborTags() returned no tags");
	if (tag.name === void 0) throw new Error(`CBOR tag ${tag.value} must have a name. Did you call register_tags()?`);
	return UR.new(tag.name, encodable.untaggedCbor());
}
/**
* Concrete equivalent of Rust's default `UREncodable::ur_string` impl
* (`bc-ur-rust/src/ur_encodable.rs:21`): `self.ur().string()`.
*/
function urStringFromEncodable(encodable) {
	return urFromEncodable(encodable).string();
}
/**
* Helper function to check if an object implements UREncodable.
*/
function isUREncodable(obj) {
	return typeof obj === "object" && obj !== null && "ur" in obj && "urString" in obj && typeof obj["ur"] === "function" && typeof obj["urString"] === "function";
}
//#endregion
//#region src/ur-decodable.ts
/**
* Concrete equivalent of Rust's default `URDecodable::from_ur` impl
* (`bc-ur-rust/src/ur_decodable.rs:7-15`):
*
*   1. Read the first tag returned by `decodable.cborTags()`.
*   2. Verify the UR's type matches that tag's name via `UR#checkType`
*      (this is what Rust's `ur.check_type(...)` does — surface
*      `UnexpectedTypeError` on mismatch).
*   3. Delegate to `decodable.fromUntaggedCbor(ur.cbor())`.
*
* Use from a class implementing both `URDecodable` and
* `CborTaggedDecodable<T>` to skip the type-check / delegate boilerplate.
*/
function decodableFromUR(decodable, ur) {
	const tag = decodable.cborTags()[0];
	if (tag === void 0) throw new Error("URDecodable: cborTags() returned no tags");
	if (tag.name === void 0) throw new Error(`CBOR tag ${tag.value} must have a name. Did you call register_tags()?`);
	ur.checkType(tag.name);
	return decodable.fromUntaggedCbor(ur.cbor());
}
/**
* Concrete equivalent of Rust's default `URDecodable::from_ur_string` impl
* (`bc-ur-rust/src/ur_decodable.rs:17-22`):
* `Self::from_ur(UR::from_ur_string(s)?)`.
*/
function decodableFromURString(decodable, urString) {
	return decodableFromUR(decodable, UR.fromURString(urString));
}
/**
* Helper function to check if an object implements URDecodable.
*/
function isURDecodable(obj) {
	return typeof obj === "object" && obj !== null && "fromUR" in obj && typeof obj["fromUR"] === "function";
}
//#endregion
//#region src/ur-codable.ts
/**
* Helper function to check if an object implements URCodable.
*/
function isURCodable(obj) {
	return typeof obj === "object" && obj !== null && "ur" in obj && "urString" in obj && "fromUR" in obj && typeof obj["ur"] === "function" && typeof obj["urString"] === "function" && typeof obj["fromUR"] === "function";
}
//#endregion
//#region ../bc-crypto-ts/node_modules/@noble/hashes/_u64.js
const fromNumH = (n) => n / 2 ** 32 | 0;
const fromNumL = (n) => n >>> 0;
function setU64FromNum(view, byteOffset, n, isLE) {
	const h = fromNumH(n);
	const l = fromNumL(n);
	view.setUint32(byteOffset, isLE ? l : h, isLE);
	view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
}
//#endregion
//#region ../bc-crypto-ts/node_modules/@noble/hashes/utils.js
/**
* Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
* @param a - value to test
* @returns `true` when the value is a Uint8Array-compatible view.
* @example
* Check whether a value is a Uint8Array-compatible view.
* ```ts
* isBytes(new Uint8Array([1, 2, 3]));
* ```
*/
function isBytes(a) {
	return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
const atitle = (title) => title ? `"${title}" ` : "";
/**
* Asserts something is a non-negative integer.
* @param n - number to validate
* @param title - label included in thrown errors
* @returns The validated number.
* @throws On wrong argument types. {@link TypeError}
* @throws On wrong argument ranges or values. {@link RangeError}
* @example
* Validate a non-negative integer option.
* ```ts
* anumber(32, 'length');
* ```
*/
function anumber(n, title = "") {
	if (typeof n !== "number") throw new TypeError(atitle(title) + "expected number, got " + typeof n);
	if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
	return n;
}
/**
* Asserts something is Uint8Array.
* @param value - value to validate
* @param length - optional exact length constraint
* @param title - label included in thrown errors
* @returns The validated byte array.
* @throws On wrong argument types. {@link TypeError}
* @throws On wrong argument ranges or values. {@link RangeError}
* @example
* Validate that a value is a byte array.
* ```ts
* abytes(new Uint8Array([1, 2, 3]));
* ```
*/
function abytes(value, length, title = "") {
	if (isBytes(value) && (length === void 0 || value.length === length)) return value;
	if (length !== void 0) anumber(length, "length");
	const bytes = isBytes(value);
	const ofLen = length !== void 0 ? ` of length ${length}` : "";
	const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
	const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
	if (!bytes) throw new TypeError(message);
	throw new RangeError(message);
}
const aobject = (value, label) => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
};
const aopts = (value, label) => {
	aobject(value, label);
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) throw new TypeError(`"${label}" expected plain object`);
	if (Object.hasOwn(value, "__proto__")) throw new TypeError(`"${label}.__proto__" is not allowed`);
};
/**
* Asserts a hash instance has not been destroyed or finished.
* @param instance - hash instance to validate
* @param checkFinished - whether to reject finalized instances
* @throws If the hash instance has already been destroyed or finalized. {@link Error}
* @example
* Validate that a hash instance is still usable.
* ```ts
* import { aexists } from '@noble/hashes/utils.js';
* import { sha256 } from '@noble/hashes/sha2.js';
* const hash = sha256.create();
* aexists(hash);
* ```
*/
function aexists(instance, checkFinished = true) {
	if (instance.destroyed) throw new Error("hash was destroyed");
	if (checkFinished && instance.finished) throw new Error("digest() was already called");
}
/**
* Asserts output is a sufficiently-sized byte array.
* @param out - destination buffer
* @param instance - hash instance providing output length
* Oversized buffers are allowed; downstream code only promises to fill the first `outputLen` bytes.
* @throws On wrong argument types. {@link TypeError}
* @throws On wrong argument ranges or values. {@link RangeError}
* @example
* Validate a caller-provided digest buffer.
* ```ts
* import { aoutput } from '@noble/hashes/utils.js';
* import { sha256 } from '@noble/hashes/sha2.js';
* const hash = sha256.create();
* aoutput(new Uint8Array(hash.outputLen), hash);
* ```
*/
function aoutput(out, instance) {
	abytes(out, void 0, "output");
	const min = instance.outputLen;
	if (!(out.length >= min)) throw new RangeError("\"output\" expected length >= " + min);
}
/**
* Zeroizes typed arrays in place. Warning: JS provides no guarantees.
* @param arrays - arrays to overwrite with zeros
* @example
* Zeroize sensitive buffers in place.
* ```ts
* clean(new Uint8Array([1, 2, 3]));
* ```
*/
function clean(...arrays) {
	for (let i = 0; i < arrays.length; i++) arrays[i].fill(0);
}
/**
* Creates a DataView for byte-level manipulation.
* @param arr - source typed array
* @returns DataView over the same buffer region.
* @example
* Create a DataView over an existing buffer.
* ```ts
* createView(new Uint8Array(4));
* ```
*/
function createView(arr) {
	return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
* Rotate-right operation for uint32 values.
* @param word - source word
* @param shift - shift amount in bits
* @returns Rotated word.
* @example
* Rotate a 32-bit word to the right.
* ```ts
* rotr(0x12345678, 8);
* ```
*/
function rotr(word, shift) {
	return word << 32 - shift | word >>> shift;
}
/**
* Merges default options and passed options.
* @param defaults - base option object
* @param opts - user overrides
* @param title - label included in thrown override errors
* @returns Fresh merged option object with a null prototype.
* @throws On wrong argument types. {@link TypeError}
* @example
* Merge user overrides onto default options.
* ```ts
* checkOpts({ dkLen: 32 }, { asyncTick: 10 });
* ```
*/
function checkOpts(defaults, opts, title = "opts") {
	aopts(defaults, "defaults");
	if (opts !== void 0) aopts(opts, title);
	return Object.assign(Object.create(null), defaults, opts);
}
/**
* Creates a callable hash function from a stateful class constructor.
* @param hashCons - hash constructor or factory
* @param info - optional metadata such as DER OID
* @returns Frozen callable hash wrapper with `.create()`.
*   Wrapper construction eagerly calls `hashCons(undefined)` once to read
*   `outputLen` / `blockLen`, so constructor side effects happen at module
*   init time.
* @throws On wrong argument types. {@link TypeError}
* @example
* Wrap a stateful hash constructor into a callable helper.
* ```ts
* import { createHasher } from '@noble/hashes/utils.js';
* import { sha256 } from '@noble/hashes/sha2.js';
* const wrapped = createHasher(sha256.create, { oid: sha256.oid });
* wrapped(new Uint8Array([1]));
* ```
*/
function createHasher(hashCons, info = {}) {
	if (typeof hashCons !== "function") throw new TypeError("\"hashCons\" expected function, got type=" + typeof hashCons);
	info = checkOpts({}, info, "info");
	const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
	const tmp = hashCons(void 0);
	hashC.outputLen = tmp.outputLen;
	hashC.blockLen = tmp.blockLen;
	hashC.canXOF = tmp.canXOF;
	hashC.create = (opts) => hashCons(opts);
	Object.assign(hashC, info);
	return Object.freeze(hashC);
}
/**
* Creates OID metadata for NIST hashes with prefix `06 09 60 86 48 01 65 03 04 02`.
* @param suffix - final OID byte for the selected hash.
*   The helper accepts any byte even though only the documented NIST hash
*   suffixes are meaningful downstream.
* @returns Object containing the DER-encoded OID.
* @example
* Build OID metadata for a NIST hash.
* ```ts
* oidNist(0x01);
* ```
*/
const oidNist = (suffix) => ({ oid: Uint8Array.from([
	6,
	9,
	96,
	134,
	72,
	1,
	101,
	3,
	4,
	2,
	suffix
]) });
//#endregion
//#region ../bc-crypto-ts/node_modules/@noble/hashes/_md.js
/**
* Internal Merkle-Damgard hash utils.
* @module
*/
/**
* Shared 32-bit conditional boolean primitive reused by SHA-256, SHA-1, and MD5 `F`.
* Returns bits from `b` when `a` is set, otherwise from `c`.
* The XOR form is equivalent to MD5's `F(X,Y,Z) = XY v not(X)Z` because the masked terms never
* set the same bit.
* @param a - selector word
* @param b - word chosen when selector bit is set
* @param c - word chosen when selector bit is clear
* @returns Mixed 32-bit word.
* @example
* Combine three words with the shared 32-bit choice primitive.
* ```ts
* Chi(0xffffffff, 0x12345678, 0x87654321);
* ```
*/
function Chi(a, b, c) {
	return a & b ^ ~a & c;
}
/**
* Shared 32-bit majority primitive reused by SHA-256 and SHA-1.
* Returns bits shared by at least two inputs.
* @param a - first input word
* @param b - second input word
* @param c - third input word
* @returns Mixed 32-bit word.
* @example
* Combine three words with the shared 32-bit majority primitive.
* ```ts
* Maj(0xffffffff, 0x12345678, 0x87654321);
* ```
*/
function Maj(a, b, c) {
	return a & b ^ a & c ^ b & c;
}
/**
* Merkle-Damgard hash construction base class.
* Could be used to create MD5, RIPEMD, SHA1, SHA2.
* Accepts only byte-aligned `Uint8Array` input, even when the underlying spec describes bit
* strings with partial-byte tails.
* @param blockLen - internal block size in bytes
* @param outputLen - digest size in bytes
* @param padOffset - trailing length field size in bytes
* @param isLE - whether length and state words are encoded in little-endian
* @example
* Use a concrete subclass to get the shared Merkle-Damgard update/digest flow.
* ```ts
* import { _SHA1 } from '@noble/hashes/legacy.js';
* const hash = new _SHA1();
* hash.update(new Uint8Array([97, 98, 99]));
* hash.digest();
* ```
*/
var HashMD = class {
	blockLen;
	outputLen;
	canXOF = false;
	padOffset;
	isLE;
	buffer;
	view;
	finished = false;
	length = 0;
	pos = 0;
	destroyed = false;
	constructor(blockLen, outputLen, padOffset, isLE) {
		this.blockLen = blockLen;
		this.outputLen = outputLen;
		this.padOffset = padOffset;
		this.isLE = isLE;
		this.buffer = new Uint8Array(blockLen);
		this.view = createView(this.buffer);
	}
	update(data) {
		aexists(this);
		abytes(data);
		const { view, buffer, blockLen } = this;
		const len = data.length;
		let processed = false;
		for (let pos = 0; pos < len;) {
			const take = Math.min(blockLen - this.pos, len - pos);
			if (take === blockLen) {
				const dataView = createView(data);
				for (; blockLen <= len - pos; pos += blockLen) this.process(dataView, pos);
				processed = true;
				continue;
			}
			buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
			this.pos += take;
			pos += take;
			if (this.pos === blockLen) {
				this.process(view, 0);
				this.pos = 0;
				processed = true;
			}
		}
		this.length += data.length;
		if (processed) this.roundClean();
		return this;
	}
	digestInto(out) {
		aexists(this);
		aoutput(out, this);
		this.finished = true;
		const { buffer, view, blockLen, isLE } = this;
		let { pos } = this;
		buffer[pos++] = 128;
		buffer.fill(0, pos);
		if (this.padOffset > blockLen - pos) {
			this.process(view, 0);
			buffer.fill(0);
		}
		setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
		this.process(view, 0);
		this.roundClean();
		const oview = out === buffer ? view : createView(out);
		const len = this.outputLen;
		const outLen = len / 4;
		const state = this.get();
		if (len % 4 || outLen > state.length) throw new Error("invalid outputLen");
		for (let i = 0; i < outLen; i++) oview.setUint32(4 * i, state[i], isLE);
	}
	digest() {
		const { buffer, outputLen } = this;
		this.digestInto(buffer);
		const res = buffer.slice(0, outputLen);
		this.destroy();
		return res;
	}
	_cloneIntoMeta(to) {
		const { buffer, length, finished, destroyed, pos } = this;
		to.destroyed = destroyed;
		to.finished = finished;
		to.length = length;
		to.pos = pos;
		if (pos) to.buffer.set(buffer);
		return to;
	}
	clone() {
		return this._cloneInto();
	}
};
/**
* Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
* Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
*/
/** Initial SHA256 state from RFC 6234 §6.1: the first 32 bits of the fractional parts of the
* square roots of the first eight prime numbers. Exported as a shared table; callers must treat
* it as read-only because constructors copy words from it by index. */
const SHA256_IV = /* @__PURE__ */ Uint32Array.from([
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
]);
//#endregion
//#region ../bc-crypto-ts/node_modules/@noble/hashes/sha2.js
/**
* SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
* SHA256 is the fastest hash implementable in JS, even faster than Blake3.
* Check out {@link https://www.rfc-editor.org/rfc/rfc4634 | RFC 4634} and
* {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf | FIPS 180-4}.
* @module
*/
/**
* SHA-224 / SHA-256 round constants from RFC 6234 §5.1: the first 32 bits
* of the cube roots of the first 64 primes (2..311).
*/
const SHA256_K = /* @__PURE__ */ Uint32Array.from([
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
]);
/** Reusable SHA-224 / SHA-256 message schedule buffer `W_t` from RFC 6234 §6.2 step 1. */
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
/** Internal SHA-224 / SHA-256 compression engine from RFC 6234 §6.2. */
var SHA2_32B = class extends HashMD {
	A = 0;
	B = 0;
	C = 0;
	D = 0;
	E = 0;
	F = 0;
	G = 0;
	H = 0;
	constructor(outputLen, IV) {
		super(64, outputLen, 8, false);
		this.A = IV[0] | 0;
		this.B = IV[1] | 0;
		this.C = IV[2] | 0;
		this.D = IV[3] | 0;
		this.E = IV[4] | 0;
		this.F = IV[5] | 0;
		this.G = IV[6] | 0;
		this.H = IV[7] | 0;
	}
	get() {
		const { A, B, C, D, E, F, G, H } = this;
		return [
			A,
			B,
			C,
			D,
			E,
			F,
			G,
			H
		];
	}
	set(A, B, C, D, E, F, G, H) {
		this.A = A | 0;
		this.B = B | 0;
		this.C = C | 0;
		this.D = D | 0;
		this.E = E | 0;
		this.F = F | 0;
		this.G = G | 0;
		this.H = H | 0;
	}
	_cloneInto(to) {
		(to ||= new this.constructor()).set(...this.get());
		return this._cloneIntoMeta(to);
	}
	process(view, offset) {
		for (let i = 0; i < 16; i++, offset += 4) SHA256_W[i] = view.getUint32(offset, false);
		for (let i = 16; i < 64; i++) {
			const W15 = SHA256_W[i - 15];
			const W2 = SHA256_W[i - 2];
			const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
			const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
			SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
		}
		let { A, B, C, D, E, F, G, H } = this;
		for (let i = 0; i < 64; i++) {
			const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
			const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
			const T2 = (rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22)) + Maj(A, B, C) | 0;
			H = G;
			G = F;
			F = E;
			E = D + T1 | 0;
			D = C;
			C = B;
			B = A;
			A = T1 + T2 | 0;
		}
		A = A + this.A | 0;
		B = B + this.B | 0;
		C = C + this.C | 0;
		D = D + this.D | 0;
		E = E + this.E | 0;
		F = F + this.F | 0;
		G = G + this.G | 0;
		H = H + this.H | 0;
		this.set(A, B, C, D, E, F, G, H);
	}
	roundClean() {
		clean(SHA256_W);
	}
	destroy() {
		this.destroyed = true;
		this.set(0, 0, 0, 0, 0, 0, 0, 0);
		clean(this.buffer);
	}
};
/** Internal SHA-256 hash class grounded in RFC 6234 §6.2. */
var _SHA256 = class extends SHA2_32B {
	constructor() {
		super(32, SHA256_IV);
	}
};
/**
* SHA2-256 hash function from RFC 4634. In JS it's the fastest: even faster than Blake3. Some info:
*
* - Trying 2^128 hashes would get 50% chance of collision, using birthday attack.
* - BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
* - Each sha256 hash is executing 2^18 bit operations.
* - Good 2024 ASICs can do 200Th/sec with 3500 watts of power, corresponding to 2^36 hashes/joule.
* @param msg - message bytes to hash
* @param opts - Reserved hash options.
* @returns Digest bytes.
* @example
* Hash a message with SHA2-256.
* ```ts
* sha256(new Uint8Array([97, 98, 99]));
* ```
*/
const sha256$1 = /* @__PURE__ */ createHasher(() => new _SHA256(), /* @__PURE__ */ oidNist(1));
//#endregion
//#region ../bc-crypto-ts/tests/baseline/crypto-baseline.mjs
const CRC32_TABLE = /* @__PURE__ */ new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let crc = i;
	for (let j = 0; j < 8; j++) crc = (crc & 1) !== 0 ? crc >>> 1 ^ 3988292384 : crc >>> 1;
	CRC32_TABLE[i] = crc >>> 0;
}
/**
* Calculate SHA-256 hash
*/
function sha256(data) {
	return sha256$1(data);
}
//#endregion
//#region src/xoshiro.ts
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Xoshiro256** PRNG implementation.
*
* This is a high-quality, fast pseudo-random number generator used
* for deterministic fragment selection in fountain codes.
*
* Reference: https://prng.di.unimi.it/
* BC-UR Reference: https://github.com/nicklockwood/fountain-codes
*/
const MAX_UINT64 = BigInt("0xffffffffffffffff");
/**
* Performs a left rotation on a 64-bit BigInt.
*/
function rotl(x, k) {
	const kBigInt = BigInt(k);
	return (x << kBigInt | x >> 64n - kBigInt) & MAX_UINT64;
}
/**
* Xoshiro256** pseudo-random number generator.
*
* This PRNG is used for deterministic mixing in fountain codes,
* allowing both encoder and decoder to agree on which fragments
* are combined without transmitting that information.
*/
var Xoshiro256 = class Xoshiro256 {
	s;
	/**
	* Creates a new Xoshiro256** instance from a 32-byte seed.
	*
	* The seed must be exactly 32 bytes (256 bits). The bytes are interpreted
	* using the BC-UR reference algorithm: each 8-byte chunk is read as
	* big-endian then stored as little-endian for the state.
	*
	* @param seed - The seed bytes (must be exactly 32 bytes)
	*/
	constructor(seed) {
		if (seed.length !== 32) throw new Error(`Seed must be 32 bytes, got ${seed.length}`);
		const s = [
			0n,
			0n,
			0n,
			0n
		];
		for (let i = 0; i < 4; i++) {
			let v = 0n;
			for (let n = 0; n < 8; n++) v = v << 8n | BigInt(seed[8 * i + n] ?? 0);
			s[i] = v;
		}
		this.s = s;
	}
	/**
	* Creates a Xoshiro256** instance from raw state values.
	* Useful for seeding with specific values.
	*/
	static fromState(s0, s1, s2, s3) {
		const instance = Object.create(Xoshiro256.prototype);
		instance.s = [
			s0,
			s1,
			s2,
			s3
		];
		return instance;
	}
	/**
	* Generates the next 64-bit random value.
	*/
	next() {
		const result = rotl(this.s[1] * 5n & MAX_UINT64, 7) * 9n & MAX_UINT64;
		const t = this.s[1] << 17n & MAX_UINT64;
		this.s[2] ^= this.s[0];
		this.s[3] ^= this.s[1];
		this.s[1] ^= this.s[2];
		this.s[0] ^= this.s[3];
		this.s[2] ^= t;
		this.s[3] = rotl(this.s[3], 45);
		return result;
	}
	/**
	* Generates a random double in [0, 1).
	* Matches BC-UR reference: self.next() as f64 / (u64::MAX as f64 + 1.0)
	*/
	nextDouble() {
		const value = this.next();
		return Number(value) / 0x10000000000000000;
	}
	/**
	* Generates a random integer in [low, high] (inclusive).
	* Matches BC-UR reference: (self.next_double() * ((high - low + 1) as f64)) as u64 + low
	*/
	nextInt(low, high) {
		const range = high - low + 1;
		return Math.floor(this.nextDouble() * range) + low;
	}
	/**
	* Generates a random byte [0, 255].
	*
	* Mirrors Rust `Xoshiro256::next_byte` (`ur-0.4.1/src/xoshiro.rs:91`):
	*   `self.next_int(0, 255) as u8`
	* This goes through `next_double() * 256.0`, which effectively uses
	* the top 8 bits of the f64-converted u64 — NOT the low 8 bits
	* of the raw `next()` output. Earlier the TS port used `next() & 0xff`,
	* which produced a completely different byte sequence than Rust for
	* the same seeded RNG.
	*/
	nextByte() {
		return this.nextInt(0, 255);
	}
	/**
	* Generates an array of random bytes.
	*
	* Mirrors Rust `Xoshiro256::next_bytes` (`ur-0.4.1/src/xoshiro.rs:95-97`):
	*   `(0..n).map(|_| self.next_byte()).collect()`
	*/
	nextData(count) {
		const result = new Uint8Array(count);
		for (let i = 0; i < count; i++) result[i] = this.nextByte();
		return result;
	}
	/**
	* Shuffles items by repeatedly picking random indices.
	* Matches BC-UR reference implementation.
	*/
	shuffled(items) {
		const source = [...items];
		const shuffled = [];
		while (source.length > 0) {
			const index = this.nextInt(0, source.length - 1);
			const item = source.splice(index, 1)[0];
			if (item !== void 0) shuffled.push(item);
		}
		return shuffled;
	}
	/**
	* Chooses the degree (number of fragments to mix) using a weighted sampler.
	* Uses the robust soliton distribution with weights [1/1, 1/2, 1/3, ..., 1/n].
	* Matches BC-UR reference implementation.
	*/
	chooseDegree(seqLen) {
		const weights = [];
		for (let i = 1; i <= seqLen; i++) weights.push(1 / i);
		return new WeightedSampler(weights).next(this) + 1;
	}
};
/**
* Weighted sampler using Vose's alias method.
* Allows O(1) sampling from a discrete probability distribution.
*/
var WeightedSampler = class {
	aliases;
	probs;
	constructor(weights) {
		const n = weights.length;
		if (weights.some((w) => w < 0)) throw new Error("negative probability encountered");
		const sum = weights.reduce((a, b) => a + b, 0);
		if (!(sum > 0)) throw new Error("probabilities don't sum to a positive value");
		const normalized = weights.map((w) => w * n / sum);
		this.aliases = Array.from({ length: n }).fill(0);
		this.probs = Array.from({ length: n }).fill(0);
		const small = [];
		const large = [];
		for (let i = n - 1; i >= 0; i--) if (normalized[i] < 1) small.push(i);
		else large.push(i);
		while (small.length > 0 && large.length > 0) {
			const a = small.pop();
			const g = large.pop();
			if (a === void 0 || g === void 0) break;
			this.probs[a] = normalized[a] ?? 0;
			this.aliases[a] = g;
			normalized[g] = (normalized[g] ?? 0) + (normalized[a] ?? 0) - 1;
			if (normalized[g] !== void 0 && normalized[g] < 1) small.push(g);
			else large.push(g);
		}
		while (large.length > 0) {
			const g = large.pop();
			if (g === void 0) break;
			this.probs[g] = 1;
		}
		while (small.length > 0) {
			const a = small.pop();
			if (a === void 0) break;
			this.probs[a] = 1;
		}
	}
	/**
	* Sample from the distribution.
	*/
	next(rng) {
		const r1 = rng.nextDouble();
		const r2 = rng.nextDouble();
		const n = this.probs.length;
		const i = Math.floor(n * r1);
		if (r2 < this.probs[i]) return i;
		else return this.aliases[i];
	}
};
/**
* Creates a Xoshiro256 PRNG instance from message checksum and sequence number.
*
* This creates an 8-byte seed by concatenating seqNum and checksum (both in
* big-endian), then hashes it with SHA-256 to get the 32-byte seed for Xoshiro.
*
* This matches the BC-UR reference implementation.
*/
function createSeed(checksum, seqNum) {
	const seed8 = /* @__PURE__ */ new Uint8Array(8);
	seed8[0] = seqNum >>> 24 & 255;
	seed8[1] = seqNum >>> 16 & 255;
	seed8[2] = seqNum >>> 8 & 255;
	seed8[3] = seqNum & 255;
	seed8[4] = checksum >>> 24 & 255;
	seed8[5] = checksum >>> 16 & 255;
	seed8[6] = checksum >>> 8 & 255;
	seed8[7] = checksum & 255;
	return sha256(seed8);
}
//#endregion
//#region src/fountain.ts
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*
* Fountain code implementation for multipart URs.
*
* This implements a hybrid fixed-rate and rateless fountain code system
* as specified in BCR-2020-005 and BCR-2024-001.
*
* Key concepts:
* - Parts 1-seqLen are "pure" fragments (fixed-rate)
* - Parts > seqLen are "mixed" fragments using XOR (rateless)
* - Xoshiro256** PRNG ensures encoder/decoder agree on mixing
*/
/**
* Calculates the quotient of `a` and `b`, rounded toward positive infinity.
*
* Mirrors Rust `ur-0.4.1/src/fountain.rs::div_ceil`.
*/
function divCeil(a, b) {
	const d = Math.floor(a / b);
	return a % b > 0 ? d + 1 : d;
}
/**
* Computes the optimal fragment length for a given message length and
* maximum fragment length.
*
* The algorithm:
*   fragment_count  = ceil(data_length / max_fragment_length)
*   fragment_length = ceil(data_length / fragment_count)
*
* This produces fragments that are as balanced as possible while still
* respecting `maxFragmentLen` as an upper bound on each fragment. For
* example, a 10-byte message with `maxFragmentLen = 6` yields a fragment
* length of 5 (so two even 5-byte fragments) rather than 6 (one full
* fragment plus a 4-byte tail).
*
* Mirrors Rust `ur-0.4.1/src/fountain.rs::fragment_length` byte-for-byte.
*/
function fragmentLength(dataLength, maxFragmentLength) {
	return divCeil(dataLength, divCeil(dataLength, maxFragmentLength));
}
/**
* Splits `data` into a list of `fragmentLen`-sized chunks, zero-padding
* the last chunk if necessary so that every chunk is exactly
* `fragmentLen` bytes long.
*
* Note: `fragmentLen` is the **already-computed** fragment length (see
* {@link fragmentLength}), not the user-facing maximum fragment length.
*
* Mirrors Rust `ur-0.4.1/src/fountain.rs::partition` byte-for-byte.
*/
function partition(data, fragmentLen) {
	if (fragmentLen < 1) throw new Error("fragment length must be at least 1");
	const remainder = data.length % fragmentLen;
	const padding = remainder === 0 ? 0 : fragmentLen - remainder;
	const padded = new Uint8Array(data.length + padding);
	padded.set(data);
	const fragments = [];
	for (let start = 0; start < padded.length; start += fragmentLen) fragments.push(padded.slice(start, start + fragmentLen));
	return fragments;
}
/**
* XOR two Uint8Arrays together.
*/
function xorBytes(a, b) {
	const len = Math.max(a.length, b.length);
	const result = new Uint8Array(len);
	for (let i = 0; i < len; i++) result[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
	return result;
}
/**
* Chooses which fragments to mix for a given sequence number.
*
* This uses a seeded Xoshiro256** PRNG to deterministically select fragments,
* ensuring encoder and decoder agree without explicit coordination.
*
* The algorithm matches the BC-UR reference implementation:
* 1. For pure parts (seqNum <= seqLen), return single fragment index
* 2. For mixed parts, use weighted sampling to choose degree
* 3. Shuffle all indices and take the first 'degree' indices
*
* @param seqNum - The sequence number (1-based)
* @param seqLen - Total number of pure fragments
* @param checksum - CRC32 checksum of the message
* @returns Array of fragment indices (0-based)
*/
function chooseFragments(seqNum, seqLen, checksum) {
	if (seqNum <= seqLen) return [seqNum - 1];
	const rng = new Xoshiro256(createSeed(checksum, seqNum));
	const degree = rng.chooseDegree(seqLen);
	const allIndices = [];
	for (let i = 0; i < seqLen; i++) allIndices.push(i);
	return rng.shuffled(allIndices).slice(0, degree);
}
/**
* Mixes the selected fragments using XOR.
*/
function mixFragments(fragments, indices) {
	if (indices.length === 0) throw new Error("No fragments to mix");
	let result = new Uint8Array(fragments[0].length);
	for (const index of indices) {
		const fragment = fragments[index];
		if (fragment === void 0) throw new Error(`Fragment at index ${index} not found`);
		result = xorBytes(result, fragment);
	}
	return result;
}
/**
* Fountain encoder for creating multipart URs.
*/
var FountainEncoder = class {
	fragments;
	messageLen;
	checksum;
	seqNum = 0;
	/**
	* Creates a fountain encoder for the given message.
	*
	* @param message - The message to encode
	* @param maxFragmentLen - Maximum length of each fragment
	*
	* @throws if `message` is empty (mirrors Rust `Error::EmptyMessage`).
	* @throws if `maxFragmentLen < 1` (mirrors Rust `Error::InvalidFragmentLen`).
	*/
	constructor(message, maxFragmentLen) {
		if (message.length === 0) throw new Error("expected non-empty message");
		if (maxFragmentLen < 1) throw new Error("expected positive maximum fragment length");
		this.messageLen = message.length;
		this.checksum = crc32(message);
		const optimalLen = fragmentLength(message.length, maxFragmentLen);
		this.fragments = partition(message, optimalLen);
	}
	/**
	* Returns the number of pure fragments.
	*/
	get seqLen() {
		return this.fragments.length;
	}
	/**
	* Returns whether the message fits in a single part.
	*/
	isSinglePart() {
		return this.fragments.length === 1;
	}
	/**
	* Returns whether all pure parts have been emitted.
	*/
	isComplete() {
		return this.seqNum >= this.seqLen;
	}
	/**
	* Generates the next fountain part.
	*/
	nextPart() {
		this.seqNum++;
		const indices = chooseFragments(this.seqNum, this.seqLen, this.checksum);
		const data = mixFragments(this.fragments, indices);
		return {
			seqNum: this.seqNum,
			seqLen: this.seqLen,
			messageLen: this.messageLen,
			checksum: this.checksum,
			data
		};
	}
	/**
	* Returns the current sequence number.
	*/
	currentSeqNum() {
		return this.seqNum;
	}
	/**
	* Resets the encoder to start from the beginning.
	*/
	reset() {
		this.seqNum = 0;
	}
};
/**
* Fountain decoder for reassembling multipart URs.
*/
var FountainDecoder = class {
	seqLen = null;
	messageLen = null;
	checksum = null;
	fragmentLen = null;
	pureFragments = /* @__PURE__ */ new Map();
	mixedParts = /* @__PURE__ */ new Map();
	receivedIndexSets = /* @__PURE__ */ new Set();
	/**
	* Receives a fountain part and attempts to decode.
	*
	* @param part - The fountain part to receive
	* @returns `true` if this part contributed new information,
	*          `false` if it was an exact duplicate of a part already seen
	*          (or if the decoder was already complete).
	*
	* @throws if the part is empty or inconsistent with previously received
	*   parts. Mirrors Rust `Error::EmptyPart` and `Error::InconsistentPart`.
	*/
	receive(part) {
		if (this.isComplete()) return false;
		if (part.seqLen === 0 || part.data.length === 0 || part.messageLen === 0) throw new Error("expected non-empty part");
		if (this.seqLen === null) {
			this.seqLen = part.seqLen;
			this.messageLen = part.messageLen;
			this.checksum = part.checksum;
			this.fragmentLen = part.data.length;
		} else if (part.seqLen !== this.seqLen || part.messageLen !== this.messageLen || part.checksum !== this.checksum || part.data.length !== this.fragmentLen) throw new Error("part is inconsistent with previous ones");
		const indices = chooseFragments(part.seqNum, this.seqLen, this.checksum ?? 0);
		const indexSetKey = [...indices].sort((a, b) => a - b).join(",");
		if (this.receivedIndexSets.has(indexSetKey)) return false;
		this.receivedIndexSets.add(indexSetKey);
		if (indices.length === 1) {
			const index = indices[0];
			if (!this.pureFragments.has(index)) this.pureFragments.set(index, part.data);
		} else this.mixedParts.set(part.seqNum, {
			indices,
			data: part.data
		});
		this.reduceMixedParts();
		return true;
	}
	/**
	* Attempts to extract pure fragments from mixed parts.
	*/
	reduceMixedParts() {
		let progress = true;
		while (progress) {
			progress = false;
			for (const [seqNum, mixed] of this.mixedParts) {
				const missing = [];
				let reduced = mixed.data;
				for (const index of mixed.indices) {
					const pure = this.pureFragments.get(index);
					if (pure !== void 0) reduced = xorBytes(reduced, pure);
					else missing.push(index);
				}
				if (missing.length === 0) {
					this.mixedParts.delete(seqNum);
					progress = true;
				} else if (missing.length === 1) {
					const missingIndex = missing[0];
					this.pureFragments.set(missingIndex, reduced);
					this.mixedParts.delete(seqNum);
					progress = true;
				}
			}
		}
	}
	/**
	* Returns whether all fragments have been received.
	*/
	isComplete() {
		if (this.seqLen === null) return false;
		return this.pureFragments.size === this.seqLen;
	}
	/**
	* Reconstructs the original message.
	*
	* @returns The original message, or null if not yet complete
	*/
	message() {
		if (!this.isComplete() || this.seqLen === null || this.messageLen === null) return null;
		const firstFragment = this.pureFragments.get(0);
		if (firstFragment === void 0) return null;
		const fragmentLen = firstFragment.length;
		const result = new Uint8Array(this.messageLen);
		for (let i = 0; i < this.seqLen; i++) {
			const fragment = this.pureFragments.get(i);
			if (fragment === void 0) return null;
			const start = i * fragmentLen;
			const len = Math.min(start + fragmentLen, this.messageLen) - start;
			result.set(fragment.slice(0, len), start);
		}
		const actualChecksum = crc32(result);
		if (actualChecksum !== this.checksum) throw new Error(`Checksum mismatch: expected ${this.checksum}, got ${actualChecksum}`);
		return result;
	}
	/**
	* Returns the progress as a fraction (0 to 1).
	*/
	progress() {
		if (this.seqLen === null) return 0;
		return this.pureFragments.size / this.seqLen;
	}
	/**
	* Resets the decoder.
	*/
	reset() {
		this.seqLen = null;
		this.messageLen = null;
		this.checksum = null;
		this.fragmentLen = null;
		this.pureFragments.clear();
		this.mixedParts.clear();
		this.receivedIndexSets.clear();
	}
};
//#endregion
//#region src/multipart-encoder.ts
/**
* Encodes a UR as multiple parts using fountain codes.
*
* This allows large CBOR structures to be split into multiple UR strings
* that can be transmitted separately and reassembled. The encoder uses
* fountain codes for resilient transmission over lossy channels.
*
* For single-part URs (small payloads), use the regular UR.string() method.
*
* @example
* ```typescript
* const ur = UR.new('bytes', cbor);
* const encoder = new MultipartEncoder(ur, 100);
*
* // Generate all pure parts
* while (!encoder.isComplete()) {
*   const part = encoder.nextPart();
*   console.log(part); // "ur:bytes/1-10/..."
* }
*
* // Generate additional rateless parts for redundancy
* for (let i = 0; i < 5; i++) {
*   const part = encoder.nextPart();
*   console.log(part); // "ur:bytes/11-10/..."
* }
* ```
*/
var MultipartEncoder = class {
	_ur;
	_fountainEncoder;
	_currentIndex = 0;
	/**
	* Creates a new multipart encoder for the given UR.
	*
	* @param ur - The UR to encode
	* @param maxFragmentLen - Maximum length of each fragment in bytes
	* @throws {URError} If encoding fails
	*
	* @example
	* ```typescript
	* const encoder = new MultipartEncoder(ur, 100);
	* ```
	*/
	constructor(ur, maxFragmentLen) {
		if (maxFragmentLen < 1) throw new URError("Max fragment length must be at least 1");
		this._ur = ur;
		const cborData = ur.cbor().toData();
		this._fountainEncoder = new FountainEncoder(cborData, maxFragmentLen);
	}
	/**
	* Gets the next part of the encoding.
	*
	* Parts 1 through seqLen are "pure" fragments containing one piece each.
	* Parts beyond seqLen are "mixed" fragments using fountain codes for redundancy.
	*
	* @returns The next UR string part
	*
	* @example
	* ```typescript
	* const part = encoder.nextPart();
	* // Returns: "ur:bytes/1-3/lsadaoaxjygonesw"
	* ```
	*/
	nextPart() {
		const part = this._fountainEncoder.nextPart();
		this._currentIndex++;
		return this._encodePart(part);
	}
	/**
	* Encodes a fountain part as a UR string.
	*
	* Always emits the multipart `ur:<type>/<seqNum>-<seqLen>/<bytewords>`
	* format — including for single-part messages (`1-1/...`). This mirrors
	* Rust's `bc_ur::MultipartEncoder::next_part`, which never short-circuits
	* to plain UR. Callers that want plain UR for tiny payloads should use
	* `UR.string()` directly instead of constructing a `MultipartEncoder`.
	*/
	_encodePart(part) {
		const encoded = encodeBytewords(this._encodePartData(part), "minimal");
		return `ur:${this._ur.urTypeStr()}/${part.seqNum}-${part.seqLen}/${encoded}`;
	}
	/**
	* Encodes part metadata and data as CBOR for bytewords encoding.
	* Format: CBOR array [seqNum, seqLen, messageLen, checksum, data]
	*/
	_encodePartData(part) {
		return cbor([
			part.seqNum,
			part.seqLen,
			part.messageLen,
			part.checksum,
			part.data
		]).toData();
	}
	/**
	* Gets the current part index.
	*/
	currentIndex() {
		return this._currentIndex;
	}
	/**
	* Gets the total number of pure parts.
	*
	* Note: Fountain codes can generate unlimited parts beyond this count
	* for additional redundancy.
	*/
	partsCount() {
		return this._fountainEncoder.seqLen;
	}
};
//#endregion
//#region src/multipart-decoder.ts
/**
* Copyright © 2023-2026 Blockchain Commons, LLC
* Copyright © 2025-2026 Parity Technologies
*
*/
/**
* Decodes multiple UR parts back into a single UR.
*
* This reassembles multipart URs that were encoded using fountain codes.
* The decoder can handle out-of-order reception and packet loss.
*
* @example
* ```typescript
* const decoder = new MultipartDecoder();
*
* for (const urPart of urParts) {
*   decoder.receive(urPart);
*   if (decoder.isComplete()) {
*     const ur = decoder.message();
*     break;
*   }
* }
* ```
*/
var MultipartDecoder = class {
	_urType = null;
	_fountainDecoder = null;
	_decodedMessage = null;
	/**
	* Receives a UR part string.
	*
	* @param part - A UR part string (e.g., "ur:bytes/1-10/..." or "ur:bytes/...")
	* @throws {InvalidSchemeError} If the part doesn't start with "ur:"
	* @throws {UnexpectedTypeError} If the type doesn't match previous parts
	*/
	receive(part) {
		const { urType, partInfo } = this._parsePart(part);
		if (this._urType === null) this._urType = urType;
		else if (!this._urType.equals(urType)) throw new UnexpectedTypeError(this._urType.string(), urType.string());
		if (partInfo.isSinglePart) this._decodedMessage = UR.fromURString(part);
		else {
			this._fountainDecoder ??= new FountainDecoder();
			const fountainPart = this._decodeFountainPart(partInfo);
			this._fountainDecoder.receive(fountainPart);
			if (this._fountainDecoder.isComplete()) {
				const message = this._fountainDecoder.message();
				if (message !== null) {
					const cbor = decodeCbor(message);
					this._decodedMessage = UR.new(this._urType, cbor);
				}
			}
		}
	}
	/**
	* Parses a UR part string to extract type and part info.
	*/
	_parsePart(part) {
		const lowercased = part.toLowerCase();
		if (!lowercased.startsWith("ur:")) throw new InvalidSchemeError();
		const components = lowercased.substring(3).split("/");
		if (components.length === 0 || components[0] === "") throw new InvalidTypeError();
		const urType = new URType(components[0]);
		if (components.length >= 3) {
			const seqPart = components[1];
			const seqMatch = /^(\d+)-(\d+)$/.exec(seqPart);
			if (seqMatch !== null) return {
				urType,
				partInfo: {
					isSinglePart: false,
					seqNum: parseInt(seqMatch[1], 10),
					seqLen: parseInt(seqMatch[2], 10),
					encodedData: components.slice(2).join("/")
				}
			};
		}
		return {
			urType,
			partInfo: { isSinglePart: true }
		};
	}
	/**
	* Decodes a multipart UR's fountain part data.
	*
	* The multipart body is a CBOR array: [seqNum, seqLen, messageLen, checksum, data]
	*/
	_decodeFountainPart(partInfo) {
		const decoded = decodeCbor(decodeBytewords(partInfo.encodedData, "minimal"));
		if (decoded.type !== MajorType.Array) throw new URError("Invalid multipart data: expected CBOR array");
		const items = decoded.value;
		if (items.length !== 5) throw new URError(`Invalid multipart data: expected 5 elements, got ${items.length}`);
		const seqNum = Number(items[0].value);
		const seqLen = Number(items[1].value);
		const messageLen = Number(items[2].value);
		const checksum = Number(items[3].value);
		const data = items[4].value;
		if (seqNum !== partInfo.seqNum || seqLen !== partInfo.seqLen) throw new URError(`Multipart metadata mismatch: URL says ${partInfo.seqNum}-${partInfo.seqLen}, CBOR says ${seqNum}-${seqLen}`);
		return {
			seqNum,
			seqLen,
			messageLen,
			checksum,
			data
		};
	}
	/**
	* Checks if the message is complete.
	*/
	isComplete() {
		return this._decodedMessage !== null;
	}
	/**
	* Gets the decoded UR message.
	*
	* @returns The decoded UR, or null if not yet complete
	*/
	message() {
		return this._decodedMessage;
	}
};
//#endregion
//#region src/bytewords-namespace.ts
var bytewords_namespace_exports = /* @__PURE__ */ __exportAll({
	BYTEMOJIS: () => BYTEMOJIS,
	BYTEWORDS: () => BYTEWORDS,
	Style: () => BytewordsStyle,
	bytemojiIdentifier: () => encodeBytemojisIdentifier,
	canonicalizeByteword: () => canonicalizeByteword,
	decode: () => decodeBytewords,
	encode: () => encodeBytewords,
	encodeToBytemojis: () => encodeToBytemojis,
	encodeToMinimalBytewords: () => encodeToMinimalBytewords,
	encodeToWords: () => encodeToWords,
	identifier: () => encodeBytewordsIdentifier,
	isValidBytemoji: () => isValidBytemoji
});
//#endregion
export { BYTEMOJIS, BYTEWORDS, BytewordsError, BytewordsStyle, CBORError, InvalidSchemeError, InvalidTypeError, MultipartDecoder, MultipartEncoder, NotSinglePartError, TypeUnspecifiedError, UR, URDecodeError, URError, URType, UnexpectedTypeError, bytewords_namespace_exports as bytewords, canonicalizeByteword, decodableFromUR, decodableFromURString, decodeBytewords, encodeBytemojisIdentifier, encodeBytewords, encodeBytewordsIdentifier, encodeToBytemojis, encodeToMinimalBytewords, encodeToWords, isError, isURCodable, isURDecodable, isUREncodable, isURTypeChar, isValidBytemoji, isValidURType, urFromEncodable, urStringFromEncodable, validateURType };
