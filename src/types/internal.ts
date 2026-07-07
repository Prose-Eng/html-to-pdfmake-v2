// Internal types describing the pdfmake nodes this library produces. These are
// intentionally structural: the converter builds nodes by mutating an
// accumulator object, so `PdfNode` exposes the properties navigated by name and
// keeps an index signature for the dynamic style keys applied by `applyStyle`.

/** A value produced by parsing a single CSS declaration. */
export type StyleValue = string | number | boolean | Array<string | number | boolean>;

/** One `{ key, value }` pair returned by `parseStyle`. */
export interface StyleProperty {
  key: string;
  value: StyleValue;
}

/** A single vector primitive inside a `canvas` node (used for `<hr>`). */
export interface PdfCanvasElement {
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lineWidth: number;
  lineColor: string;
}

/** Offset/size wrapper used for `<sub>` and `<sup>`. */
export interface PdfScript {
  offset: string;
  fontSize: number;
}

/** The `table` object of a pdfmake table node. */
export interface PdfTable {
  body: PdfNode[][];
  widths?: Array<string | number>;
  heights?: Array<string | number>;
  [key: string]: unknown;
}

/**
 * A pdfmake content node as built by the converter. Named properties cover the
 * shapes navigated explicitly; the index signature covers the arbitrary style
 * keys assigned dynamically (e.g. `alignment`, `bold`, `fillColor`, ...).
 */
export interface PdfNode {
  text?: string | PdfNode[];
  stack?: PdfNode[];
  columns?: PdfNode[];
  ul?: PdfNode[];
  ol?: PdfNode[];
  table?: PdfTable;
  layout?: unknown;
  image?: string;
  svg?: string;
  canvas?: PdfCanvasElement[];
  nodeName?: string;
  id?: string;
  style?: string[];
  decoration?: string | string[];
  margin?: Array<string | number>;
  colSpan?: number;
  rowSpan?: number;
  width?: string | number;
  height?: string | number;
  link?: string;
  linkToDestination?: string;
  start?: number;
  type?: string;
  listStyle?: string;
  listStyleType?: string;
  preserveLeadingSpaces?: boolean;
  sub?: PdfScript;
  sup?: PdfScript;
  [key: string]: unknown;
}
