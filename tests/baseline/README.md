# Frozen baseline build

`uniform-resources-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/uniform-resources` built from
commit `899897dbba1fbca58bb212600b3266f14a062a15`, the pre-redesign wire-format reference. Sibling
`@blockchaincommons/*` packages are INLINED from their own frozen baseline
bundles (@blockchaincommons/crypto, @blockchaincommons/rand, @blockchaincommons/tags, @blockchaincommons/shamir), so this bundle keeps the
pre-redesign behaviour of its dependencies after they change.
`uniform-resources-baseline.d.mts` is the public surface at that commit (Phase 0.5).

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: 899897dbba1fbca58bb212600b3266f14a062a15
Baseline sha256: 2334072acdd1d4dd6a1f124ceea1cfce20e2287a482fd272814622d7577b75ab
