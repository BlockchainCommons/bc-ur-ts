/**
 * The argument domains the reference's types imply, checked before any
 * work is done. TypeScript has no integer widths and no static types at
 * run time: a value outside its domain is `URError` `InvalidParameter`
 * when it was an argument, while what comes off the wire is `Decoder`.
 *
 * @module domain
 */
import { URError } from "./error.js";

/** The inclusive bounds of an integer domain. */
export interface Bounds {
  readonly min: number;
  readonly max: number;
}

/** `u32`: the fountain checksum. */
export const U32: Bounds = { min: 0, max: 0xffffffff };
/** A positive `usize` within `number` precision: fragment lengths and counters that start at 1. */
export const POSITIVE: Bounds = { min: 1, max: Number.MAX_SAFE_INTEGER };
/** A `usize` within `number` precision: the fountain part counters. */
export const NON_NEGATIVE: Bounds = { min: 0, max: Number.MAX_SAFE_INTEGER };
/** The reference's 64-bit `usize` maximum. */
export const USIZE_MAX = 0xffff_ffff_ffff_ffffn;

/** `true` when `value` is an integer `number` within `bounds`. */
export function isIntIn(value: unknown, bounds: Bounds): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= bounds.min &&
    value <= bounds.max
  );
}

/** Throws `InvalidParameter` unless `value` is an integer within `bounds`. */
export function expectInt(parameter: string, value: unknown, bounds: Bounds): number {
  if (!isIntIn(value, bounds)) {
    throw URError.invalidParameter(
      parameter,
      value,
      `an integer in [${bounds.min}, ${bounds.max}]`,
    );
  }
  return value;
}

/**
 * `value` as an exact `usize`: a safe integer `number` or a `bigint` in
 * `[0, USIZE_MAX]`, as a `bigint`; `undefined` for anything else. A
 * `number` of 2^53 or more stands for several integers, so it is not
 * accepted: the `bigint` form is exact.
 */
export function usizeOf(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value >= 0n && value <= USIZE_MAX ? value : undefined;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : undefined;
  }
  return undefined;
}

/** Throws `InvalidParameter` unless `value` is a `usize` of at least `min`. */
export function expectUsize(parameter: string, value: unknown, min: 0n | 1n): bigint {
  const usize = usizeOf(value);
  if (usize === undefined || usize < min) {
    throw URError.invalidParameter(
      parameter,
      value,
      `an integer in [${min}, ${Number.MAX_SAFE_INTEGER}] or a bigint in [${min}, ${USIZE_MAX}]`,
    );
  }
  return usize;
}

/** A `Uint8Array` from any realm (`Buffer` included), never another typed array. */
export function isBytes(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    (ArrayBuffer.isView(value) && value.constructor.name === "Uint8Array")
  );
}

/** Throws `InvalidParameter` unless `value` is a `Uint8Array`. */
export function expectBytes(parameter: string, value: unknown): Uint8Array {
  if (!isBytes(value)) throw URError.invalidParameter(parameter, value, "a Uint8Array");
  return value;
}

/** Throws `InvalidParameter` unless `value` is a string. */
export function expectString(parameter: string, value: unknown): string {
  if (typeof value !== "string") throw URError.invalidParameter(parameter, value, "a string");
  return value;
}

/** Throws `InvalidParameter` unless `value` is a non-null object. */
export function expectRecord(parameter: string, value: unknown): Record<PropertyKey, unknown> {
  if (typeof value !== "object" || value === null) {
    throw URError.invalidParameter(parameter, value, "an object");
  }
  return value as Record<PropertyKey, unknown>;
}

/** `value` when it is one of `allowed`, `fallback` when it is `undefined`; `InvalidParameter` otherwise. */
export function expectChoice<T extends string>(
  parameter: string,
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value))
    return value as T;
  throw URError.invalidParameter(
    parameter,
    value,
    `one of ${allowed.map((s) => JSON.stringify(s)).join(", ")}`,
  );
}
