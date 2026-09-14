/**
 * UR type identifiers.
 *
 * @module ur-type
 */
import { expectString } from "./domain.js";
import { URError, type URResult } from "./error.js";

const VALID = /^[a-z0-9-]*$/;

/**
 * A UR type: lowercase letters, digits and hyphens, as the reference's
 * `URType::new` accepts them. The empty string is accepted, so `ur:/…` is
 * a valid UR, although BCR-2020-005 asks for one or more characters.
 */
export class URType {
  readonly #name: string;

  /**
   * @throws {URError} `InvalidType` when `name` has a character outside
   * `[a-z0-9-]`; `InvalidParameter` for a non-string.
   */
  constructor(name: string) {
    if (!URType.isValid(name)) throw URError.invalidType();
    this.#name = name;
  }

  /**
   * `name` itself when it is already a `URType`, else a new one.
   * @throws {URError} `InvalidType`; `InvalidParameter` for anything but a string or `URType`.
   */
  static from(name: string | URType): URType {
    if (name instanceof URType) return name;
    if (typeof name !== "string") {
      throw URError.invalidParameter("type", name, "a string or URType");
    }
    return new URType(name);
  }

  /** Non-throwing `from` for a string. @throws {URError} `InvalidParameter` for a non-string. */
  static tryFrom(name: string): URResult<URType> {
    return URType.isValid(name)
      ? { ok: true, value: new URType(name) }
      : { ok: false, error: URError.invalidType() };
  }

  /**
   * Whether every character of `name` is in `[a-z0-9-]` (the empty string is valid).
   * @throws {URError} `InvalidParameter` for a non-string.
   */
  static isValid(name: string): boolean {
    return VALID.test(expectString("name", name));
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
