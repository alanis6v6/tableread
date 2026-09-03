// The 7 richness aspects + the MVU decision + the card-beautify direction,
// from reference/st-writer-src's references/checklist.md, variable-system.md
// and regex-beautify-guide.md, used to track draft completion. Status is a
// judgment call (known / pending-confirm / pending-ideation) the calling
// agent makes together with the human -- it is written explicitly via
// update_card_field, never inferred from whether a field happens to be
// non-empty.
//
// label / axis / feeds are bilingual ({ zh, en }); getLocalizedAspects(lang)
// flattens them for whichever language the page is showing. get_checklist_status
// surfaces axis + feeds so an Agent working from nothing more than a short
// brief knows how to help *ideate* the gaps, not just record decisions:
//   - axis:  the decision axis a set of proposed options should differ on.
//   - feeds: where a settled answer ends up in the assembled card.

export const CHECKLIST_ASPECTS = [
  {
    key: "cast",
    label: { zh: "登場人物", en: "Cast" },
    axis: {
      zh: "{{user}} 的初始身分是固定設定、還是開場讓玩家自訂；開場場景裡除了 {{char}} 還有誰在（背景角色之後可能轉成常駐 NPC）",
      en: "Whether {{user}}'s starting identity is fixed or chosen by the player at the opening; who else besides {{char}} is present in the opening scene (a background face may later become a recurring NPC)",
    },
    feeds: {
      zh: "scenario、first_mes / alternate_greetings、system_prompt 的開局身分判定邏輯",
      en: "scenario, first_mes / alternate_greetings, and the opening-identity logic in system_prompt",
    },
  },
  {
    key: "world_rules",
    label: { zh: "世界觀規則", en: "World rules" },
    axis: {
      zh: "架空還是現實；這個世界跟現實差在哪一條規則（沒有奇幻設定就改為定調氛圍基調，例如高壓都會 vs. 悠閒鄉村）；一個會反覆出現、營造代入感的感官錨點（氣味／聲音／天氣／光線）",
      en: "Fictional or real-world; the one rule this world differs from reality by (with no fantasy element, set the tone instead — high-pressure city vs. quiet countryside); one recurring sensory anchor (smell / sound / weather / light) that builds immersion",
    },
    feeds: {
      zh: "scenario、世界書「世界觀氛圍」條目（多設為 constant 常駐）",
      en: "scenario, and the world-book \"world atmosphere\" entry (usually set constant)",
    },
  },
  {
    key: "special_events",
    label: { zh: "特殊事件", en: "Special events" },
    axis: {
      zh: "要不要機率性隨機事件、劇情里程碑事件（季節活動／生日／特定地點限定邂逅）、玩家關鍵詞觸發事件——各挑要哪幾種",
      en: "Which of these to include: probability-based random events, plot-milestone events (seasonal activities / birthdays / location-locked encounters), player-keyword-triggered events",
    },
    feeds: {
      zh: "世界書「隨機事件」條目、system_prompt 的事件判定邏輯",
      en: "the world-book \"random events\" entries, and the event logic in system_prompt",
    },
  },
  {
    key: "intimacy_preferences",
    label: { zh: "情感／親密偏好", en: "Emotional / intimacy preferences" },
    axis: {
      zh: "角色在情感關係中的依附傾向（安全／焦慮／逃避型）；明確的底線與雷點；若涉及成人向，角色的偏好、節奏與會讓 ta 卸下防備的觸發點",
      en: "The character's attachment style in a relationship (secure / anxious / avoidant); explicit boundaries and hard limits; for adult content, their preferences, pacing, and what makes them lower their guard",
    },
    feeds: {
      zh: "personality、世界書「親密偏好」條目（建議 selective 關鍵詞觸發，不常駐）",
      en: "personality, and a world-book \"intimacy preferences\" entry (best made selective/keyword-triggered, not constant)",
    },
  },
  {
    key: "backstory",
    label: { zh: "背景故事", en: "Backstory" },
    axis: {
      zh: "哪 2-3 個過去事件形塑了現在的性格；有沒有一開始藏起來、要靠玩家慢慢解鎖的隱藏設定（有的話需在 system_prompt 明訂反劇透原則）",
      en: "Which 2-3 past events shaped who they are now; whether there's a hidden layer kept back for the player to unlock slowly (if so, system_prompt needs an explicit no-spoiler rule)",
    },
    feeds: {
      zh: "description（可分層：表層人設＋加鎖的深層設定提示）、世界書「過去經歷」條目",
      en: "description (can be layered: surface persona + a locked deeper-lore hint), and a world-book \"past experiences\" entry",
    },
  },
  {
    key: "npc_network",
    label: { zh: "NPC 關係網", en: "NPC network" },
    axis: {
      zh: "要哪些 NPC（損友／家人／同事／競爭對手）；每個 NPC 在場時會怎麼改變主角的行為（家人拆穿偽裝、損友讓主角卸防）；NPC 之間有沒有關聯",
      en: "Which NPCs (bad-influence friend / family / colleague / rival); how each one being present changes the lead's behaviour (family exposes the mask, a close friend lets them drop it); whether the NPCs are connected to each other",
    },
    feeds: {
      zh: "世界書逐條 NPC 條目（selective，用姓名／暱稱／身分當關鍵詞）",
      en: "one world-book entry per NPC (selective, keyed on name / nickname / role)",
    },
  },
  {
    key: "psych_arc",
    label: { zh: "角色心理狀態進展脈絡", en: "Psychological progression arc" },
    axis: {
      zh: "分幾個階段（每階段的「表象」與「內心」落差）；階段轉換靠好感度數值門檻（需要 MVU）還是靠劇情里程碑（模型自行判斷）；需不需要明文禁止越級演繹",
      en: "How many phases (the gap between \"surface\" and \"inner\" per phase); whether phase transitions run on an affinity number threshold (needs MVU) or on plot milestones (model's own judgment); whether to explicitly forbid skipping ahead",
    },
    feeds: {
      zh: "system_prompt 的狀態機描述；若採用 MVU，STATUS_DATA 的「關係階段」欄位",
      en: "the state-machine description in system_prompt; if using MVU, the \"relationship phase\" field in STATUS_DATA",
    },
  },
  {
    key: "mvu",
    label: { zh: "是否需要 MVU 動態變量卡", en: "Whether an MVU dynamic-variable card is needed" },
    axis: {
      zh: "這張卡需不需要跨對話持久追蹤的數值；需要的話追哪些（好感度／心跳值／關係階段／Phase 標籤）；不需要就別為了炫技硬塞",
      en: "Whether this card needs values tracked persistently across chats; if so, which ones (affinity / heartbeat / relationship phase / phase tag); if not, don't bolt one on for show",
    },
    feeds: {
      zh: "STATUS_DATA 欄位設計＋「變量更新腦」（指示模型每輪用 JSON Patch 輸出異動），或整段略過",
      en: "STATUS_DATA field design + the \"variable-update brain\" (instructing the model to emit a JSON Patch of changes each round), or skip the whole thing",
    },
  },
  {
    key: "beautify",
    label: { zh: "卡片美化方向（狀態欄／視覺風格）", en: "Card-beautify direction (status bar / visual style)" },
    axis: {
      zh: "上／下狀態欄各要顯示哪些欄位；要不要 light/dark 主題與切換規則（例如依故事內時間）；配色與調性；要不要小遊戲／觸發事件的專屬卡片區塊；數值要不要做成進度條或加動畫",
      en: "Which fields the top / bottom status bars show; whether to have light/dark themes and a switch rule (e.g. by in-story time); palette and tone; whether mini-games / triggered events get their own card block; whether numeric values become progress bars or get animation",
    },
    feeds: {
      zh: "data.extensions.regex_scripts[]、system_prompt 裡定義給模型輸出的純文字標記格式（如 [HEADER_CARD]…[/HEADER_CARD]）",
      en: "data.extensions.regex_scripts[], and the plain-text marker format defined for the model to emit in system_prompt (e.g. [HEADER_CARD]…[/HEADER_CARD])",
    },
  },
];

export const CHECKLIST_ASPECT_KEYS = CHECKLIST_ASPECTS.map((a) => a.key);

export const CHECKLIST_STATUSES = ["known", "pending_confirm", "pending_ideation"];

export const CHECKLIST_STATUS_ICON = {
  known: "✅",
  pending_confirm: "🟡",
  pending_ideation: "⬜",
};

/** Flattens the bilingual aspect table down to one language:
 * [{ key, label, axis, feeds }]. Falls back to zh for an unknown lang. */
export function getLocalizedAspects(lang = "zh") {
  const pick = (field) => field[lang] ?? field.zh;
  return CHECKLIST_ASPECTS.map((a) => ({
    key: a.key,
    label: pick(a.label),
    axis: pick(a.axis),
    feeds: pick(a.feeds),
  }));
}
