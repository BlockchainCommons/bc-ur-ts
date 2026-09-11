/**
 * UR type identifiers.
 *
 * @module ur-type
 */
import { URError, type URResult } from "./error.js";

const VALID = /^[a-z0-9-]+$/;

/**
 * A UR type: one or more lowercase letters, digits and hyphens
 * (BCR-2020-005). The empty string is rejected (the Rust reference
 * accepts it — divergence D4).
 */
export class URType {
  readonly #name: string;

  /** @throws {URError} `InvalidType` when `name` is empty or has a character outside `[a-z0-9-]`. */
  constructor(name: string) {
    if (!URType.isValid(name)) throw URError.invalidType();
    this.#name = name;
  }

  /** `name` itself when it is already a `URType`, else a new one. @throws {URError} `InvalidType` */
  static from(name: string | URType): URType {
    return typeof name === "string" ? new URType(name) : name;
  }

  /** Non-throwing `from`. */
  static tryFrom(name: string): URResult<URType> {
    return URType.isValid(name)
      ? { ok: true, value: new URType(name) }
      : { ok: false, error: URError.invalidType() };
  }

  /** Whether `name` is one or more of `[a-z0-9-]`. */
  static isValid(name: string): boolean {
    return VALID.test(name);
  }

  /** The type string, e.g. `"envelope"`. */
  get name(): string {
    return this.#name;
  }

  /** Same type string. */
  equals(other: URType): boolean {
    return this.#name === other.#name;
  }

  /** The type string. */
  toString(): string {
    return this.#name;
  }
}
