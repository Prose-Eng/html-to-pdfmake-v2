// Native bun:test coverage for options/branches not exercised by the legacy
// suite (unit.test.js): imagesByReference, defaultStyles, the border-color/
// border-width shorthands, and the unparseable-color fallback.
import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import htmlToPdfmake, { type ImagesByReferenceResult, type PdfNode } from "../src/index";

const { window } = new JSDOM("");

// jsdom's DOMWindow is a valid runtime Window but not structurally `Window`.
const domWindow = window as unknown as Window;

function convert(html: string, options: Record<string, unknown> = {}): unknown {
  return htmlToPdfmake(html, { window: domWindow, ...options });
}

/** Convert and return the first top-level node (the suite always wraps in an array). */
function firstNode(html: string, options: Record<string, unknown> = {}): PdfNode {
  const res = convert(html, options) as PdfNode[];
  return res[0];
}

describe("imagesByReference", () => {
  test("returns { content, images } and de-duplicates identical srcs", () => {
    const res = convert('<div><img src="a.png"><img src="a.png"><img src="b.png"></div>', {
      imagesByReference: true,
    }) as ImagesByReferenceResult;

    expect(res).toHaveProperty("content");
    expect(res).toHaveProperty("images");
    // a.png appears twice but is stored once -> two distinct references
    expect(Object.keys(res.images)).toHaveLength(2);
    expect(Object.values(res.images).sort()).toEqual(["a.png", "b.png"]);
  });

  test("data-src takes precedence over src", () => {
    const res = convert('<img data-src="real.png" src="ignored.png">', {
      imagesByReference: true,
    }) as ImagesByReferenceResult;
    expect(Object.values(res.images)).toEqual(["real.png"]);
  });

  test("a JSON string src is parsed into an object", () => {
    const res = convert(`<img src='{"width":10}'>`, {
      imagesByReference: true,
    }) as ImagesByReferenceResult;
    // the value is a parsed object here, though images is typed as string URLs
    expect(Object.values(res.images)[0] as unknown).toEqual({ width: 10 });
  });
});

describe("defaultStyles option", () => {
  test("overrides a property of an existing default style", () => {
    const node = firstNode('<a href="#dest">link</a>', {
      defaultStyles: { a: { color: "purple", decoration: null } },
    });
    expect(node.color).toBe("purple");
    // decoration:null means the underline is not applied
    expect(node.decoration).toEqual([]);
  });

  test("removes an entire default style when set to null", () => {
    const node = firstNode("<p>text</p>", { defaultStyles: { p: null } });
    // <p> normally gets margin:[0,5,0,10]; removing the default drops it
    expect(node.margin).toBeUndefined();
  });

  test("deletes a single property when set to empty string", () => {
    const node = firstNode("<h1>title</h1>", { defaultStyles: { h1: { marginBottom: "" } } });
    expect(node.marginBottom).toBeUndefined();
    expect(node.fontSize).toBe(24); // other h1 defaults remain
  });

  test("adds default styles for a tag that has none", () => {
    const node = firstNode("<span>hi</span>", { defaultStyles: { span: { color: "green" } } });
    expect(node.color).toBe("green");
  });
});

describe("border shorthands (topRightBottomLeftToObject)", () => {
  function firstCell(html: string): PdfNode {
    const node = firstNode(html);
    const body = node.table?.body;
    if (!body) throw new Error("expected a table node");
    return body[0][0];
  }

  test("border-color with a single value applies to all four sides", () => {
    const cell = firstCell('<table><tr><td style="border-color:red">x</td></tr></table>');
    expect(cell.borderColor).toEqual(["red", "red", "red", "red"]);
  });

  test("border-color with two values alternates sides", () => {
    const cell = firstCell('<table><tr><td style="border-color:red blue">x</td></tr></table>');
    // order is [left, top, right, bottom]
    expect(cell.borderColor).toEqual(["blue", "red", "blue", "red"]);
  });
});

describe("unparseable color falls back to the raw value", () => {
  test("a value matching no color format is passed through", () => {
    const node = firstNode('<span style="color:12345">x</span>');
    expect(node.color).toBe("12345");
  });
});
