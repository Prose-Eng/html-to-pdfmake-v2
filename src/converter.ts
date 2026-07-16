import { parseColor } from "./helpers/color";
import {
  borderValueRearrange,
  parseCssDeclarations,
  splitCssValues,
  topRightBottomLeftToObject,
} from "./helpers/css";
import { type DefaultStyle, type DefaultStyles, createDefaultStyles } from "./helpers/defaults";
import { convertToUnit, toCamelCase } from "./helpers/units";
import type { PdfNode, PdfTable, StyleProperty, StyleValue } from "./types/internal";
import type { Content, HtmlToPdfmakeOptions, ImagesByReferenceResult } from "./types/public";

/** Parameters passed to {@link HtmlToPdfMake.applyStyle}. */
interface ApplyStyleParams {
  ret: PdfNode;
  parents: HTMLElement[];
}
const DECORATION_LINES: Record<string, string> = {
  underline: "underline",
  overline: "overline",
  "line-through": "lineThrough",
};
const DECORATION_STYLES = new Set(["solid", "double", "dotted", "dashed", "wavy"]);
const TABLE_CELL_NODES = new Set(["TD", "TH"]);
const SUPPORTED_BORDER_PROPERTY =
  /^border(?:-(?:top|right|bottom|left))?(?:-(?:width|color|style))?$/;
const FONT_SIZE_KEYWORDS: Record<string, number> = {
  "xx-small": 7.2,
  "x-small": 9,
  small: 10.7,
  medium: 12,
  large: 14.4,
  "x-large": 18,
  "xx-large": 24,
  "xxx-large": 36,
};

function convertDimension(
  value: string,
  property: "width" | "height",
  nodeName: string,
): string | number | undefined {
  const normalized = value.trim().toLowerCase();
  const unitValue = convertToUnit(normalized);
  if (unitValue !== false) return unitValue;
  if (nodeName === "IMG") return undefined;
  if (
    property === "width" &&
    (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(normalized) ||
      normalized === "auto" ||
      normalized === "*")
  ) {
    return normalized;
  }
  return undefined;
}

function convertBoxShorthand(value: string): Array<string | number> | undefined {
  const values = splitCssValues(value);
  if (
    values.length < 1 ||
    values.length > 4 ||
    values.some((part) => part.toLowerCase() === "auto")
  ) {
    return undefined;
  }
  const sides = topRightBottomLeftToObject(value);
  const converted = [sides.left, sides.top, sides.right, sides.bottom].map((part) =>
    convertToUnit(part),
  );
  if (converted.some((part) => part === false)) return undefined;
  return converted as number[];
}

function convertOpacity(value: string): number | undefined {
  const normalized = value.trim();
  const parsed = normalized.endsWith("%")
    ? Number(normalized.slice(0, -1)) / 100
    : Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(1, Math.max(0, parsed));
}

/**
 * Converts an HTML string into a pdfmake-compatible content structure. Instances
 * hold per-conversion state; call {@link HtmlToPdfMake.convert} with the HTML.
 */
export class HtmlToPdfMake {
  private readonly wndw: Window & typeof globalThis;
  private readonly tableAutoSize: boolean;
  private readonly imagesByReference: boolean;
  private readonly removeExtraBlanks: boolean;
  private readonly showHidden: boolean;
  private readonly removeTagClasses: boolean;
  private readonly ignoreStyles: string[];
  private readonly fontSizes: number[];
  private readonly defaultStyles: DefaultStyles;
  private readonly imagesRef: string[];
  private readonly imagesByReferenceSuffix: string;
  private readonly customTag?: HtmlToPdfmakeOptions["customTag"];
  private readonly replaceText?: HtmlToPdfmakeOptions["replaceText"];

  constructor(options?: HtmlToPdfmakeOptions) {
    this.wndw = (options?.window ?? window) as Window & typeof globalThis;
    this.tableAutoSize =
      typeof options?.tableAutoSize === "boolean" ? options.tableAutoSize : false;
    this.imagesByReference =
      typeof options?.imagesByReference === "boolean" ? options.imagesByReference : false;
    this.removeExtraBlanks =
      typeof options?.removeExtraBlanks === "boolean" ? options.removeExtraBlanks : false;
    this.showHidden = typeof options?.showHidden === "boolean" ? options.showHidden : false;
    this.removeTagClasses =
      typeof options?.removeTagClasses === "boolean" ? options.removeTagClasses : false;
    this.ignoreStyles = options && Array.isArray(options.ignoreStyles) ? options.ignoreStyles : [];
    // A random string to be used in the image references
    this.imagesByReferenceSuffix = Math.random().toString(36).slice(2, 8);
    // Used with the size attribute on the font elements to calculate relative font size
    this.fontSizes =
      options && Array.isArray(options.fontSizes)
        ? options.fontSizes
        : [10, 14, 16, 18, 20, 24, 28];
    this.defaultStyles = createDefaultStyles();
    this.imagesRef = [];
    this.customTag = options?.customTag;
    this.replaceText = options?.replaceText;

    if (options?.defaultStyles) this.changeDefaultStyles(options.defaultStyles);
  }

  /** Convert the given HTML into a pdfmake content object. */
  convert(htmlText: string): Content | ImagesByReferenceResult {
    let result: PdfNode[] | PdfNode | string | undefined = this.convertHtml(htmlText);
    // if we only pass a string without HTML code
    if (typeof result === "string") result = { text: result };
    // if images by reference
    if (this.imagesByReference) {
      const images: Record<string, string> = {};
      this.imagesRef.forEach((src, i) => {
        // check if 'src' is a JSON string
        images[`img_ref_${this.imagesByReferenceSuffix}${i}`] = src.startsWith("{")
          ? JSON.parse(src)
          : src;
      });
      return { content: result as Content, images };
    }
    return result as Content;
  }

