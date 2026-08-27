// The single in-memory draft a creator-mode page is working on. Holds both
// the card's actual content fields and the checklist judgment calls
// (references/checklist.md's 7 aspects + the MVU decision), all written
// through the one generic update_card_field(section, value) tool so the
// calling agent has a single, uniform way to record progress.
import { CHECKLIST_ASPECT_KEYS } from "./checklist.js";

// Card content sections update_card_field accepts. Scalar fields hold a
// string; array fields hold an array (character_book_entries follow
// card-format.md's character_book.entries[] shape, regex_scripts follow
// data.extensions.regex_scripts[]).
export const SCALAR_FIELD_KEYS = [
  "name",
  "world_name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "system_prompt",
  "creator_notes",
];
export const ARRAY_FIELD_KEYS = ["tags", "alternate_greetings", "character_book_entries", "regex_scripts"];
export const CARD_FIELD_KEYS = [...SCALAR_FIELD_KEYS, ...ARRAY_FIELD_KEYS];

function emptyFields() {
  const fields = {};
  for (const k of SCALAR_FIELD_KEYS) fields[k] = "";
  for (const k of ARRAY_FIELD_KEYS) fields[k] = [];
  return fields;
}

function emptyChecklist() {
  const checklist = {};
  for (const key of CHECKLIST_ASPECT_KEYS) checklist[key] = { status: "pending_ideation", note: "" };
  return checklist;
}

export function createDraftStore() {
  const state = {
    fields: emptyFields(),
    checklist: emptyChecklist(),
  };
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn(state);
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    getSnapshot() {
      return structuredClone(state);
    },

    /** Returns { ok: true } or { ok: false, error }. */
    updateField(section, value) {
      if (CHECKLIST_ASPECT_KEYS.includes(section)) {
        if (typeof value !== "object" || value === null || typeof value.status !== "string") {
          return { ok: false, error: `checklist section "${section}" needs a value like { status, note? }` };
        }
        state.checklist[section] = { status: value.status, note: value.note ?? "" };
        notify();
        return { ok: true };
      }
      if (SCALAR_FIELD_KEYS.includes(section)) {
        state.fields[section] = String(value ?? "");
        notify();
        return { ok: true };
      }
      if (ARRAY_FIELD_KEYS.includes(section)) {
        if (!Array.isArray(value)) {
          return { ok: false, error: `field "${section}" needs an array value` };
        }
        state.fields[section] = value;
        notify();
        return { ok: true };
      }
      return {
        ok: false,
        error: `unknown section "${section}". Valid sections: ${[...CHECKLIST_ASPECT_KEYS, ...CARD_FIELD_KEYS].join(", ")}`,
      };
    },

    getChecklistStatus() {
      return structuredClone(state.checklist);
    },
  };
}
