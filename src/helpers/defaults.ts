import type { StyleValue } from "../types/internal";

/** Styles applied to a single HTML tag. Properties are removable at runtime. */
export type DefaultStyle = { [property: string]: StyleValue | undefined };

/** Map of tag name -> default styles. Tags are removable at runtime. */
export type DefaultStyles = { [tag: string]: DefaultStyle | undefined };

/**
 * Build a fresh set of the default per-tag styles. A new object is returned on
 * every call so each converter instance can mutate its own copy.
 */
export function createDefaultStyles(): DefaultStyles {
  return {
    b: { bold: true },
    strong: { bold: true },
    u: { decoration: "underline" },
    del: { decoration: "lineThrough" },
    s: { decoration: "lineThrough" },
    em: { italics: true },
    i: { italics: true },
    h1: { fontSize: 24, bold: true, marginBottom: 5 },
    h2: { fontSize: 22, bold: true, marginBottom: 5 },
    h3: { fontSize: 20, bold: true, marginBottom: 5 },
    h4: { fontSize: 18, bold: true, marginBottom: 5 },
    h5: { fontSize: 16, bold: true, marginBottom: 5 },
    h6: { fontSize: 14, bold: true, marginBottom: 5 },
    a: { color: "blue", decoration: "underline" },
    strike: { decoration: "lineThrough" },
    p: { margin: [0, 5, 0, 10] },
    ul: { marginBottom: 5, marginLeft: 5 },
    table: { marginBottom: 5 },
    th: { bold: true, fillColor: "#EEEEEE" },
  };
}
