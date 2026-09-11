/**
 * Resolves the modules the redesigned adapter needs, with computed
 * specifiers so this typechecks before the `/bytewords` subpath and the
 * canonical dcbor dependency exist.
 */
import * as src from "../../src";
import { redesignedAdapterFor, type VectorApi } from "./recipes";

export async function currentApi(): Promise<VectorApi> {
  let bw: unknown = src;
  try {
    bw = await import(["..", "..", "src", "bytewords"].join("/"));
  } catch {
    /* pre-redesign */
  }
  const dcbor = (await import(["@blockchaincommons", "dcbor"].join("/"))) as unknown;
  const fountain = (await import(["..", "..", "src", "fountain"].join("/"))) as unknown;
  return redesignedAdapterFor(src, bw, dcbor, fountain);
}
