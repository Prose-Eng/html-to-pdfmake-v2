// Color parsing helpers with no dependency on the converter instance.

/** The result of parsing a CSS color: a pdfmake-friendly color plus opacity. */
export interface ParsedColor {
  color: string;
  opacity: number;
}

// input: h in [0,360] and s,l in [0,1] - output: "rgb(0-255,0-255,0-255)"
// source: https://stackoverflow.com/a/54014428/1134119
function hsl2rgb(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.min(Math.floor((l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 256), 255);
  };
  return `rgb(${f(0)},${f(8)},${f(4)})`;
}

/**
 * Return the color as a hex value where possible (also converting rgb()/hsl()),
 * along with its opacity. Unknown values are returned unchanged.
 */
export function parseColor(color: string): ParsedColor {
  let opacity = 1;
  let parsed = color; // working copy (an hsl() value is converted to rgb() below)
  // e.g. `#fff` or `#ff0048`
  const hexRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  // e.g. rgb(0,255,34) or rgb(100%, 100%, 100%) or rgba(0,125,250,0.8)
  const rgbRegex =
    /^rgba?\(\s*(\d+(\.\d+)?%?),\s*(\d+(\.\d+)?%?),\s*(\d+(\.\d+)?%?)(,\s*\d+(\.\d+)?)?\)$/i;
  // e.g. hsl(300, 10%, 20%)
  const hslRegex = /^hsl\((\d+(\.\d+)?%?),\s*(\d+(\.\d+)?%?),\s*(\d+(\.\d+)?%?)\)$/i;
  // e.g. "white" or "red"
  const nameRegex = /^[a-z]+$/i;

  if (hexRegex.test(parsed)) {
    return { color: parsed.toLowerCase(), opacity };
  }

  if (hslRegex.test(parsed)) {
    // we want to convert to RGB
    const decimalColors = (hslRegex.exec(parsed) as RegExpExecArray).slice(1);
    // first value should be from 0 to 360
    const h = decimalColors[0].endsWith("%")
      ? (Number(decimalColors[0].slice(0, -1)) * 360) / 100
      : Number(decimalColors[0]);
    // next values should be % to convert to base 1
    const s = Number(decimalColors[2].slice(0, -1)) / 100;
    const l = Number(decimalColors[4].slice(0, -1)) / 100;
    parsed = hsl2rgb(h, s, l);
  }

  if (rgbRegex.test(parsed)) {
    const parts = (rgbRegex.exec(parsed) as RegExpExecArray)
      .slice(1)
      .filter((v, i) => i % 2 === 0 && typeof v !== "undefined");
    const hex: string[] = [];
    parts.forEach((part, i) => {
      // for the alpha number
      if (i === 3) {
        opacity = Number(part.slice(1));
      } else {
        // if it ends with '%', we calculate based on 100%=255
        let value = part.endsWith("%")
          ? Math.round((Number(part.slice(0, -1)) * 255) / 100)
          : Number(part);
        if (value > 255) value = 255;
        hex.push(`0${value.toString(16)}`.slice(-2));
      }
    });
    return { color: `#${hex.join("")}`, opacity };
  }

  if (nameRegex.test(parsed)) return { color: parsed.toLowerCase(), opacity };

  console.error(`Could not parse color "${parsed}"`);
  return { color: parsed, opacity };
}
