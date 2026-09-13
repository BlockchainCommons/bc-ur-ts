# Frozen baseline build

`uniform-resources-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/uniform-resources` built from
commit `899897dbba1fbca58bb212600b3266f14a062a15`, the pre-redesign wire-format reference. The
sibling `@blockchaincommons/crypto` is INLINED from its own frozen baseline bundle, and the
pre-redesign `@blockchaincommons/dcbor-compat` is INLINED directly, so this bundle keeps the
pre-redesign behaviour of its dependencies after they change.
`uniform-resources-baseline.d.mts` is the public surface at that commit.

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree, with the explicit behavior-change exceptions recorded in that
test. It pins the SHA-256 below so a rebuild cannot silently replace the
historical reference with the current implementation.

Baseline commit: 899897dbba1fbca58bb212600b3266f14a062a15
Baseline sha256: efc1c2e929f5569d77a8d28eab2cfe29481156a951f421c0ac6f1d74f3fabd74

## Historical reconstruction

`bun run baseline:build` runs the TypeScript builder. It requires the recorded
historical source and compatible dependency baselines. The current source imports
`crc32`, which the historical crypto baseline does not export. Keep the frozen
bundles and hashes unchanged when running `bun run test:differential`.
