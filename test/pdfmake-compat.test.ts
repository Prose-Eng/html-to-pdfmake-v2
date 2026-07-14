import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
import htmlToPdfmake, { type Content } from "../src/index";

interface PdfDocument02 {
  getBuffer(callback: (buffer: Uint8Array) => void): void;
}

interface PdfDocument03 {
  getBuffer(): Promise<Uint8Array>;
}

interface PdfMake02 {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(definition: Record<string, unknown>): PdfDocument02;
}

interface PdfMake03 {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf(definition: Record<string, unknown>): PdfDocument03;
  setUrlAccessPolicy(policy: (url: string) => boolean): void;
}

interface Renderer {
  version: string;
  render(definition: Record<string, unknown>): Promise<Uint8Array>;
}

const require = createRequire(import.meta.url);
const pdfMake02 = require("pdfmake-0-2/build/pdfmake.js") as PdfMake02;
const pdfMake03 = require("pdfmake-0-3/build/pdfmake.js") as PdfMake03;
const vfs02 = require("pdfmake-0-2/build/vfs_fonts.js") as Record<string, string>;
const vfs03 = require("pdfmake-0-3/build/vfs_fonts.js") as Record<string, string>;
const version02 = (require("pdfmake-0-2/package.json") as { version: string }).version;
const version03 = (require("pdfmake-0-3/package.json") as { version: string }).version;

pdfMake02.addVirtualFileSystem(vfs02);
pdfMake03.addVirtualFileSystem(vfs03);
pdfMake03.setUrlAccessPolicy(() => false);

const renderers: Renderer[] = [
  {
    version: version02,
    render(definition) {
      return new Promise((resolve) => pdfMake02.createPdf(definition).getBuffer(resolve));
    },
  },
  {
    version: version03,
    render(definition) {
      return pdfMake03.createPdf(definition).getBuffer();
    },
  },
];

const { window } = new JSDOM("");
const domWindow = window as unknown as Window;

const jpegPixel =
  "data:image/jpeg;base64," +
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsN" +
  "DhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQU" +
  "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QA" +
  "HwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh" +
  "MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVW" +
  "V1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
  "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQF" +
  "BgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV" +
  "YnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOE" +
  "hYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq" +
  "8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDwKiiiv2g/Pz//2Q==";

const representativeHtml = `
  <h1 style="color:#17365d; text-align:center">Compatibility report</h1>
  <p style="font-size:14px; line-height:120%; margin:4px 0 8px">
    Styled <strong>bold</strong>, <em>italic</em>, <u>underlined</u>,
    H<sub>2</sub>O and x<sup>2</sup> text.
  </p>
  <ul>
    <li>Unordered item</li>
    <li>Nested list<ol start="3"><li>Third</li><li>Fourth</li></ol></li>
  </ul>
  <table style="width:100%; border:1px solid #666">
    <thead><tr><th colspan="2">Spanning header</th></tr></thead>
    <tbody>
      <tr><td rowspan="2">Row span</td><td>First value</td></tr>
      <tr><td>
        <table><tr><td>Nested A</td><td>Nested B</td></tr></table>
      </td></tr>
    </tbody>
  </table>
  <p>
    <img src="${jpegPixel}" style="width:100%; height:auto">
    <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="20" fill="#2f5597" />
    </svg>
  </p>
`;

function convert(html: string): Content {
  return htmlToPdfmake(html, { window: domWindow, tableAutoSize: true }) as Content;
}

function assertPdfHeader(buffer: Uint8Array): void {
  expect(buffer.byteLength).toBeGreaterThan(1_000);
  expect(new TextDecoder().decode(buffer.subarray(0, 5))).toBe("%PDF-");
}

function assertCompatibleValues(value: unknown, path = "content"): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertCompatibleValues(child, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (["width", "height", "fontSize", "lineHeight"].includes(key)) {
      if (
        child === false ||
        child === null ||
        (typeof child === "number" && !Number.isFinite(child))
      ) {
        throw new TypeError(`${childPath} contains an invalid pdfmake dimension`);
      }
    }
    if (["sub", "sup"].includes(key) && typeof child !== "boolean") {
      throw new TypeError(`${childPath} must be a pdfmake boolean`);
    }
    assertCompatibleValues(child, childPath);
  }
}

describe("pdfmake renderer compatibility", () => {
  test("the aliases pin the supported renderer versions", () => {
    expect(version02).toBe("0.2.23");
    expect(version03).toBe("0.3.11");
  });

  test("representative converter output contains only compatible values", () => {
    assertCompatibleValues(convert(representativeHtml));
  });

  for (const renderer of renderers) {
    test(`renders representative converted HTML with pdfmake ${renderer.version}`, async () => {
      const content = convert(representativeHtml);
      assertCompatibleValues(content);
      const buffer = await renderer.render({ content, defaultStyle: { font: "Roboto" } });
      assertPdfHeader(buffer);
    });
  }
});
