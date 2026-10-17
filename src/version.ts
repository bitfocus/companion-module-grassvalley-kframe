// Announced to the frame during the handshake. test/repro-version.mjs fails the
// build if MODULE_VERSION drifts from package.json (2.0.0 -> 2.0.0.0, 2.0.0-beta.N -> 2.0.0.N).
export const MODULE_VERSION = '2.0.0.0'
export const MODULE_BUILD_DATE = 'Oct 17 2026'
