import { HtmlToPdfMake } from "./converter";
import type {
  Content,
  ConversionWarning,
  CssMedia,
  HtmlToPdfmakeDocumentOptions,
  HtmlToPdfmakeDocumentResult,
  ImagesByReferenceResult,
} from "./types/public";

const INHERITED_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "text-align",
  "text-decoration",
  "text-indent",
  "visibility",
  "white-space",
]);

const SUPPORTED_PROPERTIES = new Set([
  "background-color",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "color",
  "display",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "line-height",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "opacity",
  "text-align",
  "text-decoration",
  "text-indent",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
]);

const PROPERTY_EXPANSIONS: Record<string, string[]> = {
  background: ["background-color"],
  border: [
    "border-top-color",
    "border-top-style",
    "border-top-width",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-bottom-color",
    "border-bottom-style",
    "border-bottom-width",
    "border-left-color",
    "border-left-style",
    "border-left-width",
  ],
  "border-bottom": ["border-bottom-color", "border-bottom-style", "border-bottom-width"],
  "border-color": [
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
  ],
  "border-left": ["border-left-color", "border-left-style", "border-left-width"],
  "border-right": ["border-right-color", "border-right-style", "border-right-width"],
  "border-style": [
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
  ],
  "border-top": ["border-top-color", "border-top-style", "border-top-width"],
  "border-width": [
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
  ],
  font: ["font-family", "font-size", "font-style", "font-weight", "line-height"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
};

interface ConversionFrame {
  document: Document;
  view: Window & typeof globalThis;
  dispose: () => void;
}

interface ElementStylePlan {
  element: HTMLElement;
  properties: Map<string, string>;
}

interface ImportantCandidate {
  order: number;
  specificity: number;
  value: string;
}

function mediaMatches(mediaText: string | null | undefined, target: CssMedia): boolean {
  if (!mediaText?.trim()) return true;
  return mediaText.split(",").some((query) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || normalized === "all") return true;
    if (normalized.startsWith("not ")) return !normalized.slice(4).includes(target);
    return normalized === target || normalized.startsWith(`${target} `);
  });
}

function resolveHref(href: string, baseUrl?: string): string {
  if (!baseUrl) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function createConversionFrame(
  wndw: Window & typeof globalThis,
  contentWidth: number | string,
): ConversionFrame | undefined {
  const hostDocument = wndw.document;
  const host = hostDocument.body ?? hostDocument.documentElement;
  if (!host) return undefined;

  const frame = hostDocument.createElement("iframe");
  const width = typeof contentWidth === "number" ? `${contentWidth}px` : contentWidth;
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    `width:${width}`,
    "height:1px",
    "visibility:hidden",
    "border:0",
  ].join(";");
  host.append(frame);

  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow as (Window & typeof globalThis) | null;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    return undefined;
  }
  frameDocument.open();
  frameDocument.write("<!doctype html><html><head></head><body></body></html>");
  frameDocument.close();
  frameDocument.documentElement.style.width = width;
  frameDocument.body.style.cssText = `margin:0;width:${width}`;

  return {
    document: frameDocument,
    view: frameWindow,
    dispose: () => frame.remove(),
  };
}

