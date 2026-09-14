/**
 * Resolves the modules the current adapter needs: the package's three
 * entry points and the dcbor it depends on.
 */
import * as src from "../../src";
import * as bw from "../../src/bytewords";
import * as fountain from "../../src/fountain";
import * as dcbor from "@blockchaincommons/dcbor";
import { currentAdapterFor, type VectorApi } from "./recipes";

export function currentApi(): Promise<VectorApi> {
  return Promise.resolve(currentAdapterFor(src, bw, dcbor, fountain));
}
