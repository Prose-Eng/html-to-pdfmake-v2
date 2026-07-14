import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { type Content, type PdfNode, convertDocument } from "../src/index";

function createWindow(): Window {
  return new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  }).window as unknown as Window;
}

function findText(content: Content | undefined, text: string): PdfNode {
  const visit = (value: unknown): PdfNode | undefined => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = visit(entry);
        if (found) return found;
      }
      return undefined;
    }
    if (!value || typeof value !== "object") return undefined;
    const node = value as PdfNode;
    if (node.text === text) return node;
    for (const key of ["text", "stack", "columns", "ul", "ol"] as const) {
      const found = visit(node[key]);
      if (found) return found;
    }
    if (node.table) {
      const found = visit(node.table.body);
      if (found) return found;
    }
    return undefined;
  };
  const found = visit(content);
  if (!found) throw new Error(`Could not find text node: ${text}`);
  return found;
}

describe("convertDocument CSS cascade", () => {
  test("applies class, id, descendant, child, grouped, and pseudo selectors", async () => {
    const result = await convertDocument(
      `<style>
        .base { color: red; }
        #target { color: blue; }
        .wrapper > #target:first-child { font-weight: 700; }
        .wrapper .desc { font-style: italic; }
        .group-a, .group-b { text-align: right; }
        .items span:nth-child(2) { font-size: 20px; }
      </style>
      <div class="wrapper">
        <span id="target" class="base">id</span>
        <span class="desc">descendant</span>
        <span class="group-b">grouped</span>
        <div class="items"><span>one</span><span>two</span></div>
      </div>`,
      { window: createWindow() },
    );

    expect(findText(result.content, "id").color).toBe("#0000ff");
    expect(findText(result.content, "id").bold).toBe(true);
    expect(findText(result.content, "descendant").italics).toBe(true);
    expect(findText(result.content, "grouped").alignment).toBe("right");
    expect(findText(result.content, "two").fontSize).toBe(15);
    expect(result.warnings).toEqual([]);
  });

  test("honors inline precedence and !important", async () => {
    const result = await convertDocument(
      `<style>
        #normal { color: red; }
        #important { color: red !important; }
      </style>
      <span id="normal" style="color: blue">normal</span>
      <span id="important" style="color: blue">important</span>`,
      { window: createWindow() },
    );

    expect(findText(result.content, "normal").color).toBe("#0000ff");
    expect(findText(result.content, "important").color).toBe("red");
  });

  test("uses computed inheritance without copying unrelated box styles", async () => {
    const result = await convertDocument(
      `<style>.parent { color: green; font-family: "Open Sans", sans-serif; margin-left: 30px; }</style>
       <div class="parent"><span>child</span></div>`,
      { window: createWindow() },
    );

    const child = findText(result.content, "child");
    expect(child.color).toBe("#008000");
    expect(child.font).toBe("Open Sans");
    expect(result.requiredFonts).toContain("Open Sans");
  });

  test("resolves inherited variables and calc against the configured content width", async () => {
    const result = await convertDocument(
      `<style>
        .report { --accent: #163c6e; --indent: 10px; }
        .indent { color: var(--accent); margin-left: calc(var(--indent) * 2); }
        .wide { margin-left: calc(100% - 20px); }
      </style>
      <div class="report"><span class="indent">variable</span><span class="wide">width</span></div>`,
      { window: createWindow(), contentWidth: 200 },
    );

    expect(findText(result.content, "variable").color).toBe("#163c6e");
    expect(findText(result.content, "variable").marginLeft).toBe(15);
    expect(findText(result.content, "width").marginLeft).toBe(136);
  });

  test("resolves linked stylesheets explicitly and applies additional cssText last", async () => {
    const calls: string[] = [];
    const result = await convertDocument(
      `<link rel="stylesheet" href="styles/report.css"><span class="linked">linked</span>`,
      {
        window: createWindow(),
        baseUrl: "https://reports.example.test/app/",
        resolveStylesheet: async (href) => {
          calls.push(href);
          return ".linked { color: red; }";
        },
        cssText: ".linked { color: purple; }",
      },
    );

    expect(calls).toEqual(["https://reports.example.test/app/styles/report.css"]);
    expect(findText(result.content, "linked").color).toBe("#800080");
    expect(result.warnings).toEqual([]);
  });

  test("selects print media rules and reports unresolved linked CSS", async () => {
    const html = `<style>
        .print-only { display: none; }
        @media print {
          .screen-only { display: none; }
          .print-only { display: inline; color: black; }
        }
      </style>
      <link rel="stylesheet" href="missing.css">
      <span class="screen-only">screen</span><span class="print-only">print</span>`;

    const result = await convertDocument(html, { window: createWindow(), media: "print" });

    expect(() => findText(result.content, "screen")).toThrow();
    expect(findText(result.content, "print").color).toBe("#000000");
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "stylesheet-resolver-missing",
        href: "missing.css",
      }),
    ]);
  });
});
