// The 7 richness aspects + the MVU decision from
// reference/st-writer-src's references/checklist.md and variable-system.md,
// used to track draft completion. Status is a judgment call (known /
// pending-confirm / pending-ideation) the calling agent makes together with
// the human -- it is written explicitly via update_card_field, never
// inferred from whether a field happens to be non-empty.

export const CHECKLIST_ASPECTS = [
  { key: "cast", label: "登場人物" },
  { key: "world_rules", label: "世界觀規則" },
  { key: "special_events", label: "特殊事件" },
  { key: "intimacy_preferences", label: "情感／親密偏好" },
  { key: "backstory", label: "背景故事" },
  { key: "npc_network", label: "NPC 關係網" },
  { key: "psych_arc", label: "角色心理狀態進展脈絡" },
  { key: "mvu", label: "是否需要 MVU 動態變量卡" },
];

export const CHECKLIST_ASPECT_KEYS = CHECKLIST_ASPECTS.map((a) => a.key);

export const CHECKLIST_STATUSES = ["known", "pending_confirm", "pending_ideation"];

export const CHECKLIST_STATUS_ICON = {
  known: "✅",
  pending_confirm: "🟡",
  pending_ideation: "⬜",
};
