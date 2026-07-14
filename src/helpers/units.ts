// Unit/text helpers with no dependency on the converter instance.

/**
 * Convert a CSS length to points. Supports px, pt, em/rem, cm, mm, quarter-mm,
 * inches, and picas. Relative em/rem units use `relativeTo` (12pt by default).
 * Bare numbers are returned as-is and unsupported values return `false`.
 */
export function convertToUnit(val: string | number, relativeTo = 12): number | false {
  // if it's just a number, then return it
  if (!Number.isNaN(Number.parseFloat(String(val))) && Number.isFinite(Number(val)))
    return Number(val);
  const mtch = `${val}`.trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(pt|px|r?em|cm|mm|q|in|pc)$/i);
  // if we don't have a number with supported units, then return false
  if (!mtch) return false;
  let n = Number(mtch[1]);
  switch (mtch[2].toLowerCase()) {
    case "px": {
      n = Math.round(n * 0.75292857248934); // 1px => 0.75292857248934pt
      break;
    }
    case "em":
    case "rem": {
      n *= relativeTo;
      break;
    }
    case "cm": {
      n = Math.round(n * 28.34646); // 1cm => 28.34646
      break;
    }
    case "mm": {
      n = Math.round(n * 2.834646);
      break;
    }
    case "q": {
      n = Math.round(n * 0.7086615); // quarter-millimetre
      break;
    }
    case "in": {
      n *= 72; // 1in => 72 pt
      break;
    }
    case "pc": {
      n *= 12; // 1pc => 12pt
      break;
    }
  }
  return n;
}

/** Convert a hyphenated CSS property (e.g. `text-align`) to camelCase. */
export function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}
