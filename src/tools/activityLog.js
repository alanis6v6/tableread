// A rolling log of tool invocations, so the page can show *something* for
// "what has the agent been doing" even though the real agent conversation
// lives in the browser/extension chrome, not on this page. Not a chat
// transcript -- an honest activity feed of registerTool() calls.

export function createActivityLog(limit = 200) {
  const entries = [];
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn(entries);
  }

  return {
    record(toolName, args, result) {
      entries.push({ at: Date.now(), toolName, args, result });
      if (entries.length > limit) entries.shift();
      notify();
    },
    getEntries() {
      return entries.slice();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
