/**
 * Bridging dcbor-tagged values to URs.
 *
 * @module codable
 */
import {
  type CborCodec,
  type CborTagged,
  CborError,
  type ToCbor,
  expectTaggedContent,
  taggedValue,
} from "@blockchaincommons/dcbor";
import { URError } from "./error.js";
import { UR } from "./ur.js";

/** Anything that can present itself as a UR. */
export interface ToUR {
  /** The value as a UR. */
  toUR(): UR;
}

/**
 * The UR of a tagged dcbor value: the type is the name of its first tag,
 * the payload is the tag's content, as the reference's `UREncodable::ur`.
 * @throws {URError} `TagUnnamed` when the value has no tag or its first tag
 * has no name; `InvalidType` when that name is not a UR type. The
 * reference panics at the same three points.
 * @throws {CborError} when `toCbor()` is not tagged with the first tag
 * (the reference reads `untagged_cbor()` and cannot receive such a value).
 */
export function urFor(value: ToCbor & CborTagged): UR {
  const tag = value.cborTags()[0];
  if (tag === undefined) throw URError.tagUnnamed(undefined);
  if (tag.name === undefined) throw URError.tagUnnamed(tag.value);
  return UR.from(tag.name, expectTaggedContent(value.toCbor(), tag.value));
}

/**
 * Decode a UR with a dcbor codec whose first tag names the UR type, as the
 * reference's `URDecodable::from_ur`: the UR's type must be the first tag's
 * name (a codec's other tags do not name accepted UR types), and the codec
 * decodes the content wrapped in that tag.
 * @throws {URError} `TagUnnamed` when the codec has no tag or its first tag
 * has no name (the reference panics there).
 * @throws {CborError} `Custom` when the UR's type is not the first tag's
 * name ("expected UR type <name>, but found <type>") or that name is not a
 * UR type ("invalid UR type"), as `from_ur` returns a `dcbor::Error`; and
 * whatever the codec throws for the content.
 */
export function decodeURWith<T>(ur: UR, codec: CborCodec<T>): T {
  const first = codec.tags?.[0];
  if (first === undefined) throw URError.tagUnnamed(undefined);
  if (first.name === undefined) throw URError.tagUnnamed(first.value);
  try {
    ur.expectType(first.name);
  } catch (error) {
    throw CborError.custom(error instanceof Error ? error.message : String(error));
  }
  return codec.decode(taggedValue(first, ur.cbor));
}
