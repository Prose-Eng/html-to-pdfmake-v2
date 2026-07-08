/**
 * Public type definitions for @prose-eng/html-to-pdfmake.
 */
import type { PdfNode } from "./internal";

/** A pdfmake-compatible content value: a node, an array of nodes, or plain text. */
export type Content = PdfNode | PdfNode[] | string;

/** Argument passed to the `customTag` callback. */
export interface CustomTagParams {
  /** The DOM element being converted. */
  element: HTMLElement;
  /** The chain of ancestor elements, nearest last. */
  parents: HTMLElement[];
  /** The pdfmake node produced so far for this element. */
  ret: Content;
}

export interface HtmlToPdfmakeOptions {
  /**
   * The `window` object. Required when running server-side (e.g. Node/Bun with
   * jsdom); in the browser it defaults to the global `window`.
   */
  window?: Window;
  /** Use width/height defined in styles for a table's cells and rows. */
  tableAutoSize?: boolean;
  /** Return `{ content, images }` so `<img>` tags are handled by reference. */
  imagesByReference?: boolean;
  /** Remove extra blank lines that some HTML can introduce. */
  removeExtraBlanks?: boolean;
  /** Render elements with `display:none` instead of skipping them. */
  showHidden?: boolean;
  /** Do not add the `html-TAG` class to each produced node. */
  removeTagClasses?: boolean;
  /** Style properties to ignore while parsing. */
  ignoreStyles?: string[];
  /** Font sizes (pt) mapped to the `size` attribute on `<font>` elements. */
  fontSizes?: number[];
  /** Override the default styles applied per HTML element; `null` disables one. */
  defaultStyles?: Record<string, Record<string, unknown> | null>;
  /** Handle non-regular HTML tags. Return a pdfmake node or a falsy value. */
  customTag?: (params: CustomTagParams) => Content;
  /** Transform text nodes before they are added to the document. */
  replaceText?: (text: string, parents: HTMLElement[]) => string;
}

/** Shape returned when `imagesByReference` is enabled. */
export interface ImagesByReferenceResult {
  content: Content;
  images: Record<string, string>;
}

export type { PdfNode } from "./internal";