function stripCssImports(cssText: string, warnings: ConversionWarning[]): string {
  return cssText.replace(/@import\s+(?:url\()?[^;]+;/gi, (rule) => {
    warnings.push({
      code: "unsupported-css-import",
      message: `CSS @import is not fetched automatically: ${rule.trim()}`,
    });
    return "";
  });
}

function serializeRules(rules: CSSRuleList, media: CssMedia): string {
  const serialized: string[] = [];
  for (const rule of Array.from(rules)) {
    if (rule.type === 3) continue;
    if (rule.type === 4) {
      const mediaRule = rule as CSSMediaRule;
      if (mediaMatches(mediaRule.conditionText, media)) {
        serialized.push(serializeRules(mediaRule.cssRules, media));
      }
      continue;
    }
    serialized.push(rule.cssText);
  }
  return serialized.join("\n");
}

function installStylesheet(
  document: Document,
  cssText: string,
  media: CssMedia,
  warnings: ConversionWarning[],
): void {
  const style = document.createElement("style");
  style.textContent = stripCssImports(cssText, warnings);
  document.head.append(style);
  try {
    const rules = style.sheet?.cssRules;
    if (!rules) {
      warnings.push({ code: "invalid-stylesheet", message: "A stylesheet could not be parsed." });
      style.remove();
      return;
    }
    style.textContent = serializeRules(rules, media);
  } catch (error) {
    warnings.push({
      code: "invalid-stylesheet",
      message: `A stylesheet could not be read through CSSOM: ${String(error)}`,
    });
    style.remove();
  }
}

function collectStyleRules(document: Document): CSSStyleRule[] {
  const collected: CSSStyleRule[] = [];
  const visit = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule.type === 1) collected.push(rule as CSSStyleRule);
      else if ("cssRules" in rule) visit((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // All installed sheets are same-origin style elements. Ignore a hostile DOM implementation.
    }
  }
  return collected;
}

function expandProperty(property: string): string[] {
  const normalized = property.toLowerCase();
  return PROPERTY_EXPANSIONS[normalized] ?? [normalized];
}

function authoredProperties(element: HTMLElement, rules: CSSStyleRule[]): Set<string> {
  const properties = new Set<string>();
  for (const rule of rules) {
    try {
      if (!element.matches(rule.selectorText)) continue;
    } catch {
      continue;
    }
    for (const property of Array.from(rule.style)) {
      for (const expanded of expandProperty(property)) properties.add(expanded);
    }
  }
  for (const property of Array.from(element.style)) {
    for (const expanded of expandProperty(property)) properties.add(expanded);
  }
  return properties;
}

