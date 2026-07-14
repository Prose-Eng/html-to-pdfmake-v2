// CSS shorthand helpers with no dependency on the converter instance.

/** The four sides parsed from a `top right bottom left` style shorthand. */
export interface BoxSides {
  top: string;
  right: string;
  bottom: string;
  left: string;
}
/** A declaration parsed from an inline style attribute. */
export interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
}

/**
 * Split CSS text on a delimiter, while preserving delimiters inside strings,
 * comments, parentheses and brackets. This is deliberately small, but unlike
 * String.split it is safe for data URLs, rgb()/calc(), and quoted font names.
 */
function splitCss(text: string, delimiter: ";" | ":" | "whitespace"): string[] {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let comment = false;
  let depth = 0;

  const flush = (): void => {
    const value = current.trim();
    if (value) parts.push(value);
    current = "";
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index++;
      }
      continue;
    }
    if (!quote && char === "/" && next === "*") {
      comment = true;
      index++;
      continue;
    }
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[") {
      depth++;
      current += char;
      continue;
    }
    if (char === ")" || char === "]") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    const isDelimiter =
      depth === 0 &&
      ((delimiter === "whitespace" && /\s/.test(char)) ||
        (delimiter !== "whitespace" && char === delimiter));
    if (isDelimiter) {
      flush();
      if (delimiter === ":") {
        const remainder = text.slice(index + 1).trim();
        if (remainder) parts.push(remainder);
        return parts;
      }
      continue;
    }
    current += char;
  }
  flush();
  return parts;
}

/** Parse inline CSS without corrupting colon/semicolon-bearing values. */
export function parseCssDeclarations(style: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const rawDeclaration of splitCss(style, ";")) {
    const parts = splitCss(rawDeclaration, ":");
    if (parts.length !== 2) continue;
    const property = parts[0].trim().toLowerCase();
    if (!property) continue;
    const important = /\s*!important\s*$/i.test(parts[1]);
    const value = parts[1].replace(/\s*!important\s*$/i, "").trim();
    if (value) declarations.push({ property, value, important });
  }
  return declarations;
}

/** Split a CSS shorthand without splitting function arguments. */
export function splitCssValues(value: string): string[] {
  return splitCss(value, "whitespace");
}

/**
 * Expand a CSS box shorthand (1-4 values) into explicit `{top,right,bottom,left}`.
 * Functions and quoted values remain intact while the four sides are expanded.
 */
export function topRightBottomLeftToObject(props: string): BoxSides {
  const values = splitCssValues(props);
  const top = values[0] ?? "";
  let right = values[1] ?? "";
  let bottom = values[2] ?? "";
  let left = values[3] ?? "";

  switch (values.length) {
    case 1:
      right = bottom = left = top;
      break;
    case 2:
      bottom = top;
      left = right;
      break;
    case 3:
      left = right;
      break;
  }

  return { top, right, bottom, left };
}

/**
 * Rearrange a 3-part CSS border shorthand into `width style color` order
 * (e.g. `solid 10px red` -> `10px solid red`). Non 3-part values are untouched.
 */
export function borderValueRearrange(styleStr: string): string {
  try {
    const styleArray = styleStr.split(" ");
    if (styleArray.length !== 3) return styleStr;
    let v1 = "0px";
    let v2 = "none";
    let v3 = "transparent";
    const style = [
      "dotted",
      "dashed",
      "solid",
      "double",
      "groove",
      "ridge",
      "inset",
      "outset",
      "none",
      "hidden",
      "mix",
    ];
    styleArray.forEach((v) => {
      if (v.match(/^\d/)) {
        v1 = v;
      } else if (style.indexOf(v) > -1) {
        v2 = v;
      } else {
        v3 = v;
      }
    });
    return `${v1} ${v2} ${v3}`;
  } catch (_e) {
    return styleStr;
  }
}
