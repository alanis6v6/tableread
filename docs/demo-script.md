# Demo video script (~2:50, YouTube, narrated, public)

Per [#10](https://github.com/alanis6v6/tableread/issues/10): both modes get screen time (creator mode + game-publisher/compare mode), narration required, captions on, <3 minutes, public YouTube link, backfilled into README + Devpost afterward.

**Recording checklist for whoever records this** (marked [HUMAN] below wherever it can't be scripted from here):
- Record at 1080p+, screen + mic, with the browser's DevTools → Application → WebMCP panel visible during the "有 WebMCP" section so the Invoked Tools log is on camera.
- Use the deployed live demo URL (see README), not localhost — same reasoning as the ChatGPT in-app browser check in [#4](https://github.com/alanis6v6/tableread/issues/4)/[#6](https://github.com/alanis6v6/tableread/issues/6): a judge should be able to verify it's not a local-only trick.
- Add burned-in or YouTube captions before publishing (hard requirement, not optional).
- Upload as **Public** (not Unlisted — Devpost requires the judge to open it with no auth), then fill the URL into README's `Demo 影片` line and this doc's line 3.

**Video**: TODO — [HUMAN] paste the public YouTube URL here once recorded.

---

## 0:00–0:30 — The pain (creator + publisher)

**On screen**: a raw SillyTavern character card JSON (or the tableread draft view with a few fields already filled) — enough for the audience to see this is a real, structured card with a world-book and variables, not toy text.

**Narration** (adapt freely, keep the two beats):
> "A SillyTavern character card isn't just a system prompt — it's an opening line, alternate greetings, a world-book of keyword-triggered entries with sticky and cooldown windows, regex scripts, sometimes a variable tracker. Creators need every opening to still feel like *the same character*. Publishers need to know the card holds up across scenarios that stress it differently — a betrayal branch, a reconciliation branch. Today both of those get checked by hand: reading transcripts, and trying to remember which world-book entry fired in which chat."

## 0:30–1:00 — Without WebMCP

**On screen**: a generic chat-based Agent (or just narrate over a static screenshot of a normal chat UI) "reading" a transcript and guessing.

**Narration**:
> "Without page-exposed tools, an Agent can only read what's rendered — it can't see whether a world-book entry is inside a cooldown window right now, or whether a variable update actually applied versus silently failed to parse. And there's no way to check consistency across scenarios except re-reading every transcript by eye."

## 1:00–2:00 — With WebMCP (the core demo)

This is the longest and most important segment — show the actual tool-driven loop, not just the UI.

1. **[HUMAN, live capture]** Open the live demo URL in WebMCP-capable Chrome. Show the badge flip to "WebMCP 已註冊 10 個工具", DevTools WebMCP panel open showing the 10 tools.
2. **Creator mode — consistency pass**: ask the Agent (via the WebMCP panel's natural-language box, or a connected Agent) to check the checklist status, fill in a field via `update_card_field`, then run `run_scenario` → `get_playtest_context` → `commit_playtest_round` for one round. Narrate what's happening as each call fires and shows up in the Invoked Tools log:
   > "The Agent calls `run_scenario`, then `get_playtest_context` — that returns exactly which world-book entries are active *this round* and why, computed by the page, not guessed by the model. The Agent writes the in-character response, then `commit_playtest_round` applies it — regex scripts, variable patch, all deterministic."
3. **Switch to game-publisher/compare mode**: with at least two scenarios already played (prepare this ahead of recording — see setup note below), select them and show `compare_scenarios` running live. Point at the result:
   > "`compare_scenarios` is read-only — it takes scenarios that already ran and flags which world-book entries fired consistently across all of them versus only some. That inconsistency signal is the thing a publisher actually needs, and there's no way to compute it without the page's own state."
4. Zoom on the KPI strip / compare-anchor card highlighting the inconsistent entry (pulsing warning tag) so the "QA signal" claim is visually obvious, not just narrated.

**Setup note for the recording session** [HUMAN]: before hitting record, pre-run 2–3 scenarios (e.g. via the DevTools WebMCP panel's manual `execute()`, or `window.__tableread.tools` in the console) so step 3 has real data instead of an empty state. A card with one `constant: true` world-book entry and one keyword-gated entry demonstrates the "triggered in all / triggered in some" split clearly.

## 2:00–2:50 — Technical points

**On screen**: terminal running `npm test` (74 passing), or a quick cut to `test/golden/` in the editor.

**Narration**:
> "tableread never calls an LLM itself — zero API key, all generation happens on the calling Agent's own side. The playtest logic — world-book scanning, regex, variable patches — is ported from an existing Python engine and verified against it with a golden-parity test suite, so the ten tools an Agent calls are backed by tested, deterministic code, not another model's guess."

Close on the repo URL and live demo URL on screen.

## Post-production

- [ ] [HUMAN] Add captions (burned-in or YouTube auto + manual correction — Traditional Chinese narration should get correction, auto-captions on Chinese audio are unreliable).
- [ ] [HUMAN] Upload as Public YouTube video, <3:00 total runtime.
- [ ] [HUMAN] Backfill the URL into `README.md`'s `Demo 影片` line, `docs/submission.md`, and Devpost.
