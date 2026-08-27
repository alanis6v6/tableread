// Ported from playtest_engine.py's parse_find_regex()/make_replacer()/apply_regex_scripts().
// Mirrors SillyTavern's Regex extension semantics: findRegex is either a bare
// pattern (implicitly "whole block spans multiple lines, replace first match
// only", matching the Python original's DOTALL/count=1 default) or a
// JS-style /pattern/flags string.

/**
 * Accepts either a bare pattern string or a JS-style /pattern/flags string
 * (as commonly stored in regex_scripts[].findRegex). Returns { pattern, flags }
 * where flags is a JS RegExp flag string. A bare pattern defaults to dotAll
 * ("s") with no "g" flag, so text.replace() naturally only replaces the
 * first match -- equivalent to the Python original's (DOTALL, count=1).
 */
export function parseFindRegex(raw) {
  raw = raw.trim();
  if (raw.startsWith("/")) {
    const lastSlash = raw.lastIndexOf("/");
    if (lastSlash > 0) {
      const pattern = raw.slice(1, lastSlash);
      const flagChars = raw.slice(lastSlash + 1);
      let flags = "";
      if (flagChars.includes("i")) flags += "i";
      if (flagChars.includes("s")) flags += "s";
      if (flagChars.includes("m")) flags += "m";
      if (flagChars.includes("g")) flags += "g";
      return { pattern, flags };
    }
  }
  return { pattern: raw, flags: "s" };
}

function applyReplacement(replaceString, groups) {
  // groups[0] is the whole match, groups[i] the i-th capture (undefined if
  // that optional group did not participate in the match).
  let out = replaceString.split("{{match}}").join(groups[0]);
  out = out.replace(/\$(\d+)/g, (whole, idxStr) => {
    const idx = Number(idxStr);
    if (idx >= groups.length) return whole; // out-of-range group ref: leave literal "$N"
    const val = groups[idx];
    return val !== undefined ? val : ""; // group didn't participate: empty string
  });
  return out;
}

function makeReplacer(replaceString) {
  return (...args) => {
    // String.replace callback args: (match, p1, ..., pN, offset, fullString[, namedGroups])
    let a = args;
    if (typeof a[a.length - 1] === "object") a = a.slice(0, -1); // drop named-groups object
    const groups = a.slice(0, -2); // [match, p1, ..., pN]
    return applyReplacement(replaceString, groups);
  };
}

/**
 * Applies a card's regex_scripts (data.extensions.regex_scripts) to `text`,
 * in array order, skipping disabled scripts. Returns { text, warnings }.
 */
export function applyRegexScripts(text, regexScripts) {
  const warnings = [];
  for (const script of regexScripts) {
    if (script.disabled) continue;
    const find = script.findRegex || "";
    const replace = script.replaceString || "";
    if (!find) continue;
    const { pattern, flags } = parseFindRegex(find);
    let compiled;
    try {
      compiled = new RegExp(pattern, flags);
    } catch (ex) {
      warnings.push(`regex '${script.scriptName}' failed to compile: ${ex.message}`);
      continue;
    }
    text = text.replace(compiled, makeReplacer(replace));
  }
  return { text, warnings };
}
