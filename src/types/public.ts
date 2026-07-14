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

/** Media context used while resolving the author stylesheet cascade. */
export type CssMedia = "screen" | "print";

/** Details supplied to an injected linked-stylesheet resolver. */
export interface StylesheetResolverContext {
  /** The href exactly as it appeared in the HTML. */
  href: string;
  /** The href resolved against `baseUrl`, when one was supplied. */
  resolvedHref: string;
  /** The media attribute from the link element, if present. */
  media?: string;
}

/**
 * Resolve a linked stylesheet to CSS text. Returning `undefined` leaves the
 * stylesheet unresolved and records a warning. The converter never fetches
 * stylesheet URLs itself.
 */
export type StylesheetResolver = (
  href: string,
  context: StylesheetResolverContext,
) => string | undefined | Promise<string | undefined>;

/** Options for the asynchronous, stylesheet-aware document conversion API. */
export interface HtmlToPdfmakeDocumentOptions extends HtmlToPdfmakeOptions {
  /** Additional author CSS applied after stylesheets found in the HTML. */
  cssText?: string | string[];
  /** Explicit resolver for `<link rel="stylesheet">` resources. */
  resolveStylesheet?: StylesheetResolver;
  /** Base URL used to resolve relative linked-stylesheet hrefs. */
  baseUrl?: string;
  /** CSS media context. `screen` is the default. */
  media?: CssMedia;
  /** Width of the isolated CSS viewport. Numeric values are CSS pixels. */
  contentWidth?: number | string;
}

/** A non-fatal issue encountered while preparing or applying stylesheets. */
export interface ConversionWarning {
  code:
    | "cssom-unavailable"
    | "invalid-stylesheet"
    | "stylesheet-load-failed"
    | "stylesheet-resolver-missing"
    | "stylesheet-unresolved"
    | "unsupported-css-import";
  message: string;
  href?: string;
}

/** Result of converting a complete styled HTML document. */
export interface HtmlToPdfmakeDocumentResult {
  content: Content;
  /** Reserved for reusable pdfmake styles; computed CSS is currently flattened. */
  styles: Record<string, Record<string, unknown>>;
  /** Image references when `imagesByReference` is enabled. */
  images?: Record<string, string>;
  /** Font-family names used by the converted content. */
  requiredFonts: string[];
  warnings: ConversionWarning[];
}

export type { PdfNode } from "./internal";
