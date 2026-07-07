/**
  To use it:
  import htmlToPdfmake from '@prose-eng/html-to-pdfmake'
  htmlToPdfmake('<b>my bold text</b>');
*/
import { HtmlToPdfMake } from "./converter";
import type { Content, HtmlToPdfmakeOptions, ImagesByReferenceResult } from "./types/public";

/**
 * Transform HTML into a pdfmake-compatible content object.
 * @param htmlText The HTML to convert.
 * @param options  Optional configuration (see {@link HtmlToPdfmakeOptions}).
 * @returns A pdfmake content node, or `{ content, images }` when `imagesByReference` is set.
 */
function htmlToPdfmake(
  htmlText: string,
  options?: HtmlToPdfmakeOptions,
): Content | ImagesByReferenceResult {
  return new HtmlToPdfMake(options).convert(htmlText);
}

export default htmlToPdfmake;
export { htmlToPdfmake, HtmlToPdfMake };
export type {
  Content,
  CustomTagParams,
  HtmlToPdfmakeOptions,
  ImagesByReferenceResult,
  PdfNode,
} from "./types/public";
