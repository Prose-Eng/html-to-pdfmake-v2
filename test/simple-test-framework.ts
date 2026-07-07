/**
 * Adapter that maps the legacy `simple-test-framework` API used by the existing
 * suite onto Bun's native test runner (`bun:test`).
 *
 * The original API is:
 *   const test = require("simple-test-framework");
 *   test("suite name", (t) => {
 *     t.test("case name", (t) => {
 *       t.check(condition, "message");
 *       t.finish();
 *     });
 *     t.finish();
 *   });
 *
 * This shim lets the ~1300-line `unit.test.ts` run under `bun test` with its
 * original structure intact, so every existing assertion is preserved. A future
 * pass can port these to native `expect()`.
 */
import { test as bunTest, describe, expect } from "bun:test";

interface Harness {
  test(name: string, fn: (t: Harness) => void): Harness;
  check(condition: unknown, message?: string): void;
  finish(): void;
}

function check(condition: unknown, message?: string): void {
  try {
    expect(Boolean(condition)).toBe(true);
  } catch (_) {
    throw new Error(`check failed: ${message || "(no message)"}`);
  }
}

function makeLeafHarness(): Harness {
  const leaf: Harness = {
    // Deeply nested t.test() runs inline against the same harness.
    test(_name: string, fn: (t: Harness) => void) {
      fn(leaf);
      return leaf;
    },
    check,
    finish() {},
  };
  return leaf;
}

function simpleTest(name: string, fn: (t: Harness) => void): void {
  describe(name, () => {
    const harness: Harness = {
      test(subName: string, subFn: (t: Harness) => void) {
        bunTest(subName, () => {
          subFn(makeLeafHarness());
        });
        return harness;
      },
      check,
      finish() {},
    };
    fn(harness);
  });
}

export default simpleTest;
