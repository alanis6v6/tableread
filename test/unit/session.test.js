import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlaytestSession } from "../../src/engine/session.js";

function miniCard() {
  return {
    data: {
      name: "測試角色",
      character_book: {
        entries: [
          { id: 0, constant: true, enabled: true, comment: "常駐", content: "世界觀氛圍" },
          { id: 1, keys: ["彩蛋"], enabled: true, comment: "彩蛋NPC", content: "彩蛋出現時的介紹" },
        ],
      },
      extensions: {
        regex_scripts: [
          {
            scriptName: "hide-patch",
            findRegex: "<!--[\\s\\S]*?-->",
            replaceString: "",
          },
        ],
      },
    },
  };
}

test("createPlaytestSession seeds round 0 from the opening text", () => {
  const session = createPlaytestSession(miniCard(), { id: "first_mes", text: "故事從這裡開始。" });
  const transcript = session.getTranscript();
  assert.equal(transcript.length, 1);
  assert.equal(transcript[0].round, 0);
  assert.equal(transcript[0].player_raw, null);
  assert.equal(transcript[0].char_raw, "故事從這裡開始。");
});

test("getContext only reflects previously committed rounds, not the round being written", () => {
  const session = createPlaytestSession(miniCard(), { id: "x", text: "開場白，主角走進了空無一人的房間。" });
  // Round 1's own player text mentioning "彩蛋" must NOT affect round 1's own context.
  let ctx = session.getContext(1);
  assert.deepEqual(ctx.active_world_entries.map((e) => e.comment), ["常駐"]);

  session.commitRound(1, "我看到了彩蛋！", "角色轉頭看了看。");

  // It should affect round 2's context, since round 1 is now committed history.
  ctx = session.getContext(2);
  assert.deepEqual(ctx.active_world_entries.map((e) => e.comment).sort(), ["常駐", "彩蛋NPC"]);
});

test("commitRound applies JSON Patch and strips it from the rendered HTML", () => {
  const session = createPlaytestSession(miniCard(), { id: "x", text: "開場白。" });
  const charText = [
    "角色露出微笑。",
    "<!-- <VariableUpdateLog><JSONPatch>",
    '[{ "op": "replace", "path": "/好感度", "value": 10 }]',
    "</JSONPatch></VariableUpdateLog> -->",
  ].join("\n");

  const result = session.commitRound(1, "你好", charText);
  assert.equal(result.patch_found, true);
  assert.deepEqual(result.vars_after, { 好感度: 10 });
  assert.deepEqual(result.warnings, []);

  const transcript = session.getTranscript();
  assert.equal(transcript.length, 2); // round 0 + round 1
  assert.equal(transcript[1].char_html, "角色露出微笑。\n");
});

test("getTranscript returns independent copies (mutating the result doesn't affect the session)", () => {
  const session = createPlaytestSession(miniCard(), { id: "x", text: "開場白。" });
  const t1 = session.getTranscript();
  t1[0].char_raw = "mutated";
  const t2 = session.getTranscript();
  assert.equal(t2[0].char_raw, "開場白。");
});
