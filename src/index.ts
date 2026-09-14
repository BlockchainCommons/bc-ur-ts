/**
 * @blockchaincommons/uniform-resources - Uniform Resources (BCR-2020-005):
 * CBOR payloads as `ur:<type>/<bytewords>` strings, single- or multi-part.
 *
 * - {@link UR} and {@link URType}; {@link urFor} / {@link decodeURWith}
 *   bridge dcbor-tagged values.
 * - {@link MultipartEncoder} / {@link MultipartDecoder} for animated QR.
 * - Failures are {@link URError}s with a `code`: the reference's eight,
 *   plus `InvalidParameter` for an argument outside its domain (checked
 *   before any work) and `TagUnnamed` where the reference panics. Two
 *   exceptions come from `@blockchaincommons/dcbor`: {@link decodeURWith}
 *   reports a wrong UR type as a `CborError` (`Custom`), as the reference's
 *   `from_ur` does, and {@link urFor} passes on dcbor's own error for a
 *   value whose `toCbor()` is not tagged with its first tag.
 * - Bytewords live on `@blockchaincommons/uniform-resources/bytewords`, the
 *   fountain code on `…/fountain`.
 *
 * @module @blockchaincommons/uniform-resources
 */
export { URError, type URErrorCode, type URErrorDetails, type URResult } from "./error.js";
export { URType } from "./ur-type.js";
export { UR } from "./ur.js";
export { type ToUR, urFor, decodeURWith } from "./codable.js";
export { MultipartEncoder } from "./multipart-encoder.js";
export { MultipartDecoder } from "./multipart-decoder.js";
