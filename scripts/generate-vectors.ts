/**
 * Vector generator. `bun scripts/generate-vectors.ts` materialises the
 * golden recipe subset with the WORKING TREE and writes
 * tests/vectors/vectors.json; regenerating it is a deliberate, reviewed act.
 * `--full [path]` materialises every corpus recipe into
 * tests/vectors/full.json (git-ignored) or `path`, for the Rust harness.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";
import { materialize, recipeName } from "../tests/vectors/recipes.ts";
import { currentApi } from "../tests/vectors/modules.ts";
import { allRecipes, goldenRecipes } from "../tests/corpus/corpus.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = argv.slice(2);
const full = args[0] === "--full";
const target = full
  ? (args[1] ?? join(root, "tests/vectors/full.json"))
  : join(root, "tests/vectors/vectors.json");
const api = await currentApi();
const vectors = [];
for (const recipe of full ? allRecipes() : goldenRecipes())
  vectors.push({
    name: recipeName(recipe),
    recipe,
    expect: materialize(api, recipe, { messages: true }),
  });
writeFileSync(target, JSON.stringify({ count: vectors.length, vectors }, null, 1) + "\n");
console.log(`wrote ${vectors.length} vectors to ${target}`);
