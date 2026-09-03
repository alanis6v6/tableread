// The ten WebMCP tools' descriptions and parameter descriptions, in both
// languages the page offers. The agent reads whichever language the page is
// in (see src/i18n.js); registerTools.js pulls from here.
//
// `{ASPECT_KEYS}` in update_card_field is substituted with the live checklist
// aspect key list at build time (the keys themselves are language-neutral).
//
// The English is the translation done on the desktop-visual-redesign branch,
// with get_checklist_status / update_card_field brought in line with the
// ideation-guide rewrite (PR #16).

export const TOOL_TEXT = {
  zh: {
    get_checklist_status:
      "讀取角色卡草稿在九個檢核面向上的完成狀態（known=已知/pending_confirm=待確認/pending_ideation=待發想）：七個豐富度面向（登場人物/世界觀規則/特殊事件/情感親密偏好/背景故事/NPC關係網/心理狀態進展脈絡）＋「是否需要MVU動態變量卡」＋「卡片美化方向」。純讀取，不修改任何東西。\n\n" +
      "這是「從一段概述開始發想整張卡」流程的起點：使用者通常一開始只會給一段簡短的世界觀／登場人物／背景故事概述，你的工作是照這份狀態，一次挑 1-2 個 pending_ideation 的面向，依回傳 aspects[] 裡該面向的 axis（發想時提出的方案要在這條決策軸上有實質差異）給使用者 2-3 個具體方案挑，選定後用 update_card_field 把方向記進去（該面向轉 known）。aspects[].feeds 說明這個面向最後會寫進卡片的哪個欄位／哪種世界書條目。每次要向使用者提問或提案前都先呼叫一次，避免重複問已經 known 的、或漏掉還沒碰的面向。",

    update_card_field:
      "把一段內容或一個判斷結果寫進草稿狀態。每次使用者確認了一個決定、或你擴寫出一段內容並得到使用者認可後就呼叫一次，不要囤積到最後才一次寫入。" +
      " section 只能是以下兩類之一：" +
      " (a) 檢核表面向 key（{ASPECT_KEYS}）——此時 value 必須是 {status, note?}，用來記錄這個面向目前的判斷結果；發想完成、要把 status 設成 known 時，note 請寫一句選定方向的摘要（採用了哪個方案），不要留空；" +
      " (b) 卡片內容欄位 key —— 字串欄位：name/world_name/description/personality/scenario/first_mes/mes_example/system_prompt/creator_notes；" +
      " 陣列欄位：tags/alternate_greetings/character_book_entries/regex_scripts（character_book_entries 依 chara_card_v3 的 character_book.entries[] schema，regex_scripts 依 data.extensions.regex_scripts[] schema，兩者皆可參考 reference/st-writer-src 的 card-format.md）。",
    update_card_field_section: "檢核表面向 key，或卡片欄位 key（見上方 description）。",
    update_card_field_value: "依 section 而定：checklist 面向傳 {status, note?}；字串欄位傳字串；陣列欄位傳陣列。",

    assemble_card:
      "把目前草稿的所有欄位（含世界書 character_book_entries 與 regex_scripts）組裝成一份完整、符合 chara_card_v3 規格的角色卡 JSON。要匯出卡片、或準備開始試玩模擬（run_scenario 內部也會呼叫這個組裝邏輯）之前呼叫。純讀取目前狀態組裝輸出，不檢查草稿『完不完整』——欄位有沒有漏是你跟使用者透過 get_checklist_status 一起把關的事。",

    list_scenarios:
      "列出目前可以拿來試玩的情境：草稿的 first_mes 一個、每個 alternate_greetings 各一個，加上先前用 add_scenario 手動加過的自訂情境。每個情境回傳 {id, label, text}（text 是這個情境的起手文字）。呼叫 run_scenario 之前，先呼叫這個工具拿到你要測試的 scenario 的 id。",

    add_scenario:
      "新增一個不屬於卡片 first_mes/alternate_greetings 的自訂試玩情境（例如「玩家一開始就很兇」「半夜傳訊息」），適合想測試卡片在非預設起手情境下的反應、或遊戲商比較模式一次測多種情境時使用。description 會被當成這個情境的起手文字（等同一個臨時的 first_mes）。回傳新情境的 id，之後用這個 id 呼叫 run_scenario。",
    add_scenario_description: "這個自訂情境的起手文字/情境描述。",

    run_scenario:
      "針對某個情境開始一次全新的試玩模擬：用草稿『目前最新』的內容組裝一張卡，建立一個全新的 session（會蓋掉這個 scenario_id 之前跑過的紀錄），並宣告打算跑幾輪。呼叫順序：list_scenarios（或 add_scenario）拿到 scenario_id → run_scenario → 對 round=1..rounds 依序重複「get_playtest_context(scenario_id, round) → 依輸出寫這一輪的玩家台詞與角色演出 → commit_playtest_round(scenario_id, round, ...)」。rounds 只是回報給你的目標輪數，這個工具不會自動幫你跑完每一輪，每一輪都要你實際呼叫 get_playtest_context/commit_playtest_round。",
    run_scenario_rounds: "打算跑的目標輪數（頁數）。",

    get_playtest_context:
      "在你要寫第 round 輪的玩家台詞與角色演出『之前』一定要呼叫這個工具，不能跳過、也不能只呼叫一次就套用到後面所有輪次。回傳這一輪真正會被注入的世界書內容（active_world_entries，每條含 comment/content）與目前的變量狀態（current_vars）——這是用關鍵詞掃描＋常駐/冷卻/延遲規則精確計算出來的，不是憑印象猜的。" +
      "【強制規則】你只能使用這份輸出裡列出的 active_world_entries 內容來寫這一輪的演出，不可以使用你自己記得、但這一輪其實沒有被列出來的角色設定或劇情細節。如果某個你以為理所當然的細節這輪沒被列出來，角色的演出就應該表現得「不知道／沒被提起」——這種落差本身就是有價值的 QA 發現，不是要你偷偷補回去的漏洞。" +
      " round 必須是這個 scenario 目前「下一輪」的編號，從 1 開始（run_scenario 建立時的開場白算第 0 輪，不需要也不能對它呼叫這個工具）。",

    commit_playtest_round:
      "在你已經呼叫過 get_playtest_context(scenario_id, round)、並依照該輸出寫好這一輪的玩家台詞（player_text）與角色的完整原始輸出（char_text）之後才呼叫這個工具，順序不能顛倒。char_text 必須完整照卡片 system_prompt 規定的格式輸出——包含所有純文字標記（如 [HEAD]/[BODY] 之類）與 <!-- <VariableUpdateLog>...--> 變量更新區塊，一字不能少，因為這段原始文字接下來會被實際解析、實際套用 regex，格式不合規會在回傳的 warnings 裡顯形。這個工具會：解析並套用 char_text 裡的 JSON Patch 變量更新、去除 HTML 註解、套用卡片的 regex_scripts 渲染成最終 HTML、把這一輪存進這個情境的逐輪紀錄。回傳 patch_found（有沒有成功解析到變量更新區塊）、vars_after（套用後的變量狀態）、warnings（regex 編譯失敗、抓不到匹配、JSON Patch 解析失敗等）——warnings 要老實回報給使用者，不要略過或幫忙掩飾。",
    commit_playtest_round_player_text: "這一輪玩家的原始台詞/動作描述，可留空字串。",
    commit_playtest_round_char_text: "角色這一輪的完整原始輸出，須完整符合卡片格式規定。",

    get_transcript:
      "取得某個情境累積到目前為止的逐輪紀錄（含開場白的第 0 輪），供你或前端 UI 直接渲染，不會產生 HTML 檔案。每輪包含 player_raw/char_raw（原始文字）、char_html（套用 regex 之後的渲染結果）、vars_snapshot（該輪之後的變量狀態）、patch_found、warnings。適合在使用者想回顧目前跑到哪一輪、或要整理 QA 摘要時呼叫。",

    compare_scenarios:
      "遊戲商模式（多情境比較）用的唯讀工具：把一批已經跑過的 scenario_id 攤開成一份逐情境比較，並算出跨情境的世界書觸發差異。這個工具只讀，不會替你執行任何情境——建議在多個情境都已經各自完整跑過一輪 run_scenario → get_playtest_context/commit_playtest_round 之後才呼叫，才有東西可比。對於還沒 run_scenario 過的 scenario_id，不會讓整次呼叫失敗，只會在對應那一筆標記 {scenario_id, error}。回傳的 world_entries_triggered_in_some（有些情境觸發過、有些沒有）是最值得注意的 QA 訊號——代表同一份世界書在不同情境下觸發不一致，值得檢查關鍵詞/常駐設定是否符合預期。",
    compare_scenarios_ids: "要比較的情境 id 列表，來自 list_scenarios/add_scenario 回傳的 id。",
  },

  en: {
    get_checklist_status:
      "Reads the draft character card's completion status across nine checklist aspects (known / pending_confirm / pending_ideation): the seven richness aspects (cast / world-building rules / special events / emotional & intimacy preferences / backstory / NPC relationship network / psychological-state progression arc) plus the \"does this need an MVU dynamic-variable card\" decision and the \"card-beautify direction\". Read-only, does not modify anything.\n\n" +
      "This is the entry point for the \"ideate the whole card from a brief\" flow: the user usually starts with only a short world/character/backstory brief, and your job is to pick 1-2 pending_ideation aspects at a time and, using that aspect's `axis` from the returned `aspects[]` (proposed options should differ meaningfully along this axis), offer the user 2-3 concrete options to choose from; once they pick one, record it with update_card_field (flipping that aspect to known). `aspects[].feeds` tells you which card field or which kind of world-book entry the settled answer ultimately belongs in. Call this once before asking the user the next question or making a proposal, so you don't re-ask something already known and don't skip an aspect still stuck at pending_ideation.",

    update_card_field:
      "Writes one piece of content or one judgment call into the draft state. Call this every time the user confirms a decision, or you've drafted a passage and gotten the user's approval on it — don't stockpile everything and write it all at once at the end." +
      " `section` must be one of two kinds:" +
      " (a) a checklist aspect key ({ASPECT_KEYS}) — in which case `value` must be {status, note?}, recording the current judgment call for that aspect; when ideation is settled and you're flipping status to known, `note` should be one sentence summarizing which option was chosen — never leave it blank;" +
      " (b) a card content field key — string fields: name/world_name/description/personality/scenario/first_mes/mes_example/system_prompt/creator_notes;" +
      " array fields: tags/alternate_greetings/character_book_entries/regex_scripts (character_book_entries follows chara_card_v3's character_book.entries[] schema, regex_scripts follows data.extensions.regex_scripts[] schema — both documented in reference/st-writer-src's card-format.md).",
    update_card_field_section: "A checklist aspect key, or a card field key (see the description above).",
    update_card_field_value:
      "Depends on `section`: a checklist aspect takes {status, note?}; a string field takes a string; an array field takes an array.",

    assemble_card:
      "Assembles every field of the current draft (including the character_book_entries world-book and regex_scripts) into a complete chara_card_v3-compliant character card JSON. Call this before exporting the card, or before starting a playtest simulation (run_scenario also calls this assembly logic internally). Purely reads the current state and assembles the output — it does not check whether the draft is \"complete\"; whether any field is still missing is something you and the user track together via get_checklist_status.",

    list_scenarios:
      "Lists the scenarios currently available to playtest: one for the draft's first_mes, one for each alternate_greetings entry, plus any custom scenarios previously added with add_scenario. Each scenario is returned as {id, label, text} (text is that scenario's opening line). Call this before run_scenario to get the id of the scenario you want to test.",

    add_scenario:
      "Adds a custom playtest scenario that isn't part of the card's first_mes/alternate_greetings (e.g. \"the player is hostile from the start\", \"a message arrives in the middle of the night\") — useful for testing how the card behaves outside its default openings, or when game-publisher comparison mode needs to test several scenarios at once. `description` becomes that scenario's opening line (equivalent to a temporary first_mes). Returns the new scenario's id; call run_scenario with that id afterward.",
    add_scenario_description: "This custom scenario's opening line / scenario description.",

    run_scenario:
      "Starts a brand-new playtest simulation for a given scenario: assembles a card from the draft's *current* latest content, creates a fresh session (overwriting any prior run recorded under this scenario_id), and declares how many rounds you intend to run. Call order: list_scenarios (or add_scenario) to get a scenario_id → run_scenario → for round = 1..rounds, repeat \"get_playtest_context(scenario_id, round) → write that round's player line and character performance from its output → commit_playtest_round(scenario_id, round, ...)\". `rounds` is only the target round count reported back to you — this tool does not run any round for you; you must actually call get_playtest_context/commit_playtest_round for every single round.",
    run_scenario_rounds: "The target number of rounds (pages) you intend to run.",

    get_playtest_context:
      "You MUST call this before writing round `round`'s player line and character performance — never skip it, and never call it once and reuse its output for every later round. Returns the world-book content actually injected this round (active_world_entries, each with comment/content) and the current variable state (current_vars) — computed precisely from keyword scanning plus constant/sticky/cooldown/delay rules, not guessed from memory." +
      " [MANDATORY RULE] Only use the world-book content and variables returned by this call to write the character's performance this round — do not rely on entries you recall from earlier rounds that were not returned here, and do not use character settings or plot details you remember yourself but that weren't actually listed for this round. If some detail you assumed was a given wasn't listed this round, the character's performance should reflect \"doesn't know / hasn't come up\" — that gap is itself a valuable QA finding, not a hole for you to quietly patch over." +
      " `round` must be this scenario's current \"next\" round number, starting at 1 (the opening line created by run_scenario counts as round 0 — you do not need to, and must not, call this for round 0).",

    commit_playtest_round:
      "Call this only after you've already called get_playtest_context(scenario_id, round) and written this round's player line (player_text) and the character's complete raw output (char_text) based on it — the order cannot be reversed. char_text must fully comply with the format the card's system_prompt specifies — including every plain-text marker (like [HEAD]/[BODY]) and the <!-- <VariableUpdateLog>...--> variable-update block, with nothing dropped, because this raw text is about to be actually parsed and have regex actually applied to it; a non-compliant format will show up in the returned warnings. This tool: parses and applies the JSON Patch variable update in char_text, strips HTML comments, renders through the card's regex_scripts into the final HTML, and stores this round into that scenario's round-by-round record. Returns patch_found (whether a variable-update block was successfully parsed), vars_after (the resulting variable state), and warnings (regex compile failures, no match found, JSON Patch parse failures, etc.) — warnings must be reported to the user honestly, never dropped or glossed over.",
    commit_playtest_round_player_text: "This round's raw player line/action description; may be left as an empty string.",
    commit_playtest_round_char_text:
      "The character's complete raw output for this round, which must fully comply with the card's format rules.",

    get_transcript:
      "Fetches a scenario's round-by-round record accumulated so far (including the opening line as round 0), for you or the front-end UI to render directly — no HTML file is produced. Each round includes player_raw/char_raw (raw text), char_html (the result after applying regex), vars_snapshot (variable state after that round), patch_found, and warnings. Call this when the user wants to review how far a scenario has progressed, or when putting together a QA summary.",

    compare_scenarios:
      "A read-only tool for game-publisher mode (multi-scenario comparison): lays out a batch of already-run scenario_ids as a side-by-side comparison and computes cross-scenario world-book trigger discrepancies. This tool only reads — it never runs any scenario for you; call it after several scenarios have each already been fully run once via run_scenario → get_playtest_context/commit_playtest_round, so there's something to compare. A scenario_id that hasn't been run via run_scenario doesn't fail the whole call — it's simply marked as {scenario_id, error} in its slot. The returned world_entries_triggered_in_some (triggered in some scenarios but not others) is the most important QA signal — it means the same world-book entry fires inconsistently across scenarios, worth checking whether its keywords/constant setting behave as intended.",
    compare_scenarios_ids: "The list of scenario ids to compare, from the ids returned by list_scenarios/add_scenario.",
  },
};
