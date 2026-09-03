// The 7 richness aspects + the MVU decision + the card-beautify direction,
// from reference/st-writer-src's references/checklist.md, variable-system.md
// and regex-beautify-guide.md, used to track draft completion. Status is a
// judgment call (known / pending-confirm / pending-ideation) the calling
// agent makes together with the human -- it is written explicitly via
// update_card_field, never inferred from whether a field happens to be
// non-empty.
//
// Each aspect also carries two agent-facing hints, surfaced by
// get_checklist_status so an Agent working from nothing more than a short
// brief knows how to help *ideate* the gaps, not just record decisions:
//   - axis:  the decision axis a set of proposed options should differ on.
//            When an aspect is still pending_ideation, the agent offers the
//            human 2-3 concrete options that diverge meaningfully along this
//            axis, rather than one guessed answer.
//   - feeds: where a settled answer ends up in the assembled card (which
//            field / which kind of world-book entry), so the agent records
//            it in the right place afterwards.

export const CHECKLIST_ASPECTS = [
  {
    key: "cast",
    label: "登場人物",
    axis: "{{user}} 的初始身分是固定設定、還是開場讓玩家自訂；開場場景裡除了 {{char}} 還有誰在（背景角色之後可能轉成常駐 NPC）",
    feeds: "scenario、first_mes / alternate_greetings、system_prompt 的開局身分判定邏輯",
  },
  {
    key: "world_rules",
    label: "世界觀規則",
    axis: "架空還是現實；這個世界跟現實差在哪一條規則（沒有奇幻設定就改為定調氛圍基調，例如高壓都會 vs. 悠閒鄉村）；一個會反覆出現、營造代入感的感官錨點（氣味／聲音／天氣／光線）",
    feeds: "scenario、世界書「世界觀氛圍」條目（多設為 constant 常駐）",
  },
  {
    key: "special_events",
    label: "特殊事件",
    axis: "要不要機率性隨機事件、劇情里程碑事件（季節活動／生日／特定地點限定邂逅）、玩家關鍵詞觸發事件——各挑要哪幾種",
    feeds: "世界書「隨機事件」條目、system_prompt 的事件判定邏輯",
  },
  {
    key: "intimacy_preferences",
    label: "情感／親密偏好",
    axis: "角色在情感關係中的依附傾向（安全／焦慮／逃避型）；明確的底線與雷點；若涉及成人向，角色的偏好、節奏與會讓 ta 卸下防備的觸發點",
    feeds: "personality、世界書「親密偏好」條目（建議 selective 關鍵詞觸發，不常駐）",
  },
  {
    key: "backstory",
    label: "背景故事",
    axis: "哪 2-3 個過去事件形塑了現在的性格；有沒有一開始藏起來、要靠玩家慢慢解鎖的隱藏設定（有的話需在 system_prompt 明訂反劇透原則）",
    feeds: "description（可分層：表層人設＋加鎖的深層設定提示）、世界書「過去經歷」條目",
  },
  {
    key: "npc_network",
    label: "NPC 關係網",
    axis: "要哪些 NPC（損友／家人／同事／競爭對手）；每個 NPC 在場時會怎麼改變主角的行為（家人拆穿偽裝、損友讓主角卸防）；NPC 之間有沒有關聯",
    feeds: "世界書逐條 NPC 條目（selective，用姓名／暱稱／身分當關鍵詞）",
  },
  {
    key: "psych_arc",
    label: "角色心理狀態進展脈絡",
    axis: "分幾個階段（每階段的「表象」與「內心」落差）；階段轉換靠好感度數值門檻（需要 MVU）還是靠劇情里程碑（模型自行判斷）；需不需要明文禁止越級演繹",
    feeds: "system_prompt 的狀態機描述；若採用 MVU，STATUS_DATA 的「關係階段」欄位",
  },
  {
    key: "mvu",
    label: "是否需要 MVU 動態變量卡",
    axis: "這張卡需不需要跨對話持久追蹤的數值；需要的話追哪些（好感度／心跳值／關係階段／Phase 標籤）；不需要就別為了炫技硬塞",
    feeds: "STATUS_DATA 欄位設計＋「變量更新腦」（指示模型每輪用 JSON Patch 輸出異動），或整段略過",
  },
  {
    key: "beautify",
    label: "卡片美化方向（狀態欄／視覺風格）",
    axis: "上／下狀態欄各要顯示哪些欄位；要不要 light/dark 主題與切換規則（例如依故事內時間）；配色與調性；要不要小遊戲／觸發事件的專屬卡片區塊；數值要不要做成進度條或加動畫",
    feeds: "data.extensions.regex_scripts[]、system_prompt 裡定義給模型輸出的純文字標記格式（如 [HEADER_CARD]…[/HEADER_CARD]）",
  },
];

export const CHECKLIST_ASPECT_KEYS = CHECKLIST_ASPECTS.map((a) => a.key);

export const CHECKLIST_STATUSES = ["known", "pending_confirm", "pending_ideation"];

export const CHECKLIST_STATUS_ICON = {
  known: "✅",
  pending_confirm: "🟡",
  pending_ideation: "⬜",
};