  /** Permit to change the default styles based on the options. */
  private changeDefaultStyles(overrides: NonNullable<HtmlToPdfmakeOptions["defaultStyles"]>): void {
    for (const keyStyle in overrides) {
      const override = overrides[keyStyle];
      if (Object.prototype.hasOwnProperty.call(this.defaultStyles, keyStyle)) {
        // if we want to remove a default style
        if (!override) {
          delete this.defaultStyles[keyStyle];
        } else {
          const target = this.defaultStyles[keyStyle] as DefaultStyle;
          for (const k in override) {
            // if we want to delete a specific property
            if (override[k] === "") delete target[k];
            else target[k] = override[k] as StyleValue;
          }
        }
      } else {
        // if we add default styles
        const target: DefaultStyle = {};
        this.defaultStyles[keyStyle] = target;
        if (override) {
          for (const ks in override) target[ks] = override[ks] as StyleValue;
        }
      }
    }
  }

  /**
   * Takes an HTML string, converts it to a DOM tree and recursively parses the
   * content into a pdfmake compatible doc definition.
   */
  private convertHtml(htmlText: string): PdfNode[] | string | undefined {
    // Create a HTML DOM tree out of html string
    const parser = new this.wndw.DOMParser();
    let html = htmlText;
    if (this.removeExtraBlanks) {
      html = html
        .replace(
          /(<\/?(div|p|h1|h2|h3|h4|h5|h6|ol|ul|li)([^>]+)?>)\s+(<\/?(div|p|h1|h2|h3|h4|h5|h6|ol|ul|li))/gi,
          "$1$4",
        )
        .replace(
          /(<\/?(div|p|h1|h2|h3|h4|h5|h6|ol|ul|li)([^>]+)?>)\s+(<\/?(div|p|h1|h2|h3|h4|h5|h6|ol|ul|li))/gi,
          "$1$4",
        )
        .replace(/(<td([^>]+)?>)\s+(<table)/gi, "$1$3")
        .replace(/(<\/table>)\s+(<\/td>)/gi, "$1$2");
    }
    const parsedHtml = parser.parseFromString(html, "text/html");

    const docDef = this.parseElement(parsedHtml.body, []) as PdfNode;

    // remove first level
    return docDef.stack || docDef.text;
  }

  /**
   * Convert a single DOM node to pdfmake, dispatching by node type. Calls itself
   * recursively for child elements.
   */
  private parseElement(element: Node, parents: HTMLElement[]): PdfNode | string | undefined {
    const nodeName = element.nodeName.toUpperCase();

    // ignore some HTML tags
    if (["COLGROUP", "COL"].indexOf(nodeName) > -1) return "";

    if (element.nodeType === 3) return this.parseTextNode(element, parents);
    if (element.nodeType === 1) {
      return this.parseElementNode(
        element as HTMLElement,
        nodeName,
        nodeName.toLowerCase(),
        parents,
      );
    }
    return undefined;
  }

  /** Convert a TEXT_NODE, honouring the parent's whitespace handling. */
  private parseTextNode(element: Node, parents: HTMLElement[]): PdfNode | "" {
    if (!element.textContent) return "";
    let text = element.textContent;
    const parent = parents[parents.length - 1];
    // check if we have 'white-space' in the parent's style, or a <PRE> ancestor
    const styleParentTextNode = this.parseStyle(parent, true);
    let hasWhiteSpace = parents.findIndex((p) => p.nodeName === "PRE") > -1;
    for (let i = 0; i < styleParentTextNode.length; i++) {
      if (styleParentTextNode[i].key === "preserveLeadingSpaces") {
        hasWhiteSpace = styleParentTextNode[i].value as boolean;
        break;
      }
    }
    // if no 'white-space' style, then deal with white spaces
    if (!hasWhiteSpace) text = text.replace(/\s*\n\s*/g, " ");
    if (this.replaceText) text = this.replaceText(text, parents);

    // for table-ish parents: remove all empty space
    if (["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "OL"].indexOf(parent.nodeName) > -1) {
      text = text.replace(/^[\s﻿\xA0]+|[\s﻿\xA0]+$/g, "");
    }
    if (text) return this.applyStyle({ ret: { text }, parents });
    return "";
  }

  /** Convert an ELEMENT_NODE: gather children, then dispatch on the tag name. */
  private parseElementNode(
    el: HTMLElement,
    nodeName: string,
    nodeNameLowerCase: string,
    parents: HTMLElement[],
  ): PdfNode | string | undefined {
    const visibility = el.style.visibility.toLowerCase();
    const isHidden =
      el.hidden ||
      el.style.display.toLowerCase() === "none" ||
      visibility === "hidden" ||
      visibility === "collapse";
    if (!this.showHidden && isHidden) {
      return undefined;
    }

    let ret: PdfNode = { text: [] };
    ret.nodeName = nodeName;
    if (el.id) ret.id = el.id;
    parents.push(el);

    if (el.childNodes && el.childNodes.length > 0) {
      const collected = ret.text as PdfNode[];
      el.childNodes.forEach((child) => {
        const res = this.parseElement(child, parents);
        if (res) {
          if (typeof res !== "string" && Array.isArray(res.text) && res.text.length === 0) {
            res.text = "";
          }
          collected.push(res as PdfNode);
        }
      });
      // find if we need a 'stack' instead of a 'text'
      if (this.searchForStack(ret)) {
        ret.stack = collected.slice(0);
        delete ret.text;
        if (!["TABLE", "TH", "TD", "OL", "UL", "IMG"].includes(nodeName)) {
          ret = this.applyStyle({ ret, parents });
        }
      } else {
        // apply all the inherited classes and styles from the parents
        ret = this.applyStyle({ ret, parents });
      }
    }
    parents.pop();

    switch (nodeName) {
      case "TABLE":
        ret = this.buildTable(ret, el, parents);
        break;
      case "TH":
      case "TD":
        ret = this.buildTableCell(ret, el, parents);
        break;
      case "SVG": {
        const svg = this.buildSvg(el);
        if (!svg) return undefined;
        ret = svg;
        break;
      }
      case "BR":
        // for BR we return '\n'
        ret.text = [{ text: "\n" }];
        break;
      case "SUB":
      case "SUP":
        ret[nodeNameLowerCase] = true;
        break;
      case "HR":
        this.buildHr(ret, el);
        break;
      case "OL":
      case "UL":
        ret = this.buildList(ret, el, nodeNameLowerCase, parents);
        break;
      case "LI":
        ret = this.buildListItem(ret);
        break;
      case "PRE":
        ret.preserveLeadingSpaces = true;
        break;
      case "IMG":
        ret = this.buildImage(ret, el, parents);
        break;
      case "A":
        ret = this.buildAnchor(ret, el);
        break;
      default:
        this.buildColumns(ret, el, nodeName);
        break;
    }

    return this.finalizeNode(ret, el, nodeName, parents);
  }

  /** Build a pdfmake table node from the gathered rows/cells. */
  private buildTable(ret: PdfNode, el: HTMLElement, parents: HTMLElement[]): PdfNode {
    // the format for the table is table.body[[], [], ...]
    const table: PdfTable = { body: [] };
    ret.table = table;

    const tbodies = ret.stack || ret.text;
    if (Array.isArray(tbodies)) {
      let rowIndex = 0;
      let hasRowSpan = false; // TRUE if we have some rowspan
      // first round is to deal with colspan
      tbodies.forEach((tbody) => {
        const rows = tbody.stack || tbody.text;
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            const cells = row.stack || row.text;
            if (Array.isArray(cells)) {
              const bodyRow: PdfNode[] = [];
              table.body[rowIndex] = bodyRow;
              cells.forEach((cell) => {
                bodyRow.push(cell);
                // do we have a colSpan? if yes, insert empty cells
                if (typeof cell.colSpan === "number" && cell.colSpan > 1) {
                  let n = cell.colSpan;
                  while (--n > 0) bodyRow.push({ text: "" });
                }
                // do we have a rowSpan?
                if (typeof cell.rowSpan === "number" && cell.rowSpan > 1) hasRowSpan = true;
              });
              rowIndex++;
            }
          });
        }
      });

