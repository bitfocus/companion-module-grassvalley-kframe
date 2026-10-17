# Grass Valley KFrame Companion v2.0.0

Major-version Bitfocus Companion implementation based on the Grass Valley Stream Deck application.

## Versioning

- Module id: `grassvalley-kframe` (the next version of the existing Bitfocus K-Frame module)
- Internal project version: `2.0.0.0` (announced to the frame; `src/version.ts`, checked against package.json by `test/repro-version.mjs`)
- Companion package version: `2.0.0` (SemVer, per the [Bitfocus module versioning rules](https://companion.free/for-developers/git-workflows/versioning/#version-of-modules): major bump over 1.0.0 because stored actions are upgraded). Development builds before this release were numbered 2026.0.9.x; the sections below keep those numbers.

## Source baseline

- Stream Deck baseline: `2026.3.0.0`
- Companion implementation will live entirely in this sibling project.
- The original Stream Deck repository remains the protocol-reference source and will not contain the Companion module.

## Status

Release 2.0.0 (first published as 2026.0.9). Tested against Grass Valley V14 (UDP) and V18 (TCP) frame simulators across Suites 1–4.

The release is prepared as the next version of `grassvalley-kframe` (1.0.0 is the current Bitfocus release) and keeps its module id. grassvalley-kframe 1.0.0 shipped no upgrade scripts, so every script here runs on its connections. The permanent upgrade script converts the former Macro/AUX action schemas, send-pulse feedbacks, configuration, and variable/expression values.

Upgrade testing with an imported K-Frame page confirms that Companion automatically preserves the existing page and button locations while translating supported Macro/AUX actions and their options to the new format. Companion's upgrade API does not redesign existing layered button artwork, so legacy buttons retain their existing visual layout; users can apply a new preset when they want the new suite badge, dynamic frame-name label, and tally presentation.

The module automatically connects the suites selected in its configuration, one at a time (the frame accepts one handshake per client at a time). A suite that fails re-queues behind the others, retries 2 s apart for the configured number of quick attempts, then retries every 30 s indefinitely. Existing Suite Connect / Disconnect button actions remain available for live manual control. Turning off Companion's master connection switch immediately clears all suite connections and their status feedback.

New preset buttons default to Companion's **Border when pressed** decoration. Status icons follow Companion's global button setting because the current module preset API does not expose a per-preset status-icon default.

## Required UDP ports

Maintainer decision, 2026-10-14: the following local UDP port assignments are required and must remain fixed.

| Suite | Main port | Listener port |
| ----- | --------: | ------------: |
| 1     |      6132 |          6133 |
| 2     |      6134 |          6135 |
| 3     |      6136 |          6137 |
| 4     |      6138 |          6139 |

Another process holding either required port on the Companion host causes a bind conflict. This constraint is expected, understood, and accepted by the maintainer. Do not change the port assignments or introduce automatic alternate-port selection to avoid it. Required ports must be available before connecting.

Connection lifecycle update, 2026-10-14: cancelled setup now stops before proceeding to another transport or handshake stage, pending startup settles on cancellation or a socket error, and cleanup safely closes sockets even during detection or binding. A cancelled older attempt cannot remove its replacement from the connection manager. The required port assignments above are unchanged; an occupied port still prevents that connection, but its bind error no longer leaves startup pending.

`npm test` includes 16 connection lifecycle regression tests in `test/repro-connection-lifecycle.cjs`, covering port conflicts, cancellation during TCP detection/authentication/registration and UDP binding, and replacement connections.

Live validation on 2026-10-14 passed on Suite 1 against V14.7.1 (UDP) and V18.1.0 (TCP): normal connection, cancellation during detection and transport setup, socket release, and reconnect after cancellation. Macro catalogs loaded on both frames. No macro execution, routing, or playout commands were sent. This validates the protocol lifecycle directly, not every Companion UI workflow or multi-suite scenario.

## Keyer source feedback

K1–K6 source-selection buttons now use frame-reported keyer state, stored separately from A–D bus state. Selecting a keyer source does not overwrite bus tally. Disconnect clears both caches.

Crosspoint source commands require whole numbers from 1–809. Malformed, missing, fractional, and out-of-range values are rejected before sending or changing cached feedback. Numeric dropdown strings remain supported. Regression tests cover bus and keyer commands, invalid inputs, and valid range boundaries.

Validation on 2026-10-14: V14.7.1 UDP and V18.1.0 TCP each returned all 30 keyer selections and 20 bus selections on Suite 1. Matching and nonmatching button feedback passed against those live values using read-only subscriptions. Synthetic frame-response tests cover source changes and disconnect cleanup across all keyer targets. The tests are included in `npm test`.

## Buttons with multiple actions

Action subscriptions are tracked by control ID and action-instance ID. Removing one Macro, AUX, Crosspoint, E-MEM, Transition, Panel Memory, Image Store, or GPI action preserves the remaining assignments and their feedback settings. When a button holds several actions of one type, its feedback displays the action with the lowest action-instance ID, so the result does not depend on the order Companion subscribes actions after a restart or edit. Removing one restores the next remaining assignment. The generic suite badge considers every action instance and clears when visible assignments span multiple suites.

The 2026-10-14 reproduction failed all 17 original cases before the fix. Those cases and three additional checks for resubscription, button isolation, and mixed suites now pass in `test/repro-multi-action-feedback.mjs`, included in `npm test`. No frame commands are needed for these tests.

## Macro catalog refresh

Macro dropdowns and presets refresh when received catalog data changes, after a two-second quiet period. This includes new names, renames, and cleared names. Identical catalog dumps do not trigger another refresh, and later updates preserve the existing UDP macro-status subscription.

Manual and frame-initiated disconnects also refresh dropdowns and presets after a short cleanup delay. Macro dropdowns use names from remaining suites, or numbered fallback labels when no catalog remains. Four regression cases cover both disconnect paths with and without another suite's catalog.

Disconnect cleanup also clears cached source names before announcing disconnection. AUX and crosspoint dropdowns then use remaining suites' source names or numbered fallback labels. The same four regression cases verify both source dropdowns and the cleared source-name getters.

Validation on 2026-10-14: synthetic UDP and TCP packets reproduce the original stale-dropdown failure and pass after the fix. Tests cover dropdowns, presets, cleared names, unchanged batches, and disconnect cleanup in `test/repro-macro-dropdown.mjs`, included in `npm test`. Live frame names were not changed for this test.

## Checks

All code is checked; nothing is excluded. `yarn build` type-checks every source file with strict TypeScript, including the protocol layer (`src/protocol/*.cts`, CommonJS TypeScript). `yarn lint` runs eslint on `src/` and `test/`, and `yarn prettier --check .` covers every source, test, doc and config file (`package.json` keeps the package manager's own formatting). `yarn test` (also `npm test`) builds and runs every test. CI runs build, lint, formatting and the tests on every push.

## 2026.0.9 release review

Commands for an unknown suite (a typo, or an expression returning `2` or `Suite 2`) are rejected instead of acting on Suite 1. Saving the configuration keeps live suites connected unless the IP changes or the save unticks them. A late UDP handshake send callback after a disconnect no longer throws. Action targets must be one of the action's own choices and numbers must be plain whole numbers, so a malformed or blank value is rejected instead of becoming a live default. PBUS Recall and Trigger sequences run one at a time per suite and PBUS device, and the queue survives action-definition refreshes. Operator commands wait for CONNECTED, so on TCP frames nothing is sent before the suite is selected. A config save also keeps suites connected with their Connect button, and a suite the operator disconnected stays disconnected unless the IP changes or the save ticks it. A failed TCP detection releases its socket immediately.

## 2026.0.9.9 safety checks

An unknown Transition type is now rejected instead of firing an AUTO transition, and an unknown AUX transition is rejected instead of becoming a cut. A config save during a manual Connect now closes that stale connection at once. Tests no longer contact the default frame port 5000 on the test machine.

## 2026.0.9.8 checks everywhere

The protocol layer is now typed and linted like the rest of the module (it previously opted out with `@ts-nocheck` and eslint/prettier ignores). `sendTimelineEvent` now rejects event IDs, DIDs and data bytes outside their wire ranges instead of letting `Buffer.from` wrap them. Write-only fields are removed.

## 2026.0.9.6 Companion-only cleanup

Code that only served the Stream Deck plugin is removed: the Stream Deck global-settings store for AUX message IDs, the B-suite handshake commands (Companion connects Suites 1–4 A only; legacy B settings upgrade to A), unused protocol helpers and manager exports, and the unused RUN command builder. The command builders now live in `src/cpl-commands.ts`.

## 2026.0.9.4 button labels

Every button whose action has a setting now shows that setting and updates when you change it. Each item has a regression test in `npm test` that fails against 2026.0.9.3. Checked in Companion 5.0.4 on a V18.1.0 lab frame: 54 buttons covering every action type (macros, AUX, crosspoint, Image Store output and input, Panel Memory, E-MEM, transition, Timeline Run, navigation, Insert and Mod, PBUS Recall and Trigger, GPI, button mapping, and Suite 1–4 connect/disconnect) were pressed with no action errors. The frame confirmed the AUX, crosspoint, E-MEM, and Image Store results through tally, and each suite toggle connected and closed its suite. On the V14.7.1 simulator (UDP), the protocol qualification sent 6,268 commands across Suites 1–4 with no local errors and every suite returned frame state, and the same Companion buttons (all but the suite toggles) were pressed with no action errors; the frame confirmed timeline runs and the PGM Auto transition, and a fresh-connection readback confirmed AUX routes on the owning suite.

- PBUS: Recall buttons show the PBUS and register; Trigger buttons show the PBUS and the trigger's function, for example `PBUS 1 / STOP`. The trigger option is a 0–15 dropdown (the frame's 16 PBus triggers; previously 0–12) named from the Lance TDC-100B GVG-mode table: 0 Normal Play, 1 Recue, 2 Variable Play, 3 Reverse Play 100%, 4 Stop, 5 Loop Play, 6 Record, 7 Normal Play, 8 Multi-Point Loop Start, 9 Multi-Point Loop Exit, 10–12 Select Bank 0–2, 13–15 Normal Play. Other PBus devices define their own trigger functions.
- Image Store: output buttons show the still they load and light up when the frame already has that still on that output (they used to show whatever still was loaded, so changing the image changed nothing). Input buttons show the selected source name or number.
- Button mapping: buttons show the bus, shift, button, and mapped source.
- Macro Stop, Timeline Run, and Timeline Edit: buttons show the macro, target, and command. The timeline progress bar appears only on Run buttons aimed at the master timeline, the only timeline that reports progress.
- All of these actions accept a text label override, and their presets use the new label feedbacks: "PBUS register/trigger or label override", "Image Store input source name or label override", "Button mapping bus/shift/button/source or label override", and "Macro Stop / Timeline Run / Timeline Edit label or label override".
- Existing buttons: buttons made from older presets keep their static text until the matching label feedback is added (re-dropping the preset also works). Companion 5 upgrades actions and feedbacks in separate passes, so an upgrade script cannot tell which buttons to change. Upgrade script index 4 is intentionally empty for that reason.

### Upgrade from grassvalley-kframe 1.0.0 and full button test

A `grassvalley-kframe` 1.0.0 connection (the latest release on GitHub) with every one of its presets plus variations (variable sources, `$(kframe:…)` expressions, range limits, "any" tallies, and invalid numbers) was tested on the V14.7.1 simulator, then switched to this module with Companion's "upgrade to another module" and pressed again. Configuration, actions, and feedbacks converted; the same buttons ran the same macros and AUX routes. Only the deliberately invalid Macro 0 and AUX 97 buttons fail, as they did before. Upgraded buttons keep their own text and colours; the old "sent" flash is not carried over.

All 191 presets and 431 option variations (every crosspoint, E-MEM, transition, Run, and Timeline Edit target; PBUS 1, 2, and 24 with all 16 triggers; range limits; Suites 2–4; 50% and 200% text; suite dot off; label override) were then pressed on Suites 1–4 of the V14.7.1 simulator (UDP) and the V18.1.0 simulator (TCP): 649 presses on each, with no errors other than the invalid-input test buttons.

- Legacy variables: `last_macro`, `last_aux`, and `last_aux_source` are defined again and update when a macro or AUX route is sent. Upgraded buttons and expressions that read them failed or showed blanks before.
- Connect buttons: Connect and Connect/Disconnect start the connection and return at once. Companion fails an action call after about 5 seconds, so a slower handshake used to log "Call timed out" even though the suite connected.
- The frame accepts one connection handshake at a time per client IP. Other clients on the same computer that are reconnecting (another Companion connection or a panel bridge) can make a handshake time out; the next retry connects.

## 2026.0.9.3 fixes

Reliability and correctness fixes from a full code review. Each item has a regression test in `npm test`, and the new tests fail against 2026.0.9.2. Tests use synthetic packets and loopback sockets; these fixes have not yet been validated on a live frame.

- Connection lifecycle: only transport failures (TCP, main/listener socket, Packet 1) are fatal; failed command sends report a non-fatal warning and keep the link up. Startup no longer reports an error when aux-state persistence is not configured. The retry loop stops immediately when no target IP is set. `destroy()` during a configuration change no longer reconnects. Concurrent connects for one suite are serialised so no orphaned connection survives. The connect wait follows status events instead of polling.
- Crash safety: UDP sends after disconnect (timeline subscription, second suite-select packet, or any closed socket) are skipped or reported instead of throwing an uncaught socket error.
- Commands: Stop-All discards queued macro commands so none start afterward. Numeric command inputs and target DIDs must be whole numbers in range; NaN, fractions, and text are rejected before sending.
- Frame parsing: short AUX/ME responses no longer read into the next packed response. TCP framing discards headerless data and resyncs past a stray header instead of stalling.
- Status and feedback: "Target IP is required" clears once an IP is set. Unexpected disconnects clear protocol, frame-version, and heartbeat state. Keyer Auto transition buttons no longer show the M/E primary progress strip. eDPM E-MEM buttons keep the user's background. Timeline progress follows its action's suite. Labels with XML-invalid control characters render, and 200% text fits the button width.
- Upgrades: scripts are append-only. A catch-up script fills missing suite selections, retries, text size, and suite-badge options for `grassvalley-kframe` 0.9.1 and earlier Kayenne installs without changing existing values. Blank, null, or non-numeric retry settings migrate to the default of 5.

## Development baseline

- Companion: 5.0.4
- `@companion-module/base`: 2.0.4
- Node runtime: 22
- Package manager: Yarn 4

## Author and maintainer

Copyright © 2024–2026 Brad Shaffer.

- GitHub: [@Orthiconnn](https://github.com/Orthiconnn)
- Instagram: [@orthicon](https://www.instagram.com/orthicon/)

This project is released under the MIT License. Contributions are welcome through the official repository. To preserve compatibility and quality, please coordinate substantial changes with the maintainer before proposing or distributing modified versions.

See [NOTICE.md](NOTICE.md) for authorship and project-governance information.
