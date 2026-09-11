/**
 * Integer domains the reference's types imply.
 *
 * TypeScript has no integer widths: the four fountain part fields are
 * `u32`s, `maxFragmentLength` is a `usize` that must be positive. A value
 * outside its domain is `URError` `Decoder` when it came off the wire and
 * `InvalidParameter` when it was an argument.
 *
 * @module domain
 */
import { URError } from "./error.js";

/** The inclusive bounds of an integer domain. */
export interface Bounds {
  readonly min: number;
  readonly max: number;
}

/** `u32`: the fountain part fields. */
export const U32: Bounds = { min: 0, max: 0xffffffff };
/** A `u32` that must be at least 1: `seqNum`. */
export const U32_POSITIVE: Bounds = { min: 1, max: 0xffffffff };
/** A positive `usize`: fragment lengths. */
export const POSITIVE: Bounds = { min: 1, max: Number.MAX_SAFE_INTEGER };

/** `true` when `value` is an integer `number` within `bounds`. */
export function isIntIn(value: number, bounds: Bounds): boolean {
  return Number.isInteger(value) && value >= bounds.min && value <= bounds.max;
}

/** Throws `InvalidParameter` unless `value` is an integer within `bounds`. */
export function expectInt(parameter: string, value: number, bounds: Bounds): void {
  if (!isIntIn(value, bounds)) {
    throw URError.invalidParameter(
      parameter,
      value,
      `an integer in [${bounds.min}, ${bounds.max}]`,
    );
  }
}
