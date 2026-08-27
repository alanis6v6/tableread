// Assembles a draft's fields into a chara_card_v3 JSON object, per
// reference/st-writer-src's references/card-format.md and
// assets/character_card_template.json. Keeps the V2-compatible top-level
// fields in sync with the V3 data.* fields, as the spec requires.

export function assembleCard(fields) {
  const core = {
    name: fields.name || "",
    description: fields.description || "",
    personality: fields.personality || "",
    scenario: fields.scenario || "",
    first_mes: fields.first_mes || "",
    mes_example: fields.mes_example || "",
  };

  return {
    ...core,
    creatorcomment: fields.creator_notes || "",
    avatar: "none",
    talkativeness: "0.5",
    fav: false,
    tags: fields.tags || [],
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      ...core,
      creator_notes: fields.creator_notes || "",
      system_prompt: fields.system_prompt || "",
      post_history_instructions: "",
      tags: fields.tags || [],
      creator: "",
      character_version: "v1",
      alternate_greetings: fields.alternate_greetings || [],
      character_book: {
        entries: fields.character_book_entries || [],
        name: fields.world_name || "",
      },
      extensions: {
        talkativeness: "0.5",
        fav: false,
        world: fields.world_name || "",
        depth_prompt: { prompt: "", depth: 4, role: "system" },
        regex_scripts: fields.regex_scripts || [],
      },
    },
  };
}
