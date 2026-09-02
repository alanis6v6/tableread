# tableread — WebMCP Challenge submission

**tableread** is a browser-Agent-collaborative playtesting platform for SillyTavern character cards. It exposes ten deterministic tools through [WebMCP](https://github.com/webmachinelearning/webmcp) (`document.modelContext.registerTool()`) so a browser-native Agent can help a creator write, playtest, and QA a character card — and so a publisher can compare how one card behaves across many opening scenarios — without either side reading the character card's JSON by hand.

- Repository: https://github.com/alanis6v6/tableread
- License: MIT
- Live demo: https://alanis6v6.github.io/tableread/
- Demo video: TODO (filled in once [#10](https://github.com/alanis6v6/tableread/issues/10) is recorded)

## The pain

A SillyTavern character card is not just prose — it is a `first_mes`, a set of `alternate_greetings`, a world-book of keyword-triggered entries (some `constant`, some with `sticky`/`cooldown`/`delay` windows), regex "beautify" scripts, and optionally an MVU variable-tracking block. Two audiences need to verify this bundle actually behaves as intended, and today both do it by hand:

- **Creators** need to confirm every opening (the `first_mes` and each `alternate_greetings` entry) still produces "the same character" — same voice, same world-book entries firing, same variable behavior — even after an edit deep in the card.
- **Publishers/reviewers** need to confirm a card holds up across scenarios that stress it differently: a betrayal branch, a reconciliation branch, a combat-loss branch. Does the personality stay consistent? Do the *right* world-book entries fire in each, and — just as importantly — do the *same* entries fire inconsistently across scenarios in a way that signals a keyword or trigger-window bug?

Tracking world-book trigger windows (sticky/cooldown/delay, secondary keys, constant entries) across multiple rounds and multiple scenarios by eye does not scale — it is exactly the kind of bookkeeping a human glosses over and an LLM guesses at.

## Why WebMCP

WebMCP lets the page hand a browser-native Agent a small set of *tools* instead of a UI to operate blindly. tableread uses it to split the work along the line each side is actually good at:

- The **page** owns everything deterministic and stateful: scanning world-book keywords against the accumulated transcript, applying sticky/cooldown/delay windows, running regex scripts, applying JSON-Patch variable updates, and diffing world-book triggers across scenarios. This logic is ported from a existing Python engine (`playtest_engine.py`, see below) and unit/golden-tested — it never guesses.
- The **Agent** owns the one thing that requires judgment: writing an in-character player line and the character's in-voice response for a given round, given the exact world-book content and variable state the page's `get_playtest_context` tool just handed it.

Ten tools cover the full loop: read/write the draft (`get_checklist_status`, `update_card_field`, `assemble_card`), enumerate and add test openings (`list_scenarios`, `add_scenario`), and drive + inspect playtests (`run_scenario`, `get_playtest_context`, `commit_playtest_round`, `get_transcript`, `compare_scenarios`). Because the tools are typed and self-describing (`inputSchema` + a Traditional-Chinese `description` written for an Agent audience, not a human one), an Agent can discover the right call sequence from the tool metadata alone, with no external documentation or prompt scaffolding required.

## What's newly possible

Without page-exposed tools, a browser Agent can only *read the rendered page* and guess: it cannot see which world-book entries are currently inside a sticky/cooldown window, cannot reliably tell whether a JSON-Patch variable update actually applied, and has no way to correlate "entry X fired in scenario A" against "entry X did not fire in scenario B" except by re-reading both transcripts and eyeballing the diff.

tableread's tools make two things possible that were not available to an Agent (or a human) working from the rendered page alone:

- **Exact per-round trigger state.** `get_playtest_context` returns precisely which world-book entries are active for *this* round and *why* (keyword match vs. constant vs. still-in-cooldown), computed the same way the engine will actually apply them — not inferred from the last chat bubble.
- **Cross-scenario consistency checking with no prior art.** `compare_scenarios` is a pure, read-only tool that takes a batch of already-run scenario IDs and returns which world-book entries triggered consistently (`world_entries_triggered_in_all`) versus inconsistently (`world_entries_triggered_in_some`) — the single most useful QA signal for "does this card hold up across branches," and not something any existing SillyTavern tooling or generic browser Agent can compute today.

## Implementation

- **10 tools**, registered via `document.modelContext.registerTool()` in `src/tools/registerTools.js`; each tool's logic (`src/tools/*.js`) is a plain, DOM-free function, unit-tested independently of the WebMCP wiring.
- **Pure frontend, zero bundler.** `index.html` + native ES modules (`main.js`, `src/**`); `npm run dev` is a zero-dependency static file server (`scripts/dev-server.mjs`), not a build step. Any static host works — see the [README](../README.md#webmcp-需求) for the HTTPS requirement WebMCP itself imposes in production.
- **Zero API key.** tableread never calls an LLM itself — all generation happens on the calling Agent's own side, using its own model access. The page only executes deterministic logic and stores in-memory session state.
- **Ported and verified against the original engine.** The world-book/regex/variable-state logic is ported from [`alanis6v6/st_writer`](https://github.com/alanis6v6/st_writer)'s `playtest_engine.py` (Python) to JavaScript, and checked against it with a golden-parity test suite (`test/golden/`) that replays a fixed set of multi-round conversations through both engines and asserts identical output. Combined with `test/unit/`, the suite is 74 tests (`npm test`), plus a growing Playwright end-to-end suite (`test/e2e/`) driving the UI itself.
