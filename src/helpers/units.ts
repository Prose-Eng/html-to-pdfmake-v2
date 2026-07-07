// Unit/text helpers with no dependency on the converter instance.

/**
 * Convert a `px`/`rem`/`em`/`cm`/`in` value to `pt`. A bare number is returned
 * as-is; anything else (unsupported unit, keyword, ...) returns `false`.
 */
export function convertToUnit(val: string | number): number | false {
  // if it's just a number, then return it
  if (!Number.isNaN(Number.parseFloat(String(val))) && Number.isFinite(Number(val)))
    return Number(val);
  const mtch = `${val}`.trim().match(/^(-?\d*(\.\d+)?)(pt|px|r?em|cm|in)$/);
  // if we don't have a number with supported units, then return false
  if (!mtch) return false;
  let n = Number(mtch[1]);
  switch (mtch[3]) {
    case "px": {
      n = Math.round(n * 0.75292857248934); // 1px => 0.75292857248934pt
      break;
    }
    case "em":
    case "rem": {
      n *= 12; // default font-size is 12pt
      break;
    }
    case "cm": {
      n = Math.round(n * 28.34646); // 1cm => 28.34646
      break;
    }
    case "in": {
      n *= 72; // 1in => 72 pt
      break;
    }
  }
  return n;
}

/** Convert a hyphenated CSS property (e.g. `text-align`) to camelCase. */
export function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}
