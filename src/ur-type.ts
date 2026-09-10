/**
 * UR type identifiers.
 *
 * @module ur-type
 */
import { URError, type URResult } from "./error.js";

const VALID = /^[a-z0-9-]*$/;

/** A UR type: lowercase letters, digits and hyphens. The empty string is accepted here and rejected at parse time. */
export class URType {
  readonly #name: string;

  /** @throws {URError} `InvalidType` */
  constructor(name: string) {
    if (!URType.isValid(name)) throw URError.invalidType();
    this.#name = name;
  }

  /** @throws {URError} `InvalidType` */
  static from(name: string | URType): URType {
    return typeof name === "string" ? new URType(name) : name;
  }

  /** Non-throwing `from`. */
  static tryFrom(name: string): URResult<URType> {
    return URType.isValid(name)
      ? { ok: true, value: new URType(name) }
      : { ok: false, error: URError.invalidType() };
  }

  /** Whether `name` uses only `[a-z0-9-]`. */
  static isValid(name: string): boolean {
    return VALID.test(name);
  }

  get name(): string {
    return this.#name;
  }

  equals(other: URType): boolean {
    return this.#name === other.#name;
  }

  toString(): string {
    return this.#name;
  }
}
