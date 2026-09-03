# Demo video script (~2:50, YouTube, narrated, public)

Per [#10](https://github.com/alanis6v6/tableread/issues/10): both halves get screen time (creator mode — ideation **and** playtest — plus game-publisher/compare mode), narration required, captions on, <3 minutes, public YouTube link, backfilled into README + Devpost afterward.

**Structure**: cold open first (show the agent driving the page before explaining anything), then the problem, then the two-part walkthrough. Roughly:

| time | section |
|---|---|
| 0:00–0:20 | Cold open — agent calling tools, Invoked Tools log scrolling |
| 0:20–0:45 | The problem (creator + publisher) |
| 0:45–1:00 | Without page-exposed tools |
| 1:00–1:55 | With WebMCP · Part 1 — ideate a card from a three-sentence brief |
| 1:55–2:35 | With WebMCP · Part 2 — playtest + cross-scenario compare |
| 2:35–2:55 | Technical + close |

## Recording checklist for whoever records this

Marked **[HUMAN]** below wherever it can't be scripted from here.

- **Browser**: record in a browser whose agent can actually *call* WebMCP site tools — that means the **Codex browser** (ChatGPT Work / Codex, model GPT-5.6 Sol or Terra; a plain ChatGPT Plus account's agent will only web-fetch the page — see [#11](https://github.com/alanis6v6/tableread/issues/11)). Fallback that also counts for the submission: **Chrome 149+ with `chrome://flags/#enable-webmcp-testing` + the Model Context Tool Inspector extension**, driving the tools from the extension panel.
- Record at 1080p+, screen + mic, with the browser's **DevTools → Application → WebMCP panel visible** during both "With WebMCP" parts so the Invoked Tools log is on camera.
- Use the **deployed live URL** (see README), not localhost — a judge should be able to verify it's not a local-only trick.
- Add burned-in or YouTube captions before publishing (hard requirement, not optional).
- Upload as **Public** (not Unlisted — Devpost needs the judge to open it with no auth), then fill the URL into README's `Demo 影片` line and this doc's **Video** line below.

**Video**: TODO — [HUMAN] paste the public YouTube URL here once recorded.

## Setup before hitting record  [HUMAN]

Flow A — the agent builds the card live, no console seeding on camera:

1. Open the live URL in the Codex browser. Confirm the badge reads **"WebMCP 已註冊 N 個工具"** and the address-bar **Site tools → Available site tools** panel lists them.
2. Have the **brief** ready to paste (see Part 1). Keep it to three sentences — world, character, backstory.
3. Optional, so the checklist isn't a wall of ⬜ at the start: pre-answer **one** aspect (e.g. ask the agent once beforehand to set `cast` to known), then reset the rest. Not required.
4. For the compare segment (Part 2), either pre-run two scenarios right before recording, or run them live if the pacing allows. A card with **one `constant: true` world-book entry and one keyword-gated entry** shows the "triggered in all / triggered in some" split clearly — the reference card at `reference/st-writer-src/cards/gender-is-not-the-limit/` already has both.

---

## 0:00–0:20 — Cold open

**On screen**: the tableread page in the Codex browser, DevTools WebMCP panel open. The agent is mid-task — `get_checklist_status`, then `update_card_field`, then `run_scenario`, then `get_playtest_context` fire in sequence, each landing in the Invoked Tools log; the on-page checklist cells flip green as it goes.

**Narration**:
> "This is a browser agent building and stress-testing a SillyTavern character card — by calling tools the web page handed it. No plugin, no API key, no copy-paste. The page told the agent what it can do; the agent is just doing it."

## 0:20–0:45 — The problem

**On screen**: a real character card opened in the tableread draft view — enough fields filled that the audience sees a world-book with keyworded entries, regex scripts, a variable block. Not toy text.

**Narration**:
> "A character card isn't a system prompt. It's an opening line, a set of alternate greetings, a world-book of keyword-triggered entries with sticky and cooldown windows, regex beautify scripts, sometimes a variable tracker. Two people need to know this bundle actually behaves: the creator, who needs every opening to still feel like the same character after an edit — and the publisher, who needs it to hold up across scenarios that stress it differently. Today both check it by hand."

## 0:45–1:00 — Without page-exposed tools

**On screen**: a normal chat UI reading a transcript and guessing (a static screenshot is fine).

**Narration**:
> "A browser agent working from the rendered page alone can only guess. It can't see whether a world-book entry is inside a cooldown window right now. It can't tell whether a variable update applied or silently failed to parse. And it has no way to compare which entries fired across two scenarios except re-reading both by eye."

## 1:00–1:55 — With WebMCP · Part 1 — ideate a card from a brief

**On screen**: creator mode. Paste the brief into the chat. The agent calls `get_checklist_status`; for each `pending_ideation` aspect it proposes two or three options; the creator picks; the agent calls `update_card_field`; the checklist strip fills in.

**[HUMAN]** Brief to paste (example — swap in your own three sentences):
> "世界觀：新竹老城區一棟日式老宅，九降風、木頭與曬過棉被的氣味。主角：二十三歲剛畢業、還住在家裡，該不該搬出去家裡沒人先提。背景：主角和屋裡另一個人之間有一段沒說開的關係。"

**Narration** (over the calls firing):
> "The creator gives three sentences. The agent calls `get_checklist_status` — the page hands back nine aspects a card needs, and for each one a *decision axis*: the thing a set of options should actually differ on. For 'world rules' that's architectural-vs-real and the recurring sensory anchor. The agent proposes concrete options along that axis; the creator picks one; `update_card_field` records it and the aspect turns green. The page owns the map of what's missing and where each answer lands in the card. The agent owns the judgment — turning a brief into real choices — which is the one part that isn't deterministic."

**On screen beat**: zoom the checklist strip going from mostly ⬜ to mostly ✅, fill-rate bar climbing.

## 1:55–2:35 — With WebMCP · Part 2 — playtest + cross-scenario compare

**On screen**: still creator mode. The agent calls `list_scenarios`, picks the `first_mes` scenario and one alternate greeting, and for each runs `run_scenario` → `get_playtest_context` → (writes the round) → `commit_playtest_round`. Then switch to **游戲商模式（多情境比較）** and run `compare_scenarios`.

**Narration**:
> "Now playtest it. `run_scenario` starts a session; `get_playtest_context` returns exactly which world-book entries are live *this round* and why — keyword match, constant, still in cooldown — computed by the page, not remembered by the model. The agent writes the character's turn using only what's listed; `commit_playtest_round` applies the regex scripts and the variable patch, deterministically, and reports any warning honestly. Run a second scenario, then switch to publisher mode: `compare_scenarios` is read-only — it takes the runs that already happened and flags which entries fired in *all* of them versus only *some*. That inconsistency is the QA signal a publisher actually needs, and nothing working from the rendered page can compute it."

**On screen beat**: zoom the compare summary — the `world_entries_triggered_in_some` list, warning tag on the inconsistent entry.

## 2:35–2:55 — Technical + close

**On screen**: terminal running `npm test` (all passing), quick cut to `test/golden/`.

**Narration**:
> "tableread never calls an LLM itself — zero API key, every generation happens on the calling agent's own side. The playtest logic is ported from an existing Python engine and checked against it with a golden-parity suite, so the tools the agent calls are backed by tested, deterministic code — not another model's guess."

Close on the repo URL and live demo URL on screen.

## Post-production

- [ ] [HUMAN] Add captions (burned-in, or YouTube auto + manual correction — if the narration is not in English, correct the auto-captions; auto-captions on non-English audio are unreliable).
- [ ] [HUMAN] Upload as **Public** YouTube video, <3:00 total runtime.
- [ ] [HUMAN] Backfill the URL into `README.md`'s `Demo 影片` line, `docs/submission.md`, and Devpost.
