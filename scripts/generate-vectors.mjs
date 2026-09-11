/**
 * Golden vector generator. `bun scripts/generate-vectors.mjs`.
 * Materialises the golden recipe subset with the WORKING TREE and writes
 * tests/vectors/vectors.json. Regenerating is a deliberate, reviewed act.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { materialize, recipeName } from "../tests/vectors/recipes.ts";
import { currentApi } from "../tests/vectors/modules.ts";
import { goldenRecipes } from "../tests/corpus/corpus.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = await currentApi();
const vectors = [];
for (const recipe of goldenRecipes()) vectors.push({ name: recipeName(recipe), recipe, expect: materialize(api, recipe) });
writeFileSync(join(root, "tests/vectors/vectors.json"), JSON.stringify({ count: vectors.length, vectors }, null, 1) + "\n");
console.log(`wrote ${vectors.length} vectors`);
