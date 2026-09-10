/**
 * Lists the public surface of @blockchaincommons/uniform-resources.
 *
 *   bun examples/exports.ts
 */
import * as lib from "@blockchaincommons/uniform-resources";

for (const name of Object.keys(lib).sort()) {
  console.log(name);
}