function splitSelectorList(selectorText: string): string[] {
  const selectors: string[] = [];
  let current = "";
  let depth = 0;
  for (const character of selectorText) {
    if (character === "(" || character === "[") depth++;
    else if (character === ")" || character === "]") depth--;
    if (character === "," && depth === 0) {
      selectors.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

function selectorSpecificity(selector: string): number {
  const withoutWhere = selector.replace(/:where\([^)]*\)/g, "");
  const ids = withoutWhere.match(/#[\w-]+/g)?.length ?? 0;
  const classes =
    withoutWhere.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g)?.length ?? 0;
  const elements =
    withoutWhere
      .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, " ")
      .match(/(?:^|[\s>+~])(?:[a-z][\w-]*|\*)/gi)
      ?.filter((token) => !token.includes("*")).length ?? 0;
  return ids * 1_000_000 + classes * 1_000 + elements;
}

function expandedDeclarationValues(
  property: string,
  value: string,
  document: Document,
): Map<string, string> {
  const expanded = expandProperty(property);
  if (expanded.length === 1) return new Map([[expanded[0], value]]);
  const probe = document.createElement("div");
  probe.style.setProperty(property, value);
  return new Map(
    expanded.map((longhand) => [longhand, probe.style.getPropertyValue(longhand) || value]),
  );
}

function importantProperties(element: HTMLElement, rules: CSSStyleRule[]): Map<string, string> {
  const candidates = new Map<string, ImportantCandidate>();
  const consider = (property: string, value: string, specificity: number, order: number): void => {
    const current = candidates.get(property);
    if (
      !current ||
      specificity > current.specificity ||
      (specificity === current.specificity && order >= current.order)
    ) {
      candidates.set(property, { order, specificity, value });
    }
  };

  rules.forEach((rule, order) => {
    const matchingSpecificities = splitSelectorList(rule.selectorText)
      .filter((selector) => {
        try {
          return element.matches(selector);
        } catch {
          return false;
        }
      })
      .map(selectorSpecificity);
    if (matchingSpecificities.length === 0) return;
    const specificity = Math.max(...matchingSpecificities);
    for (const property of Array.from(rule.style)) {
      if (rule.style.getPropertyPriority(property) !== "important") continue;
      const value = rule.style.getPropertyValue(property);
      for (const [expanded, expandedValue] of expandedDeclarationValues(
        property,
        value,
        element.ownerDocument,
      )) {
        consider(expanded, expandedValue, specificity, order);
      }
    }
  });

  for (const property of Array.from(element.style)) {
    if (element.style.getPropertyPriority(property) !== "important") continue;
    const value = element.style.getPropertyValue(property);
    for (const [expanded, expandedValue] of expandedDeclarationValues(
      property,
      value,
      element.ownerDocument,
    )) {
      consider(expanded, expandedValue, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }
  }
  return new Map(Array.from(candidates, ([property, candidate]) => [property, candidate.value]));
}

function customPropertyValue(
  element: HTMLElement,
  property: string,
  view: Window & typeof globalThis,
): string {
  let cursor: HTMLElement | null = element;
  while (cursor) {
    const value = view.getComputedStyle(cursor).getPropertyValue(property).trim();
    if (value) return value;
    cursor = cursor.parentElement;
  }
  return "";
}

function resolveVariables(
  value: string,
  element: HTMLElement,
  view: Window & typeof globalThis,
  depth = 0,
): string {
  if (depth > 12 || !value.includes("var(")) return value;
  const replaced = value.replace(
    /var\(\s*(--[\w-]+)(?:\s*,\s*([^()]*))?\s*\)/g,
    (_match, property: string, fallback?: string) =>
      customPropertyValue(element, property, view) || fallback?.trim() || "",
  );
  return replaced === value ? replaced : resolveVariables(replaced, element, view, depth + 1);
}

interface CssNumber {
  number: number;
  unit: string;
}

function parseCssNumber(value: string): CssNumber | undefined {
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px|pt|r?em|cm|mm|in|%)?$/i);
  if (!match) return undefined;
  return { number: Number(match[1]), unit: (match[2] ?? "").toLowerCase() };
}

function toPixels(value: CssNumber, contentWidth: number): number | undefined {
  switch (value.unit) {
    case "":
    case "px":
      return value.number;
    case "pt":
      return (value.number * 96) / 72;
    case "em":
    case "rem":
      return value.number * 16;
    case "cm":
      return (value.number * 96) / 2.54;
    case "mm":
      return (value.number * 96) / 25.4;
    case "in":
      return value.number * 96;
    case "%":
      return (value.number * contentWidth) / 100;
    default:
      return undefined;
  }
}

function formatCssNumber(value: CssNumber): string {
  const rounded = Math.round(value.number * 10000) / 10000;
  return `${rounded}${value.unit}`;
}

function evaluateExpression(expression: string, contentWidth: number): string | undefined {
  const operand = "(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:px|pt|r?em|cm|mm|in|%)?)";
  let result = expression.trim();
  const product = new RegExp(`${operand}\\s*([*/])\\s*${operand}`, "i");
  const sum = new RegExp(`${operand}\\s+([+-])\\s+${operand}`, "i");

  for (let pass = 0; pass < 20; pass++) {
    const productMatch = result.match(product);
    if (!productMatch) break;
    const left = parseCssNumber(productMatch[1]);
    const right = parseCssNumber(productMatch[3]);
    if (!left || !right) return undefined;
    let next: CssNumber | undefined;
    if (productMatch[2] === "*" && !left.unit) {
      next = { number: left.number * right.number, unit: right.unit };
    } else if (productMatch[2] === "*" && !right.unit) {
      next = { number: left.number * right.number, unit: left.unit };
    } else if (productMatch[2] === "/" && !right.unit && right.number !== 0) {
      next = { number: left.number / right.number, unit: left.unit };
    }
    if (!next) return undefined;
    result = result.replace(productMatch[0], formatCssNumber(next));
  }

  for (let pass = 0; pass < 20; pass++) {
    const sumMatch = result.match(sum);
    if (!sumMatch) break;
    const left = parseCssNumber(sumMatch[1]);
    const right = parseCssNumber(sumMatch[3]);
    if (!left || !right) return undefined;
    const leftPixels = toPixels(left, contentWidth);
    const rightPixels = toPixels(right, contentWidth);
    if (leftPixels === undefined || rightPixels === undefined) return undefined;
    const number = sumMatch[2] === "+" ? leftPixels + rightPixels : leftPixels - rightPixels;
    result = result.replace(sumMatch[0], formatCssNumber({ number, unit: "px" }));
  }
  return parseCssNumber(result) ? result : undefined;
}

