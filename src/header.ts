/**
 * The multipart `seqNum-seqLen` header, read as the reference's `ur::decode`
 * reads it.
 *
 * @internal
 * @module header
 */

/** `u16::from_str`: an optional `+`, ASCII digits, at most 65535. */
const U16 = /^\+?[0-9]+$/;
const isU16 = (s: string): boolean => U16.test(s) && Number(s) <= 0xffff;

/**
 * Whether `header` is two `u16`s split at its first `-` (`1-2`, `+1-2`,
 * `0001-2`); `1-2-3`, `1-x`, `-1-2` and `65536-1` are not.
 */
export function isMultipartHeader(header: string): boolean {
  const dash = header.indexOf("-");
  if (dash === -1) return false;
  return isU16(header.slice(0, dash)) && isU16(header.slice(dash + 1));
}