      if (hasRowSpan) {
        const header = table.body[0];
        if (Array.isArray(header)) {
          const columnsCount = header.length;
          const rowsCount = table.body.length;
          for (let columnInd = 0; columnInd < columnsCount; columnInd++) {
            for (let rowInd = 0; rowInd < rowsCount; rowInd++) {
              const row = table.body[rowInd];
              if (Array.isArray(row)) {
                const cell = row[columnInd];
                // do we have a rowSpan?
                if (typeof cell.rowSpan === "number" && cell.rowSpan > 1) {
                  const len = cell.rowSpan;
                  const colspan = typeof cell.colSpan === "number" ? cell.colSpan : 1;
                  for (let j = 1; j <= len - 1; j++) {
                    let cs = colspan;
                    if (table.body[rowInd + j]) {
                      while (cs--) table.body[rowInd + j].splice(columnInd, 0, { text: "" });
                    } else {
                      // if we have an empty <tr></tr>
                      cell.rowSpan = (cell.rowSpan as number) - 1;
                    }
                  }
                  // increase rowInd to skip processed rows
                  rowInd += len - 1;
                }
              }
            }
          }
        }
      }
    }

    delete ret.stack;
    delete ret.text;
    // apply all the inherited classes and styles from the parents (mutates ret)
    this.applyStyle({ ret, parents: parents.concat([el]) });

    // if option tableAutoSize, then try to apply the correct width/height
    if (this.tableAutoSize) this.applyTableAutoSize(table, el);

    // check if we have some data-pdfmake to apply
    if (el.dataset.pdfmake) {
      // handle simple quotes, e.g. <table data-pdfmake="{'layout':'noBorders'}">
      const raw = el.dataset.pdfmake.replace(/'/g, '"');
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const key in parsed) {
          if (key === "layout") ret.layout = parsed[key];
          else table[key] = parsed[key];
        }
      } catch (e) {
        console.error(e);
      }
    }
    return ret;
  }

  /** Apply width/height derived from cell styles onto the table (tableAutoSize). */
  private applyTableAutoSize(table: PdfTable, el: HTMLElement): void {
    const cellsWidths: Array<Array<string | number>> = [];
    const cellsHeights: Array<Array<string | number>> = [];
    const tableWidths: Array<string | number> = [];
    const tableHeights: Array<string | number> = [];

    // determine if we have "width:100%" on the TABLE
    const fullWidth = el.getAttribute("width") === "100%" || el.style.width === "100%";

    const elementAttrWidth = el.getAttribute("width") || "";
    const tableHaveWidth = (el.style.width || elementAttrWidth).endsWith("%");
    let tableWidthPct = 0;
    if (tableHaveWidth) {
      tableWidthPct = Number((el.style.width || elementAttrWidth).replace(/[^0-9.]/g, ""));
    }

    let tableHaveColgroup = false;
    let tableColgroupIndex = -1;
    for (let x = 0; x < el.children.length; x++) {
      const child = el.children[x];
      if (!tableHaveColgroup) tableColgroupIndex++;
      if (child.nodeName.toUpperCase() === "COLGROUP") tableHaveColgroup = true;
    }

    table.body.forEach((row, rIndex) => {
      cellsWidths.push([]);
      cellsHeights.push([]);
      row.forEach((cell, cellIndex) => {
        // we want to remember the different sizes
        let width: string | number = typeof cell.width !== "undefined" ? cell.width : "auto";
        if (width === "*") width = "auto"; // 'width:*' is invalid, use 'auto'
        let height: string | number = typeof cell.height !== "undefined" ? cell.height : "auto";
        if (height === "*") height = "auto";
        const colSpan = typeof cell.colSpan === "number" ? cell.colSpan : 1;
        const rowSpan = typeof cell.rowSpan === "number" ? cell.rowSpan : 1;
        // divide by the col/rowspan when width/height is numeric
        if (width !== "auto" && colSpan > 1) {
          if (!Number.isNaN(Number(width))) width = Number(width) / colSpan;
          else width = "auto";
        }
        if (height !== "auto" && rowSpan > 1) {
          if (!Number.isNaN(Number(height))) height = Number(height) / rowSpan;
          else height = "auto";
        }

        // if we have colgroups defining cells widths
        if (tableHaveColgroup) {
          const colGroups = el.children[tableColgroupIndex];
          const colElement = colGroups.children[cellIndex] as HTMLElement | undefined;
          if (colElement) {
            const colAttrWidth = colElement.getAttribute("width") || "";
            const colStyleWidth = colElement.style.width;
            if ((colAttrWidth || colStyleWidth).endsWith("%")) {
              width = colAttrWidth || colStyleWidth;
            }
          }
        }

        cellsWidths[rIndex].push(width);
        cellsHeights[rIndex].push(height);
      });
    });

    // determine the max width for each cell
    cellsWidths.forEach((row) => {
      row.forEach((cellWidth, cellIndex) => {
        const type = typeof tableWidths[cellIndex];
        if (
          type === "undefined" ||
          (cellWidth !== "auto" &&
            type === "number" &&
            (cellWidth as number) > (tableWidths[cellIndex] as number)) ||
          (cellWidth !== "auto" && tableWidths[cellIndex] === "auto")
        ) {
          let finalWidth: string | number = cellWidth;
          if (tableHaveWidth) {
            // rule of three to get cell's proportional width
            const cellPercentage =
              cellWidth === "auto"
                ? tableWidthPct / row.length
                : (Number(String(cellWidth).replace("%", "")) * tableWidthPct) / 100;
            finalWidth = `${cellPercentage}%`;
          }
          tableWidths[cellIndex] = finalWidth;
        }
      });
    });
    // determine the max height for each row
    cellsHeights.forEach((row, rIndex) => {
      row.forEach((cellHeight) => {
        const type = typeof tableHeights[rIndex];
        if (
          type === "undefined" ||
          (cellHeight !== "auto" &&
            type === "number" &&
            (cellHeight as number) > (tableHeights[rIndex] as number)) ||
          (cellHeight !== "auto" && tableHeights[rIndex] === "auto")
        ) {
          tableHeights[rIndex] = cellHeight;
        }
      });
    });
    if (tableWidths.length > 0) {
      // if 'width:100%' for the table, replace "auto" width with "*"
      table.widths = fullWidth ? tableWidths.map((w) => (w === "auto" ? "*" : w)) : tableWidths;
    }
    if (tableHeights.length > 0) table.heights = tableHeights;
  }

  /** Apply rowspan/colspan and inherited styles to a <th>/<td> node. */
  private buildTableCell(ret: PdfNode, el: HTMLElement, parents: HTMLElement[]): PdfNode {
    const rowspan = el.getAttribute("rowspan");
    if (rowspan) ret.rowSpan = Number(rowspan);
    const colspan = el.getAttribute("colspan");
    if (colspan) ret.colSpan = Number(colspan);
    return this.applyStyle({ ret, parents: parents.concat([el]) });
  }

  /**
   * Build an inline SVG node, or `null` when the SVG carries no dimensions.
   * pdfmake sizes an SVG from its `width`/`height` attributes, falling back to
   * `viewBox`; with neither it throws, so such an SVG is skipped instead.
   */
  private buildSvg(el: HTMLElement): PdfNode | null {
    const hasSize = !!el.getAttribute("width") && !!el.getAttribute("height");
    if (!hasSize && !el.getAttribute("viewBox")) {
      console.warn("html-to-pdfmake: skipping <svg> without width/height or viewBox");
      return null;
    }
    const ret: PdfNode = {
      svg: el.outerHTML.replace(/\n(\s+)?/g, ""),
      nodeName: "SVG",
    };
    if (!this.removeTagClasses) ret.style = ["html-svg"];
    return ret;
  }

  /** Render an <hr> as a canvas line, honouring data-pdfmake overrides. */
  private buildHr(ret: PdfNode, el: HTMLElement): void {
    // default style for the HR
    const styleHR: {
      width: number;
      type: string;
      margin: number[];
      thickness: number;
      color: string;
      left: number;
      [key: string]: unknown;
    } = {
      width: 514,
      type: "line",
      margin: [0, 12, 0, 12],
      thickness: 0.5,
      color: "#000000",
      left: 0,
    };
    // we can override the default HR style with "data-pdfmake"
    if (el.dataset.pdfmake) {
      const raw = el.dataset.pdfmake.replace(/'/g, '"');
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const key in parsed) styleHR[key] = parsed[key];
      } catch (e) {
        console.error(e);
      }
    }

    ret.margin = styleHR.margin;
    ret.canvas = [
      {
        type: styleHR.type,
        x1: styleHR.left,
        y1: 0,
        x2: styleHR.width,
        y2: 0,
        lineWidth: styleHR.thickness,
        lineColor: styleHR.color,
      },
    ];
    delete ret.text;
  }

  /** Build an ordered/unordered list node from its items. */
  private buildList(
    ret: PdfNode,
    el: HTMLElement,
    nodeNameLowerCase: string,
    parents: HTMLElement[],
  ): PdfNode {
    ret[nodeNameLowerCase] = ((ret.stack || ret.text) as PdfNode[]).slice(0);
    delete ret.stack;
    delete ret.text;
    // apply all the inherited classes and styles from the parents (mutates ret)
    this.applyStyle({ ret, parents: parents.concat([el]) });
    // check if we have `start`
    const start = el.getAttribute("start");
    if (start) ret.start = Number(start);
    // check if we have "type"
    switch (el.getAttribute("type")) {
      case "A":
        ret.type = "upper-alpha";
        break;
      case "a":
        ret.type = "lower-alpha";
        break;
      case "I":
        ret.type = "upper-roman";
        break;
      case "i":
        ret.type = "lower-roman";
        break;
    }
    // check if we have `list-style-type` or `list-style`
    if (ret.listStyle || ret.listStyleType) {
      ret.type = (ret.listStyle || ret.listStyleType) as string;
    }
    return ret;
  }

  /** Normalize a list item so a trailing non-text child becomes a stack. */
  private buildListItem(ret: PdfNode): PdfNode {
    // if it's a stack, then check if the last child has a "text"
    const stack = ret.stack;
    if (stack && !stack[stack.length - 1].text) {
      // restructure by moving the non-stack stuff inside a "text"
      const head = stack.slice(0, -1);
      // make sure we only have 'text' as a child, otherwise switch to a stack
      const wrap: PdfNode =
        head.filter((child) => !child.text).length > 0 ? { stack: head } : { text: head };
      return { stack: [wrap, stack[stack.length - 1]] };
    }
    return ret;
  }

  /** Build an image node, optionally storing the src by reference. */
  private buildImage(ret: PdfNode, el: HTMLElement, parents: HTMLElement[]): PdfNode {
    if (this.imagesByReference) {
      const src = el.getAttribute("data-src") || el.getAttribute("src") || "";
      const index = this.imagesRef.indexOf(src);
      if (index > -1) ret.image = `img_ref_${this.imagesByReferenceSuffix}${index}`;
      else {
        ret.image = `img_ref_${this.imagesByReferenceSuffix}${this.imagesRef.length}`;
        this.imagesRef.push(src);
      }
    } else {
      ret.image = el.getAttribute("src") ?? undefined;
    }
    delete ret.stack;
    delete ret.text;
    // apply all the inherited classes and styles from the parents
    return this.applyStyle({ ret, parents: parents.concat([el]) });
  }

  /** Apply a link (or internal destination) to an <a> node and its descendants. */
  private buildAnchor(input: PdfNode, el: HTMLElement): PdfNode {
    // the link must be applied to the deeper `text` or stacked element
    const setLink = (pointer: PdfNode | undefined, href: string): PdfNode => {
      const node: PdfNode = pointer || { text: "" }; // for link without any text
      if (Array.isArray(node.text)) {
        node.text = node.text.map((t) => setLink(t, href));
        return node;
      }
      if (Array.isArray(node.stack)) {
        // if we have a more complex layer
        node.stack = node.stack.map((s) => setLink(s, href));
        return node;
      }
      // if 'href' starts with '#' then it's an internal link
      if (href.indexOf("#") === 0) node.linkToDestination = href.slice(1);
      else node.link = href;
      return node;
    };
    const href = el.getAttribute("href");
    if (!href) return input;
    let ret = setLink(input, href);
    // reduce the complexity when only 1 text
    if (Array.isArray(ret.text) && ret.text.length === 1) ret = ret.text[0];
    ret.nodeName = "A";
    return ret;
  }

  /** Interpret <div data-pdfmake-type="columns"> as pdfmake columns. */
  private buildColumns(ret: PdfNode, el: HTMLElement, nodeName: string): void {
    if (nodeName === "DIV" && el.dataset.pdfmakeType === "columns") {
      if (ret.stack) {
        ret.columns = ret.stack;
        delete ret.stack;
      }
    }
  }

  /** Apply custom tags, property reduction, the empty-<li> fix, and data-pdfmake. */
  private finalizeNode(
    input: PdfNode,
    el: HTMLElement,
    nodeName: string,
    parents: HTMLElement[],
  ): PdfNode | string | undefined {
    let ret = input;
    if (this.customTag) {
      // handle custom tags
      const custom = this.customTag.call(this, { element: el, parents, ret });
      if (!custom) return undefined;
      if (typeof custom === "string") return custom;
      ret = Array.isArray(custom) ? { stack: custom as PdfNode[] } : (custom as PdfNode);
    }

    // reduce the number of JSON properties
    if (
      Array.isArray(ret.text) &&
      ret.text.length === 1 &&
      ret.text[0].text &&
      !ret.text[0].nodeName
    ) {
      ret.text = ret.text[0].text;
    }

    // if we are inside <LI> and the text is empty, PDFMake ignores it
    if (
      ((parents.length > 0 && parents[parents.length - 1].nodeName === "LI") ||
        nodeName === "LI") &&
      ((Array.isArray(ret.text) && ret.text.length === 0) ||
        (typeof ret.text === "string" && ret.text === ""))
    ) {
      // so we replace it with a space
      ret.text = " ";
    }

    // check if we have some data-pdfmake to apply
    if (["HR", "TABLE"].indexOf(nodeName) === -1 && el.dataset.pdfmake) {
      const raw = el.dataset.pdfmake.replace(/'/g, '"');
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const key in parsed) ret[key] = parsed[key];
      } catch (e) {
        console.error(e);
      }
    }
    return ret;
  }

  private searchForStack(ret: PdfNode): boolean {
    if (Array.isArray(ret.text)) {
      for (let i = 0; i < ret.text.length; i++) {
        const child = ret.text[i];
        if (
          child.stack ||
          [
            "P",
            "DIV",
            "TABLE",
            "SVG",
            "UL",
            "OL",
            "IMG",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
          ].indexOf(child.nodeName ?? "") > -1
        ) {
          return true;
        }
        if (this.searchForStack(child) === true) return true;
      }
    }
    return false;
  }

  /** Apply style and classes from all the parents onto `params.ret`. */
  private applyStyle(params: ApplyStyleParams): PdfNode {
    const cssClass: string[] = [];
    const lastIndex = params.parents.length - 1;
    params.parents.forEach((parent, parentIndex) => {
      // classes
      const parentNodeName = parent.nodeName.toLowerCase();
      if (!this.removeTagClasses) {
        const htmlClass = `html-${parentNodeName}`;
        if (htmlClass !== "html-body" && cssClass.indexOf(htmlClass) === -1)
          cssClass.unshift(htmlClass);
      }
      const parentClass = (parent.getAttribute("class") || "").split(" ");
      parentClass.forEach((p) => {
        if (p) cssClass.push(p);
      });
      // styles: not all the CSS properties should be inherited
      let ignoreNonDescendentProperties = parentIndex !== lastIndex;
      // 1) the default styles
      const defaults = this.defaultStyles[parentNodeName];
      if (defaults) {
        for (const style in defaults) {
          if (Object.prototype.hasOwnProperty.call(defaults, style)) {
            if (
              !ignoreNonDescendentProperties ||
              (style.indexOf("margin") === -1 && style.indexOf("border") === -1)
            ) {
              // 'decoration' can be an array
              if (style === "decoration") {
                if (!Array.isArray(params.ret[style])) params.ret[style] = [];
                const decoValue = defaults[style];
                // do not apply the same decoration twice
                if (
                  decoValue &&
                  (params.ret[style] as string[]).indexOf(decoValue as string) === -1
                ) {
                  (params.ret[style] as string[]).push(decoValue as string);
                }
              } else {
                params.ret[style] = JSON.parse(JSON.stringify(defaults[style]));
              }
            }
          }
        }
      }
      // 2) element's style. We want TD/TH to receive descendant properties from TR
      if (parentNodeName === "tr") ignoreNonDescendentProperties = false;
      const styles = this.parseStyle(parent, ignoreNonDescendentProperties);
      styles.forEach((stl) => {
        // Decorations accumulate through nested inline content in pdfmake.
        if (stl.key === "decoration") {
          const values = Array.isArray(stl.value) ? stl.value : [stl.value];
          if (values.length === 0) {
            params.ret[stl.key] = [];
          } else {
            if (!Array.isArray(params.ret[stl.key])) params.ret[stl.key] = [];
            const decorations = params.ret[stl.key] as StyleValue[];
            for (const value of values) {
              if (!decorations.includes(value)) decorations.push(value);
            }
          }
        } else if (["UL", "OL"].includes(params.ret.nodeName ?? "") && stl.key === "alignment") {
          // ignore the "alignment" for the <ol> and <ul> elements
        } else if (params.ret.margin && stl.key.indexOf("margin") === 0) {
          // change the correct index in `params.ret.margin` (left | top | right | bottom)
          const margin = params.ret.margin;
          switch (stl.key) {
            case "marginLeft":
              margin[0] = stl.value as string | number;
              break;
            case "marginTop":
              margin[1] = stl.value as string | number;
              break;
            case "marginRight":
              margin[2] = stl.value as string | number;
              break;
            case "marginBottom":
              margin[3] = stl.value as string | number;
              break;
          }
        } else {
          params.ret[stl.key] = stl.value;
        }
      });
    });
    if (cssClass.length > 0) params.ret.style = cssClass;
    return params.ret;
  }

  /** Transform a CSS style string into an array of pdfmake `{key, value}` pairs. */
  private parseStyle(element: HTMLElement, ignoreProperties: boolean): StyleProperty[] {
    const ret: StyleProperty[] = [];
    const declarations = parseCssDeclarations(element.getAttribute("style") || "");
    const attributeDimension = (value: string): string =>
      Number.isFinite(Number(value)) ? `${value}px` : value;
    const width = element.getAttribute("width");
    const height = element.getAttribute("height");
    if (height) {
      declarations.unshift({
        property: "height",
        value: attributeDimension(height),
        important: false,
      });
    }
    if (width) {
      declarations.unshift({
        property: "width",
        value: attributeDimension(width),
        important: false,
      });
    }
    // check if we have 'color' or 'size' -- mainly for '<font>'
    const color = element.getAttribute("color");
    if (color) {
      ret.push({ key: "color", value: parseColor(color).color });
    }
    const sizeAttr = element.getAttribute("size");
    if (sizeAttr !== null) {
      // sanitize the size value: it should be between 1 and 7
      const size = Math.min(Math.max(1, Number.parseInt(sizeAttr, 10)), 7);
      ret.push({ key: "fontSize", value: Math.max(this.fontSizes[0], this.fontSizes[size - 1]) });
    }

    const winners = new Map<string, { index: number; important: boolean }>();
    declarations.forEach((declaration, index) => {
      const previous = winners.get(declaration.property);
      if (!previous || declaration.important || !previous.important) {
        winners.set(declaration.property, { index, important: declaration.important });
      }
    });
    const styleDefs = declarations.filter(
      (declaration, index) => winners.get(declaration.property)?.index === index,
    );
    const borders: Array<{ key: string; value: string }> = []; // special treatment for borders
    const nodeName = element.nodeName.toUpperCase();
    styleDefs.forEach((styleDef) => {
      const key = styleDef.property;
      const value = styleDef.value.trim();
      const lowerValue = value.toLowerCase();
      if (this.ignoreStyles.indexOf(key) !== -1) return;
      switch (key) {
        case "margin": {
          if (ignoreProperties) break;
          const margin = convertBoxShorthand(value);
          if (margin) ret.push({ key: "margin", value: margin });
          break;
        }
        case "line-height": {
          let lineHeight: number | undefined;
          if (lowerValue.endsWith("%")) {
            lineHeight = Number(lowerValue.slice(0, -1)) / 100;
          } else if (Number.isFinite(Number(lowerValue))) {
            lineHeight = Number(lowerValue);
          } else {
            const absoluteLineHeight = convertToUnit(lowerValue);
            if (absoluteLineHeight !== false) lineHeight = absoluteLineHeight / 12;
          }
          if (lineHeight && lineHeight > 0 && Number.isFinite(lineHeight)) {
            ret.push({ key: "lineHeight", value: lineHeight });
          }
          break;
        }
        case "text-align": {
          if (["left", "right", "center", "justify"].includes(lowerValue)) {
            ret.push({ key: "alignment", value: lowerValue });
          }
          break;
        }
        case "font-weight": {
          const isBold = lowerValue === "bold" || lowerValue === "bolder" || Number(value) >= 700;
          ret.push({ key: "bold", value: isBold });
          break;
        }
        case "text-decoration":
        case "text-decoration-line": {
          const tokens = splitCssValues(lowerValue);
          if (tokens.includes("none")) {
            ret.push({ key: "decoration", value: [] });
            break;
          }
          const lines = tokens
            .filter((token) => token in DECORATION_LINES)
            .map((token) => DECORATION_LINES[token]);
          if (lines.length > 0) ret.push({ key: "decoration", value: lines });
          if (key === "text-decoration-line") break;
          const style = tokens.find((token) => DECORATION_STYLES.has(token));
          if (style) ret.push({ key: "decorationStyle", value: style });
          const thicknessToken = tokens.find((token) => convertToUnit(token) !== false);
          if (thicknessToken) {
            ret.push({
              key: "decorationThickness",
              value: convertToUnit(thicknessToken) as number,
            });
          }
          const colorToken = tokens.find(
            (token) =>
              !(token in DECORATION_LINES) &&
              !DECORATION_STYLES.has(token) &&
              token !== thicknessToken,
          );
          if (colorToken) {
            ret.push({ key: "decorationColor", value: parseColor(colorToken).color });
          }
          break;
        }
        case "text-decoration-style": {
          if (DECORATION_STYLES.has(lowerValue)) {
            ret.push({ key: "decorationStyle", value: lowerValue });
          }
          break;
        }
        case "text-decoration-color": {
          ret.push({ key: "decorationColor", value: parseColor(value).color });
          break;
        }
        case "text-decoration-thickness": {
          const thickness = convertToUnit(lowerValue);
          if (thickness !== false) ret.push({ key: "decorationThickness", value: thickness });
          break;
        }
        case "font-style": {
          ret.push({ key: "italics", value: lowerValue === "italic" || lowerValue === "oblique" });
          break;
        }
        case "font-family": {
          ret.push({
            key: "font",
            value: value
              .split(",")[0]
              .replace(/"|^'|^\s*|\s*$|'$/g, "")
              .replace(/^([a-z])/g, (g) => g[0].toUpperCase())
              .replace(/ ([a-z])/g, (g) => g[1].toUpperCase()),
          });
          break;
        }
        case "color": {
          const res = parseColor(value);
          ret.push({ key: "color", value: res.color });
          if (res.opacity < 1) ret.push({ key: "opacity", value: res.opacity });
          break;
        }
        case "background-color": {
          // if TH/TD then use 'fillColor' instead of 'background'
          const res = parseColor(value);
          // if the color is "transparent", we ignore it
          if (res.color.toLowerCase() !== "transparent") {
            const isCell = nodeName === "TD" || nodeName === "TH";
            ret.push({ key: isCell ? "fillColor" : "background", value: res.color });
            if (res.opacity < 1) {
              ret.push({ key: isCell ? "fillOpacity" : "opacity", value: res.opacity });
            }
          }
          break;
        }
        case "text-indent": {
          const indent = convertToUnit(lowerValue);
          if (indent !== false) ret.push({ key: "leadingIndent", value: indent });
          break;
        }
        case "white-space": {
          const preserve = ["pre", "pre-wrap", "break-spaces"].includes(lowerValue);
          ret.push({ key: "noWrap", value: lowerValue === "nowrap" || lowerValue === "pre" });
          ret.push({ key: "preserveLeadingSpaces", value: preserve });
          ret.push({ key: "preserveTrailingSpaces", value: preserve });
          break;
        }
        case "opacity": {
          const opacity = convertOpacity(lowerValue);
          if (opacity !== undefined) ret.push({ key: "opacity", value: opacity });
          break;
        }
        case "letter-spacing": {
          if (lowerValue === "normal") {
            ret.push({ key: "characterSpacing", value: 0 });
          } else {
            const spacing = convertToUnit(lowerValue);
            if (spacing !== false) ret.push({ key: "characterSpacing", value: spacing });
          }
          break;
        }
        case "word-break": {
          ret.push({
            key: "wordBreak",
            value: lowerValue === "break-all" ? "break-all" : "normal",
          });
          break;
        }
        case "overflow-wrap":
        case "word-wrap": {
          // pdfmake only supports normal line breaking or breaking between every character.
          // CSS emergency wrapping (break-word/anywhere) is not equivalent to break-all, so
          // leave it unmapped rather than splitting words that already fit their container.
          break;
        }
        case "vertical-align": {
          if (ignoreProperties) break;
          if (TABLE_CELL_NODES.has(nodeName)) {
            if (["top", "middle", "bottom"].includes(lowerValue)) {
              ret.push({ key: "verticalAlignment", value: lowerValue });
            }
          } else if (lowerValue === "sub") {
            ret.push({ key: "sub", value: true });
            ret.push({ key: "sup", value: false });
          } else if (lowerValue === "super") {
            ret.push({ key: "sup", value: true });
            ret.push({ key: "sub", value: false });
          } else if (lowerValue === "baseline") {
            ret.push({ key: "sup", value: false });
            ret.push({ key: "sub", value: false });
          }
          break;
        }
        case "margin-top":
        case "margin-right":
        case "margin-bottom":
        case "margin-left": {
          if (ignoreProperties) break;
          const margin = convertToUnit(lowerValue);
          if (margin !== false) {
            ret.push({ key: toCamelCase(key), value: margin });
          }
          break;
        }
        case "padding": {
          if (ignoreProperties || !TABLE_CELL_NODES.has(nodeName)) break;
          const padding = convertBoxShorthand(value);
          if (padding) ret.push({ key: "margin", value: padding });
          break;
        }
        case "padding-top":
        case "padding-right":
        case "padding-bottom":
        case "padding-left": {
          if (ignoreProperties || !TABLE_CELL_NODES.has(nodeName)) break;
          const padding = convertToUnit(lowerValue);
          if (padding !== false) {
            ret.push({ key: toCamelCase(key.replace("padding", "margin")), value: padding });
          }
          break;
        }
        case "width":
        case "height": {
          if (ignoreProperties) break;
          const dimension = convertDimension(value, key, nodeName);
          if (dimension !== undefined) ret.push({ key, value: dimension });
          break;
        }
        case "font-size": {
          const fontSize = convertToUnit(lowerValue);
          const keywordSize = FONT_SIZE_KEYWORDS[lowerValue];
          if (fontSize !== false) {
            ret.push({ key: "fontSize", value: fontSize });
          } else if (keywordSize !== undefined) {
            ret.push({ key: "fontSize", value: keywordSize });
          }
          break;
        }
        case "list-style":
        case "list-style-type": {
          const listType = splitCssValues(lowerValue).find(
            (token) => token !== "inside" && token !== "outside",
          );
          if (listType && !listType.startsWith("url(")) {
            ret.push({ key: "listStyleType", value: listType });
          }
          break;
        }
        case "display":
        case "visibility": {
          // Visibility affects tree construction and is never a pdfmake style.
          break;
        }
        default: {
          // Browser-only and unknown properties are ignored instead of leaking into the DDO.
          if (SUPPORTED_BORDER_PROPERTY.test(key) && !ignoreProperties) {
            borders.push({ key, value });
          }
        }
      }
    });
    // deal with the borders
    if (borders.length > 0) {
      // pdfmake supports only "border" (boolean[]) and "borderColor" (string[])
      const border: boolean[] = [];
      const borderColor: string[] = [];
      borders.forEach((b) => {
        let index = -1;
        // determine which side the property is for
        if (b.key.indexOf("-left") > -1) index = 0;
        else if (b.key.indexOf("-top") > -1) index = 1;
        else if (b.key.indexOf("-right") > -1) index = 2;
        else if (b.key.indexOf("-bottom") > -1) index = 3;

        const splitKey = b.key.split("-");
        if (splitKey.length === 1 || (splitKey.length === 2 && index >= 0)) {
          // 'border' or 'border-left|right|top|bottom': width style color
          b.value = borderValueRearrange(b.value);
          const properties = b.value.split(" ");
          const width = properties[0].replace(/(\d*)(\.\d+)?([^\d]+)/g, "$1$2 ").trim();
          // for the width
          if (index > -1) {
            border[index] = Number(width) > 0;
          } else {
            for (let i = 0; i < 4; i++) border[i] = Number(width) > 0;
          }
          // for the color
          if (properties.length > 2) {
            const color = properties.slice(2).join(" ");
            if (index > -1) {
              borderColor[index] = parseColor(color).color;
            } else {
              for (let i = 0; i < 4; i++) borderColor[i] = parseColor(color).color;
            }
          }
        } else if (index >= 0 && splitKey[2] === "color") {
          // e.g. 'border-left-color'
          borderColor[index] = parseColor(b.value).color;
        } else if (index >= 0 && splitKey[2] === "width") {
          // e.g. 'border-top-width'
          border[index] = !/^0[a-z%]*$/.test(String(b.value));
        } else if (b.key === "border-color") {
          const properties = topRightBottomLeftToObject(b.value);
          borderColor[0] = parseColor(properties.left).color;
          borderColor[1] = parseColor(properties.top).color;
          borderColor[2] = parseColor(properties.right).color;
          borderColor[3] = parseColor(properties.bottom).color;
        } else if (b.key === "border-width") {
          const properties = topRightBottomLeftToObject(b.value);
          border[0] = !/^0[a-z%]*$/.test(properties.left);
          border[1] = !/^0[a-z%]*$/.test(properties.top);
          border[2] = !/^0[a-z%]*$/.test(properties.right);
          border[3] = !/^0[a-z%]*$/.test(properties.bottom);
        }
      });
      // fill the gaps
      for (let i = 0; i < 4; i++) {
        if (border.length > 0 && typeof border[i] === "undefined") border[i] = true;
        if (borderColor.length > 0 && typeof borderColor[i] === "undefined")
          borderColor[i] = "#000000";
      }
      if (border.length > 0) ret.push({ key: "border", value: border });
      if (borderColor.length > 0) ret.push({ key: "borderColor", value: borderColor });
    }
    return ret;
  }
}
