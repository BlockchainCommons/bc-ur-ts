/**
 * @blockchaincommons/uniform-resources - Uniform Resources (BCR-2020-005):
 * CBOR payloads as `ur:<type>/<bytewords>` strings, single- or multi-part.
 *
 * - {@link UR} and {@link URType}; {@link urFor} / {@link decodeURWith}
 *   bridge dcbor-tagged values.
 * - {@link MultipartEncoder} / {@link MultipartDecoder} for animated QR.
 * - Every failure is a {@link URError} with a `code`: the reference's eight,
 *   plus `InvalidParameter` for a `number` argument outside its domain and
 *   `TagUnnamed` for a tag that cannot name a UR type.
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
