/**
 * Bridging dcbor-tagged values to URs.
 *
 * @module codable
 */
import {
  type CborCodec,
  type CborTagged,
  type ToCbor,
  expectTaggedContent,
  taggedValue,
} from "@blockchaincommons/dcbor";
import { UR } from "./ur.js";

/** Anything that can present itself as a UR. */
export interface ToUR {
  toUR(): UR;
}

/**
 * The UR of a tagged dcbor value: the type is the name of its first tag,
 * the payload is the tag's content.
 * @throws {Error} when the first tag has no registered name.
 */
export function urFor(value: ToCbor & CborTagged): UR {
  const tag = value.cborTags()[0];
  if (tag === undefined) throw new Error("urFor: cborTags() returned no tags");
  if (tag.name === undefined)
    throw new Error(`CBOR tag ${tag.value} must have a name; register the tags first`);
  return UR.from(tag.name, expectTaggedContent(value.toCbor(), tag.value));
}

/**
 * Decode a UR with a dcbor codec whose first tag names the UR type.
 * @throws {URError} `UnexpectedType` when the UR's type is not the codec's.
 */
export function decodeURWith<T>(ur: UR, codec: CborCodec<T>): T {
  const first = codec.tags?.[0];
  if (first === undefined) throw new Error("decodeURWith: codec has no tags");
  if (first.name === undefined)
    throw new Error(`CBOR tag ${first.value} must have a name; register the tags first`);
  // A codec that carries several tags (a type with a legacy tag, or one
  // that dispatches on the tag) accepts a UR named after any of them; the
  // matching tag wraps the content so the codec sees the tagged form.
  const tag = codec.tags?.find((t) => t.name === ur.type.name) ?? first;
  ur.expectType(tag.name ?? first.name);
  return codec.decode(taggedValue(tag, ur.cbor));
}
