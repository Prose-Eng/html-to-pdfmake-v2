import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import htmlToPdfmake, { type HtmlToPdfmakeOptions, type PdfNode } from "../src/index";

const { window } = new JSDOM("");
const domWindow = window as unknown as Window;

function convert(html: string, options: HtmlToPdfmakeOptions = {}): PdfNode[] {
  return htmlToPdfmake(html, { window: domWindow, ...options }) as PdfNode[];
}

function nodes(value: unknown): PdfNode[] {
  return value as PdfNode[];
}

describe("CSS to pdfmake mappings", () => {
  test("keeps a report wrapper margin when the wrapper becomes a stack", () => {
    const [wrapper] = convert(
      '<div style="margin: 0 28px"><table><tr><td>report value</td></tr></table></div>',
    );

    expect(wrapper.margin).toEqual([21, 0, 21, 0]);
    expect(nodes(wrapper.stack)[0].table?.body[0][0].text).toBe("report value");
  });

  test("parses colons and semicolons inside CSS values without losing later declarations", () => {
    const [node] = convert(
      '<span style="background-image:url(data:image/svg+xml;charset=utf8,a:b;c); color:red; font-weight:bold">safe</span>',
    );

    expect(node.text).toBe("safe");
    expect(node.color).toBe("red");
    expect(node.bold).toBe(true);
    expect(node.backgroundImage).toBeUndefined();
  });

  test("honours important when the same inline property is declared more than once", () => {
    const [importantFirst] = convert('<span style="color:red !important; color:blue">red</span>');
    const [importantLast] = convert('<span style="color:red; color:blue !important">blue</span>');

    expect(importantFirst.color).toBe("red");
    expect(importantLast.color).toBe("blue");
  });

  test("converts robust box shorthands and absolute CSS units", () => {
    const [node] = convert('<div style="margin:1mm 1pc 4q 2mm">units</div>');

    expect(node.margin).toEqual([6, 3, 12, 3]);
  });

  test("maps multiple decoration lines, style, color and thickness", () => {
    const [node] = convert(
      '<span style="text-decoration:underline line-through dotted #ff0000 1px">decorated</span>',
    );

    expect(node.decoration).toEqual(["underline", "lineThrough"]);
    expect(node.decorationStyle).toBe("dotted");
    expect(node.decorationColor).toBe("#ff0000");
    expect(node.decorationThickness).toBe(1);
  });

  test("maps table vertical alignment and cell padding without a custom layout", () => {
    const [table] = convert(
      '<table><tr><td style="vertical-align:middle;padding:2px 4px">cell</td></tr></table>',
    );
    const cell = table.table?.body[0][0];

    expect(cell?.verticalAlignment).toBe("middle");
    expect(cell?.margin).toEqual([3, 2, 3, 2]);
  });

  test("maps CSS vertical-align scripts and HTML script tags to pdfmake booleans", () => {
    const [root] = convert(
      '<span><span style="vertical-align:super">css</span><sup>html</sup><sub>down</sub></span>',
    );
    const text = nodes(root.text);

    expect(text[0].sup).toBe(true);
    expect(text[1].sup).toBe(true);
    expect(text[2].sub).toBe(true);
  });

  test("maps character spacing, explicit word breaking and clamped opacity", () => {
    const [node] = convert(
      '<span style="letter-spacing:2px;word-break:break-all;opacity:150%">text</span>',
    );

    expect(node.characterSpacing).toBe(2);
    expect(node.wordBreak).toBe("break-all");
    expect(node.opacity).toBe(1);
  });

  test("does not turn CSS emergency wrapping into pdfmake break-all", () => {
    const [anywhere] = convert('<span style="overflow-wrap:anywhere">anywhere</span>');
    const [breakWord] = convert('<span style="overflow-wrap:break-word">break word</span>');
    const [legacy] = convert('<span style="word-wrap:break-word">legacy</span>');

    expect(anywhere.wordBreak).toBeUndefined();
    expect(breakWord.wordBreak).toBeUndefined();
    expect(legacy.wordBreak).toBeUndefined();
  });

  test("maps word-break normal and keep-all to normal and preserves nowrap", () => {
    const [normal] = convert('<span style="word-break:normal">normal</span>');
    const [keepAll] = convert('<span style="word-break:keep-all">keep all</span>');
    const [nowrap] = convert('<span style="white-space:nowrap">one line</span>');

    expect(normal.wordBreak).toBe("normal");
    expect(keepAll.wordBreak).toBe("normal");
    expect(nowrap.noWrap).toBe(true);
  });

  test("keeps inline subscript and superscript runs from inheriting emergency break-all", () => {
    const [root] = convert(
      '<span style="overflow-wrap:break-word">q<sub>z</sub>, psf x<sup>2</sup></span>',
    );
    const text = nodes(root.text);

    expect(root.wordBreak).toBeUndefined();
    for (const run of text) expect(run.wordBreak).toBeUndefined();
    expect(text.find((run) => run.nodeName === "SUB")?.sub).toBe(true);
    expect(text.find((run) => run.nodeName === "SUP")?.sup).toBe(true);
  });

  test("keeps safe relative widths and omits invalid image dimensions", () => {
    const [column] = convert('<div style="width:35%;height:auto;max-width:700px">column</div>');
    const [image] = convert('<img src="x.png" style="width:100%;height:auto">');

    expect(column.width).toBe("35%");
    expect(column.height).toBeUndefined();
    expect(column.maxWidth).toBeUndefined();
    expect(image.width).toBeUndefined();
    expect(image.height).toBeUndefined();
  });

  test("filters browser layout properties instead of leaking invalid DDO keys", () => {
    const [node] = convert(
      '<div style="position:fixed;display:block;overflow:hidden;text-overflow:ellipsis">text</div>',
    );

    expect(node.position).toBeUndefined();
    expect(node.display).toBeUndefined();
    expect(node.overflow).toBeUndefined();
    expect(node.textOverflow).toBeUndefined();
  });

  test("handles hidden, collapsed and hidden-attribute elements consistently", () => {
    const [root] = convert(
      '<div><span hidden>a</span><span style="visibility:collapse">b</span><span>visible</span></div>',
    );
    const [shown] = convert("<span hidden>shown</span>", { showHidden: true });

    expect(nodes(root.text)).toHaveLength(1);
    expect(nodes(root.text)[0].text).toBe("visible");
    expect(shown.text).toBe("shown");
  });

  test("allows customTag to skip nodes with a falsy result", () => {
    const [root] = convert("<div><noprint>skip</noprint><span>keep</span></div>", {
      customTag: ({ element, ret }) => (element.nodeName === "NOPRINT" ? null : ret),
    });

    expect(nodes(root.text)).toHaveLength(1);
    expect(nodes(root.text)[0].text).toBe("keep");
  });
});