function resolveCalculations(value: string, contentWidth: number): string {
  let resolved = value;
  for (let pass = 0; pass < 12 && resolved.includes("calc("); pass++) {
    let changed = false;
    resolved = resolved.replace(/calc\(([^()]*)\)/g, (match, expression: string) => {
      const evaluated = evaluateExpression(expression, contentWidth);
      if (!evaluated) return match;
      changed = true;
      return evaluated;
    });
    if (!changed) break;
  }
  return resolved;
}

function makeStylePlans(
  document: Document,
  view: Window & typeof globalThis,
  contentWidth: number,
): { plans: ElementStylePlan[]; fonts: Set<string> } {
  const rules = collectStyleRules(document);
  const plans: ElementStylePlan[] = [];
  const fonts = new Set<string>();

  const visit = (
    element: HTMLElement,
    inherited: Set<string>,
    inheritedValues: Map<string, string>,
  ): void => {
    const local = authoredProperties(element, rules);
    const active = new Set(local);
    for (const property of inherited) active.add(property);
    const important = importantProperties(element, rules);
    const computed = view.getComputedStyle(element);
    const properties = new Map<string, string>();
    for (const property of active) {
      if (!SUPPORTED_PROPERTIES.has(property)) continue;
      let value = important.get(property) ?? "";
      if (!value && !local.has(property)) value = inheritedValues.get(property) ?? "";
      if (!value) value = computed.getPropertyValue(property).trim();
      if (!value) value = element.style.getPropertyValue(property).trim();
      value = resolveCalculations(resolveVariables(value, element, view), contentWidth);
      if (!value) continue;
      properties.set(property, value);
      if (property === "font-family") {
        const family = value
          .split(",")[0]
          ?.trim()
          .replace(/^['"]|['"]$/g, "");
        if (family) fonts.add(family);
      }
    }
    plans.push({ element, properties });

    const childInherited = new Set(
      Array.from(active).filter((property) => INHERITED_PROPERTIES.has(property)),
    );
    const childInheritedValues = new Map(
      Array.from(properties).filter(([property]) => INHERITED_PROPERTIES.has(property)),
    );
    for (const child of Array.from(element.children)) {
      visit(child as HTMLElement, childInherited, childInheritedValues);
    }
  };

  visit(document.body, new Set(), new Map());
  return { plans, fonts };
}

function applyStylePlans(plans: ElementStylePlan[]): void {
  for (const { element, properties } of plans) {
    const serialized = Array.from(properties, ([property, value]) => `${property}:${value}`).join(
      ";",
    );
    if (serialized) element.setAttribute("style", serialized);
    else element.removeAttribute("style");
  }
}

async function resolveLinkedStylesheets(
  source: Document,
  options: HtmlToPdfmakeDocumentOptions,
  warnings: ConversionWarning[],
): Promise<void> {
  for (const link of Array.from(source.querySelectorAll('link[rel~="stylesheet"]'))) {
    const href = link.getAttribute("href") ?? "";
    const media = link.getAttribute("media") ?? undefined;
    if (!mediaMatches(media, options.media ?? "screen")) {
      link.remove();
      continue;
    }
    if (!options.resolveStylesheet) {
      warnings.push({
        code: "stylesheet-resolver-missing",
        href,
        message: `No resolver was supplied for stylesheet: ${href}`,
      });
      link.remove();
      continue;
    }
    const resolvedHref = resolveHref(href, options.baseUrl);
    try {
      const css = await options.resolveStylesheet(resolvedHref, { href, resolvedHref, media });
      if (css === undefined) {
        warnings.push({
          code: "stylesheet-unresolved",
          href: resolvedHref,
          message: `The stylesheet resolver returned no CSS for: ${resolvedHref}`,
        });
        link.remove();
        continue;
      }
      const style = source.createElement("style");
      style.textContent = css;
      link.replaceWith(style);
    } catch (error) {
      warnings.push({
        code: "stylesheet-load-failed",
        href: resolvedHref,
        message: `The stylesheet resolver failed for ${resolvedHref}: ${String(error)}`,
      });
      link.remove();
    }
  }
}

/**
 * Convert a complete HTML document after resolving its author CSS cascade.
 *
 * The CSS work happens in a temporary same-origin iframe owned by the supplied
 * `window`. Linked stylesheets are only loaded through `resolveStylesheet`.
 * The existing synchronous `htmlToPdfmake` API is unchanged.
 */
export async function convertDocument(
  htmlText: string,
  options: HtmlToPdfmakeDocumentOptions = {},
): Promise<HtmlToPdfmakeDocumentResult> {
  const wndw = (options.window ?? window) as Window & typeof globalThis;
  const warnings: ConversionWarning[] = [];
  const parser = new wndw.DOMParser();
  const source = parser.parseFromString(htmlText, "text/html");
  source.querySelectorAll("script,noscript").forEach((element) => element.remove());
  await resolveLinkedStylesheets(source, options, warnings);

  const extraCss = Array.isArray(options.cssText) ? options.cssText : [options.cssText];
  for (const cssText of extraCss) {
    if (!cssText) continue;
    const style = source.createElement("style");
    style.textContent = cssText;
    source.head.append(style);
  }

  const widthOption = options.contentWidth ?? 794;
  const numericWidth =
    typeof widthOption === "number" ? widthOption : Number.parseFloat(widthOption);
  const contentWidth = Number.isFinite(numericWidth) ? numericWidth : 794;
  const frame = createConversionFrame(wndw, widthOption);
  if (!frame) {
    warnings.push({
      code: "cssom-unavailable",
      message:
        "An isolated CSSOM document could not be created; only inline styles were converted.",
    });
    const fallback = new HtmlToPdfMake(options).convert(source.body.innerHTML);
    const referenced = fallback as ImagesByReferenceResult;
    return {
      content: options.imagesByReference ? referenced.content : (fallback as Content),
      styles: {},
      images: options.imagesByReference ? referenced.images : undefined,
      requiredFonts: [],
      warnings,
    };
  }

  try {
    for (const style of Array.from(source.querySelectorAll("style"))) {
      if (mediaMatches(style.getAttribute("media"), options.media ?? "screen")) {
        installStylesheet(
          frame.document,
          style.textContent ?? "",
          options.media ?? "screen",
          warnings,
        );
      }
      style.remove();
    }
    source.querySelectorAll('link[rel~="stylesheet"]').forEach((link) => link.remove());
    frame.document.body.innerHTML = source.body.innerHTML;

    const { plans, fonts } = makeStylePlans(frame.document, frame.view, contentWidth);
    applyStylePlans(plans);
    const converted = new HtmlToPdfMake({ ...options, window: frame.view }).convert(
      frame.document.body.innerHTML,
    );
    const referenced = converted as ImagesByReferenceResult;
    return {
      content: options.imagesByReference ? referenced.content : (converted as Content),
      styles: {},
      images: options.imagesByReference ? referenced.images : undefined,
      requiredFonts: Array.from(fonts).sort(),
      warnings,
    };
  } finally {
    frame.dispose();
  }
}
