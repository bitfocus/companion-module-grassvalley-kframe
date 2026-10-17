// Run after build: node --test test/repro-version.mjs
// The version announced to the frame must follow package.json
// (2.0.0 -> 2.0.0.0, 2.0.0-beta.N -> 2.0.0.N).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { MODULE_BUILD_DATE, MODULE_VERSION } from '../dist/version.js'

test('frame-announced version matches package.json', () => {
	const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
	assert.equal(MODULE_VERSION, version.includes('-beta.') ? version.replace(/-beta\./, '.') : `${version}.0`)
})

test('build date is a short "Mon D YYYY" date', () => {
	assert.match(MODULE_BUILD_DATE, /^[A-Z][a-z]{2} \d{1,2} \d{4}$/)
})
