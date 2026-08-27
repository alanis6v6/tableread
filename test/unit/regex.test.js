import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFindRegex, applyRegexScripts } from "../../src/engine/regex.js";

test("parseFindRegex: bare pattern defaults to dotAll, non-global (replace first match only)", () => {
  const { pattern, flags } = parseFindRegex("[HEAD]\\r?\\n([\\s\\S]*?)\\r?\\n[/HEAD]");
  assert.equal(pattern, "[HEAD]\\r?\\n([\\s\\S]*?)\\r?\\n[/HEAD]");
  assert.equal(flags, "s");
});

test("parseFindRegex: /pattern/flags form maps i/s/m/g through", () => {
  assert.deepEqual(parseFindRegex("/foo(bar)/gi"), { pattern: "foo(bar)", flags: "ig" });
  assert.deepEqual(parseFindRegex("/foo/m"), { pattern: "foo", flags: "m" });
  assert.deepEqual(parseFindRegex("/foo/"), { pattern: "foo", flags: "" });
});

test("applyRegexScripts: substitutes capture groups and {{match}}", () => {
  const scripts = [
    {
      scriptName: "test",
      findRegex: "\\[TAG\\]\\s*(.*?)\\s*\\[/TAG\\]",
      replaceString: "<b>$1</b> (was: {{match}})",
    },
  ];
  const { text, warnings } = applyRegexScripts("prefix [TAG] hello [/TAG] suffix", scripts);
  assert.equal(warnings.length, 0);
  assert.equal(text, "prefix <b>hello</b> (was: [TAG] hello [/TAG]) suffix");
});

test("applyRegexScripts: non-global bare pattern only replaces the first match", () => {
  const scripts = [{ scriptName: "t", findRegex: "X", replaceString: "Y" }];
  const { text } = applyRegexScripts("X and X and X", scripts);
  assert.equal(text, "Y and X and X");
});

test("applyRegexScripts: /pattern/g replaces every match", () => {
  const scripts = [{ scriptName: "t", findRegex: "/X/g", replaceString: "Y" }];
  const { text } = applyRegexScripts("X and X and X", scripts);
  assert.equal(text, "Y and Y and Y");
});

test("applyRegexScripts: out-of-range $N is left as a literal", () => {
  const scripts = [{ scriptName: "t", findRegex: "(a)(b)", replaceString: "$1-$2-$9" }];
  const { text } = applyRegexScripts("ab", scripts);
  assert.equal(text, "a-b-$9");
});

test("applyRegexScripts: an optional non-participating group renders as empty string", () => {
  const scripts = [{ scriptName: "t", findRegex: "a(b)?(c)", replaceString: "[$1][$2]" }];
  const { text } = applyRegexScripts("ac", scripts);
  assert.equal(text, "[][c]"); // whole match "ac" is replaced; group 1 didn't participate -> ""
});

test("applyRegexScripts: disabled scripts and scripts with an empty findRegex are skipped", () => {
  const scripts = [
    { scriptName: "off", findRegex: "X", replaceString: "Y", disabled: true },
    { scriptName: "empty", findRegex: "", replaceString: "Z" },
  ];
  const { text, warnings } = applyRegexScripts("X", scripts);
  assert.equal(text, "X");
  assert.equal(warnings.length, 0);
});

test("applyRegexScripts: an invalid pattern is reported as a warning and skipped, not thrown", () => {
  const scripts = [
    { scriptName: "bad", findRegex: "(unclosed", replaceString: "Y" },
    { scriptName: "good", findRegex: "hi", replaceString: "bye" },
  ];
  const { text, warnings } = applyRegexScripts("hi there", scripts);
  assert.equal(text, "bye there");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /bad.*failed to compile/);
});

test("applyRegexScripts: applies scripts in array order, later scripts see earlier output", () => {
  const scripts = [
    { scriptName: "a", findRegex: "X", replaceString: "Y" },
    { scriptName: "b", findRegex: "Y", replaceString: "Z" },
  ];
  const { text } = applyRegexScripts("X", scripts);
  assert.equal(text, "Z");
});
