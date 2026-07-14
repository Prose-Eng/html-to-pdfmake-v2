import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import htmlToPdfmake, { type PdfNode } from "../src/index";

const { window } = new JSDOM("");
// jsdom's DOMWindow is a valid runtime Window but not structurally `Window`.
const domWindow = window as unknown as Window;

/** Convert HTML and return the top-level pdfmake node array. */
function convert(html: string, options: Record<string, unknown> = {}): PdfNode[] {
  return htmlToPdfmake(html, { window: domWindow, ...options }) as PdfNode[];
}

/** Cast a node's array-valued property (text/stack/ul/ol/...) for navigation. */
function nodes(value: unknown): PdfNode[] {
  return value as PdfNode[];
}

/** Cast a table body (rows of cells) for navigation. */
function tableBody(node: PdfNode): PdfNode[][] {
  return node.table?.body as PdfNode[][];
}

describe("unit tests", () => {
  test("b", () => {
    const [node] = convert("<b>bold word</b>");
    expect(node.text).toBe("bold word");
    expect(node.bold).toBe(true);
    expect(node.style?.[0]).toBe("html-b");
  });

  test("strong", () => {
    const [node] = convert("<strong>bold word</strong>");
    expect(node.text).toBe("bold word");
    expect(node.bold).toBe(true);
    expect(node.style?.[0]).toBe("html-strong");
  });

  test("font-weight", () => {
    const [node] = convert(
      `<div><span style="font-weight: bold">Bold</span><span style="font-weight:700">700<span style="font-weight: normal">normal</span></span></div>`,
    );
    const spans = nodes(node.text);
    expect(spans[0].text).toBe("Bold");
    expect(spans[0].bold).toBe(true);
    const inner = nodes(spans[1].text);
    expect(inner[0].text).toBe("700");
    expect(inner[0].bold).toBe(true);
    expect(inner[1].text).toBe("normal");
    expect(inner[1].bold).toBe(false);
  });

  test("u", () => {
    const [node] = convert("<u>underline word</u>");
    expect(node.text).toBe("underline word");
    expect(node.decoration).toEqual(["underline"]);
    expect(node.style?.[0]).toBe("html-u");
  });

  test("em", () => {
    const [node] = convert("<em>italic word</em>");
    expect(node.text).toBe("italic word");
    expect(node.italics).toBe(true);
    expect(node.style?.[0]).toBe("html-em");
  });

  test("i", () => {
    const [node] = convert("<i>italic word</i>");
    expect(node.text).toBe("italic word");
    expect(node.italics).toBe(true);
    expect(node.style?.[0]).toBe("html-i");
  });

  test("h1", () => {
    const [node] = convert("<h1>level 1</h1>");
    expect(node.text).toBe("level 1");
    expect(node.fontSize).toBe(24);
    expect(node.bold).toBe(true);
    expect(node.marginBottom).toBe(5);
    expect(node.style?.[0]).toBe("html-h1");
  });

  test("h2", () => {
    const [node] = convert("<h2>level 2</h2>");
    expect(node.text).toBe("level 2");
    expect(node.fontSize).toBe(22);
    expect(node.bold).toBe(true);
    expect(node.marginBottom).toBe(5);
    expect(node.style?.[0]).toBe("html-h2");
  });

  test("h3", () => {
    const [node] = convert("<h3>level 3</h3>");
    expect(node.text).toBe("level 3");
    expect(node.fontSize).toBe(20);
    expect(node.bold).toBe(true);
    expect(node.marginBottom).toBe(5);
    expect(node.style?.[0]).toBe("html-h3");
  });

  test("h4", () => {
    const [node] = convert("<h4>level 4</h4>");
    expect(node.text).toBe("level 4");
    expect(node.fontSize).toBe(18);
    expect(node.bold).toBe(true);
    expect(node.marginBottom).toBe(5);
    expect(node.style?.[0]).toBe("html-h4");
  });

  test("h5", () => {
    const [node] = convert("<h5>level 5</h5>");
    expect(node.text).toBe("level 5");
    expect(node.fontSize).toBe(16);
    expect(node.bold).toBe(true);
    expect(node.marginBottom).toBe(5);
    expect(node.style?.[0]).toBe("html-h5");
  });

  test("h6", () => {
    const [node] = convert("<h6>level 6</h6>");
    expect(node.text).toBe("level 6");
    expect(node.fontSize).toBe(14);
    expect(node.bold).toBe(true);
    expect(node.marginBottom).toBe(5);
    expect(node.style?.[0]).toBe("html-h6");
  });

  test("a", () => {
    const [node] = convert('<a href="https://www.somewhere.com">link</a>');
    expect(node.text).toBe("link");
    expect(node.color).toBe("blue");
    expect(node.decoration).toEqual(["underline"]);
    expect(node.link).toBe("https://www.somewhere.com");
    expect(Array.isArray(node.style)).toBe(true);
    expect(node.style?.[0]).toBe("html-a");
  });

  test("a with image", () => {
    const [root] = convert(
      '<a href="https://picsum.photos/seed/picsum/200"><img src="https://picsum.photos/seed/picsum/200"></a>',
    );
    expect(Array.isArray(root.stack)).toBe(true);
    const stack = nodes(root.stack);
    expect(stack.length).toBe(1);
    const node = stack[0];
    expect(node.image).toBe("https://picsum.photos/seed/picsum/200");
    expect(node.link).toBe("https://picsum.photos/seed/picsum/200");
  });

  test("a with subtag", () => {
    const [node] = convert(
      '<a href="https://www.somewhere.com">link <strong>something</strong></a>',
    );
    const parts = nodes(node.text);
    expect(parts.length).toBe(2);
    expect(parts[0].text).toBe("link ");
    expect(parts[1].text).toBe("something");
    expect(parts[0].color).toBe("blue");
    expect(parts[1].color).toBe("blue");
    expect(parts[0].link).toBe("https://www.somewhere.com");
    expect(parts[1].link).toBe("https://www.somewhere.com");
    expect(node.style?.[0]).toBe("html-a");
  });

  test("strike", () => {
    const [node] = convert("<strike>strike</strike>");
    expect(node.text).toBe("strike");
    expect(node.decoration).toEqual(["lineThrough"]);
    expect(node.style?.[0]).toBe("html-strike");
  });

  test("table", () => {
    const html = `<table>
      <thead>
        <tr>
          <th>Header Column A</th>
          <th>Header Column B</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Value Cell A2</td>
          <td>Value Cell B2</td>
        </tr>
        <tr>
          <td>Value Cell A3</td>
          <td>Value Cell B3</td>
        </tr>
      </tbody>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
    expect(body[0][0].text).toBe("Header Column A");
    expect(body[0][0].style?.[0]).toBe("html-th");
    expect(body[0][0].style?.[1]).toBe("html-tr");
    expect(body[1][1].text).toBe("Value Cell B2");
    expect(body[1][1].style?.[0]).toBe("html-td");
    expect(body[1][1].style?.[1]).toBe("html-tr");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (one row/one column)", () => {
    const html = `<table>
        <tr>
          <td>Cell1</td>
        </tr>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(1);
    expect(body[0][0].text).toBe("Cell1");
    expect(body[0][0].style?.[0]).toBe("html-td");
    expect(body[0][0].style?.[1]).toBe("html-tr");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (one row/two columns)", () => {
    const html = `<table>
        <tr>
          <td>Cell1</td><td>Cell2</td>
        </tr>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(1);
    expect(body[0][0].text).toBe("Cell1");
    expect(body[0][0].style?.[0]).toBe("html-td");
    expect(body[0][0].style?.[1]).toBe("html-tr");
    expect(body[0][1].text).toBe("Cell2");
    expect(body[0][1].style?.[0]).toBe("html-td");
    expect(body[0][1].style?.[1]).toBe("html-tr");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (two rows/one column)", () => {
    const html = `<table>
        <tr>
          <td>Cell1</td>
        </tr>
        <tr>
          <td>Cell2</td>
        </tr>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(2);
    expect(body[0][0].text).toBe("Cell1");
    expect(body[0][0].style?.[0]).toBe("html-td");
    expect(body[0][0].style?.[1]).toBe("html-tr");
    expect(body[1][0].text).toBe("Cell2");
    expect(body[1][0].style?.[0]).toBe("html-td");
    expect(body[1][0].style?.[1]).toBe("html-tr");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (rowspan/colspan)", () => {
    const html = `<table>
      <tr>
        <th>Col A</th>
        <th>Col B</th>
        <th>Col C</th>
        <th>Col D</th>
      </tr>
      <tr>
        <td>Cell A1</td>
        <td rowspan="2">Cell B1 & B2</td>
        <td>Cell C1</td>
        <td rowspan="2">Cell D1 & D2</td>
      </tr>
      <tr>
        <td>Cell A2</td>
        <td>Cell C2</td>
      </tr>
      <tr>
        <td>Cell A3</td>
        <td colspan="2">Cell B3 & C3</td>
        <td>Cell D3</td>
      </tr>
      <tr>
        <td rowspan="2" colspan="3">Cell A4 & A5 & B4 & B5 & C4 & C5</td>
        <td>Cell D4</td>
      </tr>
      <tr>
        <td>Cell D5</td>
      </tr>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(6);
    expect(body[1][0].text).toBe("Cell A1");
    expect(body[1][0].style?.[0]).toBe("html-td");
    expect(body[1][0].style?.[1]).toBe("html-tr");
    expect(body[1][1].text).toBe("Cell B1 & B2");
    expect(body[1][2].text).toBe("Cell C1");
    expect(body[1][3].text).toBe("Cell D1 & D2");
    expect(body[2][0].text).toBe("Cell A2");
    expect(body[2][1].text).toBe("");
    expect(body[2][2].text).toBe("Cell C2");
    expect(body[2][3].text).toBe("");
    expect(body[3][0].text).toBe("Cell A3");
    expect(body[3][1].text).toBe("Cell B3 & C3");
    expect(body[3][2].text).toBe("");
    expect(body[3][3].text).toBe("Cell D3");
    expect(body[4][0].text).toBe("Cell A4 & A5 & B4 & B5 & C4 & C5");
    expect(body[4][1].text).toBe("");
    expect(body[4][2].text).toBe("");
    expect(body[4][3].text).toBe("Cell D4");
    expect(body[5][0].text).toBe("");
    expect(body[5][1].text).toBe("");
    expect(body[5][2].text).toBe("");
    expect(body[5][3].text).toBe("Cell D5");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (rowspan/colspan) with thead tbody", () => {
    const html = `<table>
      <thead>
          <tr>
            <th>Col A</th>
            <th>Col B</th>
            <th>Col C</th>
            <th>Col D</th>
          </tr>
      </thead>
      <tbody>
          <tr>
            <td>Cell A1</td>
            <td rowspan="2">Cell B1 & B2</td>
            <td>Cell C1</td>
            <td rowspan="2">Cell D1 & D2</td>
          </tr>
          <tr>
            <td>Cell A2</td>
            <td>Cell C2</td>
          </tr>
          <tr>
            <td>Cell A3</td>
            <td colspan="2">Cell B3 & C3</td>
            <td>Cell D3</td>
          </tr>
          <tr>
            <td rowspan="2" colspan="3">Cell A4 & A5 & B4 & B5 & C4 & C5</td>
            <td>Cell D4</td>
          </tr>
          <tr>
            <td>Cell D5</td>
          </tr>
      </tbody>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(6);
    expect(body[1][0].text).toBe("Cell A1");
    expect(body[1][0].style?.[0]).toBe("html-td");
    expect(body[1][0].style?.[1]).toBe("html-tr");
    expect(body[1][1].text).toBe("Cell B1 & B2");
    expect(body[1][2].text).toBe("Cell C1");
    expect(body[1][3].text).toBe("Cell D1 & D2");
    expect(body[2][0].text).toBe("Cell A2");
    expect(body[2][1].text).toBe("");
    expect(body[2][2].text).toBe("Cell C2");
    expect(body[2][3].text).toBe("");
    expect(body[3][0].text).toBe("Cell A3");
    expect(body[3][1].text).toBe("Cell B3 & C3");
    expect(body[3][2].text).toBe("");
    expect(body[3][3].text).toBe("Cell D3");
    expect(body[4][0].text).toBe("Cell A4 & A5 & B4 & B5 & C4 & C5");
    expect(body[4][1].text).toBe("");
    expect(body[4][2].text).toBe("");
    expect(body[4][3].text).toBe("Cell D4");
    expect(body[5][0].text).toBe("");
    expect(body[5][1].text).toBe("");
    expect(body[5][2].text).toBe("");
    expect(body[5][3].text).toBe("Cell D5");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (colspan + empty cell)", () => {
    const html = `<table>
      <thead>
        <tr>
          <th colspan="2">header</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Cell A1</td>
          <td>Cell A2</td>
        </tr>
        <tr>
          <td>Cell B1</td>
          <td></td>
        </tr>
      </tbody>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(3);
    expect(body[0].length).toBe(2);
    expect(body[0][0].text).toBe("header");
    expect(body[0][0].style?.[0]).toBe("html-th");
    expect(body[0][0].style?.[1]).toBe("html-tr");
    expect(body[1].length).toBe(2);
    expect(body[1][0].text).toBe("Cell A1");
    expect(body[1][1].text).toBe("Cell A2");
    expect(body[2].length).toBe(2);
    expect(body[2][0].text).toBe("Cell B1");
    expect(body[2][1].text).toBe("");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (rowspan/colspan) with thead and tbody", () => {
    const html = `<table>
      <thead>
          <tr>
            <th rowspan="2">Col A</th>
            <th colspan="2">Col B & C</th>
            <th rowspan="2">Col D</th>
          </tr>
          <tr>
            <th>Col B</th>
            <th>Col C</th>
          </tr>
      </thead>
      <tbody>
          <tr>
            <td rowspan="2">Cell A1 & A2</td>
            <td>Cell B1</td>
            <td rowspan="2">Cell C1 & C2</td>
            <td>Cell D1</td>
          </tr>
          <tr>
            <td>Cell B2</td>
            <td>Cell D2</td>
          </tr>
      </tbody>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(body.length).toBe(4);
    expect(body[0].length).toBe(4);
    expect(body[0][0].text).toBe("Col A");
    expect(body[0][1].text).toBe("Col B & C");
    expect(body[0][3].text).toBe("Col D");
    expect(body[1].length).toBe(4);
    expect(body[1][1].text).toBe("Col B");
    expect(body[1][2].text).toBe("Col C");
    expect(body[2].length).toBe(4);
    expect(body[2][0].text).toBe("Cell A1 & A2");
    expect(body[2][1].text).toBe("Cell B1");
    expect(body[2][2].text).toBe("Cell C1 & C2");
    expect(body[2][3].text).toBe("Cell D1");
    expect(body[3].length).toBe(4);
    expect(body[3][1].text).toBe("Cell B2");
    expect(body[3][3].text).toBe("Cell D2");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("img", () => {
    const [node] = convert(
      '<img width="10" style="height:10px" src="data:image/jpeg;base64,...encodedContent...">',
    );
    expect(node.image).toBe("data:image/jpeg;base64,...encodedContent...");
    expect(node.width).toBe(8);
    expect(node.height).toBe(8);
    expect(node.style?.[0]).toBe("html-img");
  });

  test("svg", () => {
    const [node] = convert(`
      <svg version="1.1" baseProfile="full" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="red" />
        <circle cx="150" cy="100" r="80" fill="green" />
        <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG</text>
      </svg>`);
    expect("svg" in node).toBe(true);
    expect((node.svg ?? "").length).toBeGreaterThan(0);
    expect(node.style?.[0]).toBe("html-svg");
  });

  test("svg_viewbox_only", () => {
    const [node] = convert(
      `<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>`,
    );
    expect("svg" in node).toBe(true);
  });

  test("svg_without_dimensions_is_skipped", () => {
    const warn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => {
      warnings.push(msg);
    };
    try {
      // pdfmake cannot size such an SVG and throws, so it is dropped instead
      const result = convert(
        `<p>before</p><svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg><p>after</p>`,
      );
      expect(result.some((n) => "svg" in n)).toBe(false);
      expect(result.length).toBe(2);
      expect(warnings.length).toBe(1);
    } finally {
      console.warn = warn;
    }
  });

  test("svg_missing_only_height_is_skipped", () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const result = convert(`<svg width="300" xmlns="http://www.w3.org/2000/svg"><rect/></svg>`);
      expect(result.some((n) => "svg" in n)).toBe(false);
    } finally {
      console.warn = warn;
    }
  });

  test("cascade_tags", () => {
    const [root] = convert(
      '<p style="text-align: center;"><span style="font-size: 14px;"><em><strong>test</strong></em></span></p>',
    );
    const node = nodes(nodes(nodes(root.text)[0].text)[0].text)[0];
    expect(node.text).toBe("test");
    expect(node.bold).toBeTruthy();
    expect(node.italics).toBeTruthy();
    expect(node.fontSize).toBe(11);
    expect(node.alignment).toBe("center");
    expect(node.style).toContain("html-strong");
    expect(node.style).toContain("html-em");
    expect(node.style).toContain("html-span");
    expect(node.style).toContain("html-p");
  });

  test("hr", () => {
    const [node] = convert("<hr>");
    expect(node.canvas).toBeTruthy();
    expect(node.canvas?.length).toBe(1);
    expect(node.canvas?.[0].type).toBe("line");
  });

  test("table non empty inside div styles", () => {
    const html = `<table>
      <thead>
        <tr>
          <th><div> </div></th>
          <th><div>Header Column B</div></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Value Cell A2</td>
          <td>Value Cell B2</td>
        </tr>
        <tr>
          <td>Value Cell A3</td>
          <td>Value Cell B3</td>
        </tr>
      </tbody>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].length).toBe(body[1].length);
  });

  test("table empty inside div header", () => {
    const html = `<table>
      <thead>
        <tr>
          <th><div></div></th>
          <th><div>Header Column B</div></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Value Cell A2</td>
          <td>Value Cell B2</td>
        </tr>
        <tr>
          <td>Value Cell A3</td>
          <td>Value Cell B3</td>
        </tr>
      </tbody>
    </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].length).toBe(body[1].length);
  });

  test("empty TR after rowspan", () => {
    const html = `<table>
                 <tbody>
                    <tr>
                       <td>A</td>
                       <td>B</td>
                       <td>C</td>
                    </tr>
                    <tr>
                       <td rowspan="2">AA</td>
                       <td rowspan="2">BB</td>
                       <td rowspan="2">CC</td>
                    </tr>
                    <tr></tr>
                 </tbody>
              </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].length).toBe(body[1].length);
  });

  test("multiple empty TR after rowspan", () => {
    const html = `<table>
                 <tbody>
                    <tr>
                       <td>A</td>
                       <td>B</td>
                       <td>C</td>
                    </tr>
                    <tr>
                       <td rowspan="4">AA</td>
                       <td rowspan="4">BB</td>
                       <td rowspan="4">CC</td>
                    </tr>
                    <tr></tr>
                    <tr></tr>
                    <tr></tr>
                 </tbody>
              </table>`;
    const [node] = convert(html);
    const body = tableBody(node);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].length).toBe(body[1].length);
  });

  test("inherit css styles", () => {
    const html = `<div style="color:red;"><span style="color:blue">blue<strong style="color:green">green</strong>blue</span><span>red</span></div>`;
    const [node] = convert(html);
    expect(node.color).toBe("red");
    expect(node.style).toContain("html-div");
    const outer = nodes(node.text);
    const firstSpan = nodes(outer[0].text);
    expect(firstSpan[0].text).toBe("blue");
    expect(firstSpan[0].color).toBe("blue");
    expect(firstSpan[1].text).toBe("green");
    expect(firstSpan[1].color).toBe("green");
    expect(firstSpan[1].bold).toBeTruthy();
    expect(firstSpan[2].text).toBe("blue");
    expect(firstSpan[2].color).toBe("blue");
    expect(outer[0].color).toBe("blue");
    expect(outer[1].text).toBe("red");
    expect(outer[1].color).toBe("red");
  });

  test("colored borders", () => {
    const html = `<table><tr><td style="border-top-width: 0; border-right: 1pt solid #0080C0; border-bottom: 0; border-left: 1px solid #0080C0;">Cell with border left and right in blue</td></tr></table>`;
    const [node] = convert(html);
    const cell = tableBody(node)[0][0];
    expect(cell.text).toBe("Cell with border left and right in blue");
    const border = cell.border as boolean[];
    expect(border[0]).toBeTruthy();
    expect(border[1]).toBeFalsy();
    expect(border[2]).toBeTruthy();
    expect(border[3]).toBeFalsy();
    expect(cell.borderColor).toEqual(["#0080c0", "#000000", "#0080c0", "#000000"]);
  });

  test("cell with P and DIV", () => {
    const html =
      "<table><tr><td>some text<p>p1<span>span1</span><span>span2</span></p><p>p2</p><span>span3</span><p><span>p3span4</span></p><div><span>span5</span><p>p4</p></div><strong>strong</strong></td></tr></table>";
    const [root] = convert(html);
    const cell = tableBody(root)[0][0];
    const stack = nodes(cell.stack);
    expect(stack[0].text).toBe("some text");
    expect(nodes(stack[1].text)[0].text).toBe("p1");
    expect(nodes(stack[1].text)[1].text).toBe("span1");
    expect(nodes(stack[1].text)[2].text).toBe("span2");
    expect(stack[2].text).toBe("p2");
    expect(stack[3].text).toBe("span3");
    expect(nodes(stack[4].text)[0].text).toBe("p3span4");
    expect(nodes(stack[5].stack)[0].text).toBe("span5");
    expect(nodes(stack[5].stack)[1].text).toBe("p4");
    expect(stack[6].text).toBe("strong");
  });

  test("tableAutoSize", () => {
    const html = `<table><tr style="height:100px"><td style="width:350px"></td><td></td></tr><tr><td style="width:100px"></td><td style="height:200px"></td></tr></table>`;
    const [node] = convert(html, { tableAutoSize: true });
    const widths = node.table?.widths as Array<string | number>;
    const heights = node.table?.heights as Array<string | number>;
    expect(widths.length).toBe(2);
    expect(widths[0]).toBe(264);
    expect(widths[1]).toBe("auto");
    expect(heights.length).toBe(2);
    expect(heights[0]).toBe(75);
    expect(heights[1]).toBe(151);
  });

  test("convertUnit and stack", () => {
    const html = `<div><div style="font-size:16px;margin-left:12pt">points</div><div style="margin-left:1rem;margin-right:-.25in">points</div></div>`;
    const [node] = convert(html);
    expect(Array.isArray(node.stack)).toBe(true);
    const stack = nodes(node.stack);
    expect(stack[0].marginLeft).toBe(12);
    expect(stack[0].fontSize).toBe(12);
    expect(stack[1].marginLeft).toBe(12);
    expect(stack[1].marginRight).toBe(-18);
  });

  test("'decoration' style", () => {
    const html = "<p><u><s>Test</s></u></p>";
    const [root] = convert(html);
    const node = nodes(nodes(root.text)[0].text)[0];
    expect(node.text).toBe("Test");
    expect(node.nodeName).toBe("S");
    expect(Array.isArray(node.decoration)).toBe(true);
    expect(node.decoration).toContain("underline");
    expect(node.decoration).toContain("lineThrough");
  });

  test("'decoration' style 2", () => {
    const html = `<p><span style="text-decoration:underline"><span style="text-decoration:line-through">Test</span></span></p>`;
    const [root] = convert(html);
    const node = nodes(nodes(root.text)[0].text)[0];
    expect(node.text).toBe("Test");
    expect(node.nodeName).toBe("SPAN");
    expect(Array.isArray(node.decoration)).toBe(true);
    expect(node.decoration).toContain("underline");
    expect(node.decoration).toContain("lineThrough");
  });

  test("font", () => {
    const [node] = convert(`<font color="#ff0033" size="4">font element</font>`);
    expect(node.color).toBe("#ff0033");
    expect(node.fontSize).toBe(18);
  });

  test("sup", () => {
    const [node] = convert("<sup>sup</sup>");
    expect(node.text).toBe("sup");
    expect(node.sup).toBe(true);
  });

  test("sub", () => {
    const [node] = convert("<sub>sub</sub>");
    expect(node.text).toBe("sub");
    expect(node.sub).toBe(true);
  });

  test("parse NAME color", () => {
    const [node] = convert(`<span style="color:red">red</span>`);
    expect(node.text).toBe("red");
    expect(node.color).toBe("red");
  });

  test("parse HEX color", () => {
    const [node] = convert(`<span style="color:#E63737">red</span>`);
    expect(node.text).toBe("red");
    expect(node.color).toBe("#e63737");
  });

  test("parse RGB color", () => {
    const [node] = convert(`<span style="color:rgb(230,55,55)">red</span>`);
    expect(node.text).toBe("red");
    expect(node.color).toBe("#e63737");
  });

  test("parse RGBA color", () => {
    const [node] = convert(`<span style="color:rgba(230,55,55,0.8)">red</span>`);
    expect(node.text).toBe("red");
    expect(node.color).toBe("#e63737");
    expect(node.opacity).toBe(0.8);
  });

  test("parse RGB color with %", () => {
    const [node] = convert(`<span style="color:rgb(90.2%, 21.568%, 21.568%)">red</span>`);
    expect(node.text).toBe("red");
    expect(node.color).toBe("#e63737");
  });

  test("parse HSL color", () => {
    const [node] = convert(`<span style="color:hsl(0, 78%, 56%)">red</span>`);
    expect(node.text).toBe("red");
    expect(node.color).toBe("#e73737");
  });

  test("showHidden", () => {
    const html = `<div><div style="display:none">hidden</div><div>visible</div></div>`;
    const [node] = convert(html, { showHidden: true });
    const stack = nodes(node.stack);
    expect(stack.length).toBe(2);
    expect(stack[0].text).toBe("hidden");
  });

  test("ignoreStyles", () => {
    const html = `<div style="font-family:Roboto">Text in Roboto</div>`;
    const [node] = convert(html, { ignoreStyles: ["font-family"] });
    expect(node.text).toBe("Text in Roboto");
    expect(node.font).toBeFalsy();
  });

  test("borderValueRearrange", () => {
    const html = `<div style="border:solid 10px red">border</div>`;
    const [node] = convert(html);
    expect(node.text).toBe("border");
    expect(node.border).toEqual([true, true, true, true]);
    expect(node.borderColor).toEqual(["red", "red", "red", "red"]);
  });

  test("removeTagClasses", () => {
    const html = `<div class="my-div"><strong>hello world</strong></div>`;
    const [node] = convert(html, { removeTagClasses: true });
    const inner = nodes(node.text);
    expect(inner[0].text).toBe("hello world");
    expect(inner[0].style).toEqual(["my-div"]);
    expect(node.style).toEqual(["my-div"]);
  });

  test("img with invalid width/height in style", () => {
    const html = `<img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/7QPQUGhvdG9zaG9wIDMuMAA4QklNA+kKUHJpbnQgSW5mbwAAAAB4AAMAAABIAEgAAAAAAtgCKP/h/+IC+QJGA0cFKAP8AAIAAABIAEgAAAAAAtgCKAABAAAAZAAAAAEAAwMDAAAAAScPAAEAAQA" style="width:100%;height:auto" />`;
    const [node] = convert(html);
    expect(String(node.image).startsWith("data:image")).toBe(true);
    expect(node.width).toBeUndefined();
    expect(node.height).toBeUndefined();
  });

  test("complex table with rowspan and colspan", () => {
    const html = `<table><th colspan="3" rowspan="2">ABC</th><th colspan="13">DEF</th><th colspan="4" rowspan="2">GHI</th><th colspan="13">JKL</th></tr><tr><th colspan="10">123</th><th colspan="3">456</th><th colspan="10">789</th><th colspan="3">111</th></tr></table>`;
    const [node] = convert(html);
    expect(node.table?.body).toBeTruthy();
    const body = tableBody(node);
    expect(body.length).toBe(2);
    expect(body[0].length).toBe(33);
    expect(body[1].length).toBe(33);
    expect(body[0][0].text).toBe("ABC");
    expect(body[0][2].text).toBe("");
    expect(body[0][6].text).toBe("");
    expect(body[0][16].text).toBe("GHI");
    expect(body[0][19].text).toBe("");
    expect(body[0][21].text).toBe("");
    expect(body[0][24].text).toBe("");
    expect(body[1][0].text).toBe("");
    expect(body[1][5].text).toBe("");
    expect(body[1][6].text).toBe("");
    expect(body[1][13].text).toBe("456");
    expect(body[1][19].text).toBe("");
    expect(body[1][21].text).toBe("");
    expect(body[1][30].text).toBe("111");
  });

  test("table (dynamic widths)", () => {
    const html = `<table style="border-collapse: collapse; width: 80%; height: 40px;" border="1">
      <colgroup>
        <col style="width: 30%;">
        <col style="width: 70%;">
      </colgroup>
      <tbody>
        <tr style="height: 20px;">
          <td style="background-color: rgb(251, 238, 184); border: 1px solid rgb(241, 196, 15); height: 20px;">Value Cell A1</td>
          <td style="background-color: rgb(248, 202, 198); text-align: right; border: 2px solid rgb(224, 62, 45); height: 20;">Value Cell B1</td>
        </tr>
        <tr style="height: 20px;">
          <td style="border-image: initial; height: 20px; text-align: center;">Value Cell A2</td>
          <td style="border-image: initial; height: 20px; text-align: justify;">Value Cell B2</td>
        </tr>
      </tbody>
    </table>`;
    const [node] = convert(html, { tableAutoSize: true });
    const body = tableBody(node);
    expect(body.length).toBe(2);
    expect(body[0][0].text).toBe("Value Cell A1");
    expect(body[0][0].fillColor).toBe("#fbeeb8");
    expect((body[0][0].borderColor as string[])[0]).toBe("#f1c40f");
    expect(body[0][0].style?.[0]).toBe("html-td");
    expect(body[0][0].style?.[1]).toBe("html-tr");
    expect(body[1][1].text).toBe("Value Cell B2");
    expect(body[1][1].style?.[0]).toBe("html-td");
    expect(body[1][1].style?.[1]).toBe("html-tr");
    const widths = node.table?.widths as Array<string | number>;
    expect(widths[0]).toBe("24%");
    expect(widths[1]).toBe("56%");
    expect(node.style?.[0]).toBe("html-table");
  });

  test("table (dynamic widths) 2", () => {
    const html = `<table class="table table-condensed" style="width: 100%;"><thead><tr><th>ABC</th><th>DEF</th><th>GHI</th><th>KLM</th><th>NOP</th></tr></thead><tbody><tr><td>ABC1</td><td>DEF1</td><td>GHI1</td><td>50,00</td><td style="text-align: right;">17:45</td></tr><tr><td>ABC2</td><td>DEF2</td><td>GHI2</td><td>50,00</td><td style="text-align: right;">4:00</td></tr><tr><td colspan="4">Total</td><td style="text-align: right;">21:45</td></tr></tbody></table>`;
    const [node] = convert(html, { tableAutoSize: true });
    const body = tableBody(node);
    expect(body.length).toBe(4);
    expect(body[0][0].text).toBe("ABC");
    expect(body[3][1].text).toBe("");
    const widths = node.table?.widths as Array<string | number>;
    expect(widths.length).toBe(5);
    expect(widths[0]).toBe("20%");
    expect(widths[1]).toBe("20%");
    expect(widths[2]).toBe("20%");
    expect(widths[3]).toBe("20%");
    expect(widths[4]).toBe("20%");
  });

  test("columns", () => {
    const html = `<div data-pdfmake-type="columns"><div data-pdfmake='{"width": "*"}'></div><div style="width:auto">stuff centered</div><div data-pdfmake="{ 'width': '*' } "></div></div>`;
    const [node] = convert(html);
    const columns = nodes(node.columns);
    expect(columns.length).toBe(3);
    expect(columns[0].width).toBe("*");
    expect(columns[1].width).toBe("auto");
    expect(columns[1].text).toBe("stuff centered");
    expect(columns[2].width).toBe("*");
  });

  test("ol with ul", () => {
    const html =
      "<ol><li><strong>Number 1</strong><span>:</span><ul><li><span>Item</span></li></ul></li></ol>";
    const [node] = convert(html);
    const ol = nodes(node.ol);
    expect(ol.length).toBe(1);
    const stack = nodes(ol[0].stack);
    expect(Array.isArray(ol[0].stack)).toBe(true);
    expect(stack.length).toBe(2);
    expect(nodes(stack[0].text)[0].text).toBe("Number 1");
    const ul = nodes(stack[1].ul);
    expect(Array.isArray(stack[1].ul)).toBe(true);
    expect(nodes(ul[0].text)[0].text).toBe("Item");
  });

  test("complex nested ul/ol with p tags", () => {
    const html =
      "<ul><li><p><strong>sometitle</strong></p><ol><li><p><strong>sometitle2:</strong></p><ul><li><p>sometext</p></li><li><p>sometext</p></li><li><p>sometext</p></li><li><p>sometext</p></li></ul></li><li><p><strong>sometitle3:</strong></p><ul><li><p>sometext</p></li></ul></li><li><p><strong>sometitle4:</strong></p><ul><li><p>sometext</p></li><li><p>sometext</p></li><li><p>sometext</p></li></ul></li><li><p><strong>sometitle5:</strong></p><ul><li><p>sometext</p></li><li><p>sometext</p></li><li><p>sometext</p></li></ul></li><li><p><strong>sometitle6:</strong></p><ul><li><p>sometext</p></li></ul></li></ol><p><strong>sometitle7:</strong></p><ul><li><p>sometext</p></li><li><p>somtext</p></li></ul></li></ul>";
    const [root] = convert(html);
    // 1. Basic structure check
    expect(root.nodeName).toBe("UL");
    expect(Array.isArray(root.ul)).toBe(true);
    expect(nodes(root.ul).length).toBe(1);

    // 2. Check the main LI stack
    const mainLiStack = nodes(nodes(nodes(root.ul)[0].stack)[0].stack);
    expect(mainLiStack.length).toBe(3);
    expect(mainLiStack[0].nodeName).toBe("P");
    expect(mainLiStack[1].nodeName).toBe("OL");
    expect(mainLiStack[2].nodeName).toBe("P");

    // 3. Check 'sometitle' (first item in main stack)
    expect(nodes(mainLiStack[0].text)[0].text).toBe("sometitle");

    // 4. Check the nested OL (second item in main stack)
    const nestedOl = mainLiStack[1];
    expect(nestedOl.nodeName).toBe("OL");
    expect(Array.isArray(nestedOl.ol)).toBe(true);
    expect(nodes(nestedOl.ol).length).toBe(5);

    // 5. Check 'sometitle2:' (first LI of the nested OL)
    const nestedLi1 = nodes(nestedOl.ol)[0];
    expect(nodes(nodes(nodes(nestedLi1.stack)[0].text)[0].text)[0].text).toBe("sometitle2:");

    // 6. Check the deep UL (inside the first LI of the nested OL)
    const deepUl = nodes(nestedLi1.stack)[1];
    expect(deepUl.nodeName).toBe("UL");
    expect(Array.isArray(deepUl.ul)).toBe(true);
    expect(nodes(deepUl.ul).length).toBe(4);
    expect(nodes(nodes(deepUl.ul)[0].stack)[0].text).toBe("sometext");
    expect(nodes(nodes(deepUl.ul)[3].stack)[0].text).toBe("sometext");

    // 7. Check 'sometitle7:' (third item in main stack)
    expect(nodes(mainLiStack[2].text)[0].text).toBe("sometitle7:");
  });

  test("CSS units", () => {
    const html = `<div style="line-height:107%;font-size:large;width:110px;height:50pt;margin-left:1in;margin-top:2em;margin-right:1rem;margin-bottom:0.5cm">hello world</div>`;
    const [node] = convert(html);
    expect(node.lineHeight).toBe(1.07);
    expect(node.fontSize).toBe(14.4);
    expect(node.width).toBe(83);
    expect(node.height).toBe(50);
    expect(node.marginLeft).toBe(72);
    expect(node.marginRight).toBe(12);
    expect(node.marginTop).toBe(24);
    expect(node.marginBottom).toBe(14);
  });

  test("borders", () => {
    const html = `<table><tr><td style="border:1px solid red">border:1px solid red</td><td style="border-bottom:1px solid blue">border-bottom:1px solid blue</td><td style="border-top-color:green">border-top-color:green</td><td style="border-right-width:0px">border-right-width:0px</td><td style="border-color:rgb(255, 0, 0) blue green">border-color:rgb(255, 0, 0) blue green</td></tr></table>`;
    const [node] = convert(html);
    const row = tableBody(node)[0];
    expect(row.length).toBe(5);
    expect(row[0].text).toBe("border:1px solid red");
    expect(row[0].border).toEqual([true, true, true, true]);
    expect(row[0].borderColor).toEqual(["red", "red", "red", "red"]);
    expect(row[1].text).toBe("border-bottom:1px solid blue");
    expect(row[1].border).toEqual([true, true, true, true]);
    expect(row[1].borderColor).toEqual(["#000000", "#000000", "#000000", "blue"]);
    expect(row[2].text).toBe("border-top-color:green");
    expect(row[2].borderColor).toEqual(["#000000", "green", "#000000", "#000000"]);
    expect(row[3].text).toBe("border-right-width:0px");
    expect(row[3].border).toEqual([true, true, false, true]);
    expect(row[4].text).toBe("border-color:rgb(255, 0, 0) blue green");
    expect(row[4].borderColor).toEqual(["blue", "#ff0000", "blue", "green"]);
  });
});
