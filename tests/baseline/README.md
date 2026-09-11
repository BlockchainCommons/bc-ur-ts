# Frozen baseline build

`uniform-resources-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/uniform-resources` built from
commit `899897dbba1fbca58bb212600b3266f14a062a15`, the pre-redesign wire-format reference. The
sibling `@blockchaincommons/crypto` is INLINED from its own frozen baseline bundle, and the
pre-redesign `@blockchaincommons/dcbor-compat` is INLINED directly, so this bundle keeps the
pre-redesign behaviour of its dependencies after they change.
`uniform-resources-baseline.d.mts` is the public surface at that commit.

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: 899897dbba1fbca58bb212600b3266f14a062a15
Baseline sha256: efc1c2e929f5569d77a8d28eab2cfe29481156a951f421c0ac6f1d74f3fabd74
