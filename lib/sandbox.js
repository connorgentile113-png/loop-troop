/**
 * Runs a camper's JavaScript on the server in an isolated vm context.
 * No require, no process, no network, no eval — just enough JavaScript to learn.
 */
import vm from "node:vm";
import { inspect } from "node:util";

const MAX_CODE = 20000;
const TIMEOUT_MS = 3000;
const MAX_LOGS = 120;
const MAX_LOG_CHARS = 400;

function formatValue(value) {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  try {
    return inspect(value, { depth: 2, breakLength: 70, maxArrayLength: 25 });
  } catch {
    return String(value);
  }
}

function friendlyError(error) {
  const message = error && error.message ? String(error.message) : String(error);
  if (/Script execution timed out|timed out/i.test(message)) {
    return "Your code ran for too long. Is there a loop that never ends?";
  }
  if (error && error.name === "SyntaxError") {
    return `Oops, there is a typo in your code: ${message}`;
  }
  return message;
}

export function runCode(code, tests = []) {
  if (typeof code !== "string" || !code.trim()) {
    return { ok: false, error: "Write a little code first!", logs: [], results: [], passed: false };
  }
  if (code.length > MAX_CODE) {
    return {
      ok: false,
      error: "That is a LOT of code. Keep it under 20,000 characters!",
      logs: [],
      results: [],
      passed: false,
    };
  }

  const logs = [];
  const captured = [];
  const pushLog = (args) => {
    if (logs.length >= MAX_LOGS) return;
    logs.push(args.map(formatValue).join(" ").slice(0, MAX_LOG_CHARS));
  };

  const sandbox = {
    console: {
      log: (...args) => pushLog(args),
      info: (...args) => pushLog(args),
      warn: (...args) => pushLog(args),
      error: (...args) => pushLog(args),
    },
    __logs: logs,
    __record: (index, value) => {
      captured[index] = value;
    },
  };

  const context = vm.createContext(sandbox, {
    name: "loop-troop-quest",
    codeGeneration: { strings: false, wasm: false },
  });

  const checkLines = tests
    .map(
      (test, index) =>
        `__record(${index}, (() => { try { return { pass: Boolean(${test.check}), note: "" }; } ` +
        `catch (error) { return { pass: false, note: String(error && error.message || error) }; } })());`,
    )
    .join("\n");

  // User code and checks live in one function body so `const`/`let`/`function`
  // declared by the camper are visible to the checks.
  const script = `(function () {\n${code}\n${checkLines}\n})();`;

  try {
    vm.runInContext(script, context, { timeout: TIMEOUT_MS, displayErrors: false, filename: "quest.js" });
  } catch (error) {
    return { ok: false, error: friendlyError(error), logs, results: [], passed: false };
  }

  const results = tests.map((test, index) => {
    const entry = captured[index] || { pass: false, note: "check did not run" };
    return {
      index,
      pass: Boolean(entry.pass),
      description: test.description,
      note: entry.note,
    };
  });

  return {
    ok: true,
    error: null,
    logs,
    results,
    passed: tests.length > 0 && results.every((result) => result.pass),
  };
}
