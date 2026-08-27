// Ported from playtest_engine.py's load_card(). Reads the parts of a
// chara_card_v3 JSON object the deterministic engine needs, tolerating both
// the V3 nested `data` shape and the flatter V2-compatible top-level shape.

export function loadCard(cardJson) {
  const data = cardJson.data || cardJson;
  const entries =
    (data.character_book && data.character_book.entries) ||
    (cardJson.character_book && cardJson.character_book.entries) ||
    [];
  const regexScripts =
    (data.extensions && data.extensions.regex_scripts) ||
    (cardJson.extensions && cardJson.extensions.regex_scripts) ||
    [];
  return { data, entries, regexScripts };
}
