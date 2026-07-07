// CSS shorthand helpers with no dependency on the converter instance.

/** The four sides parsed from a `top right bottom left` style shorthand. */
export interface BoxSides {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

/**
 * Expand a CSS box shorthand (1-4 values) into explicit `{top,right,bottom,left}`.
 * Values are matched as colors (hex/rgb/hsl/name), matching the border-color use.
 */
export function topRightBottomLeftToObject(props: string): BoxSides {
  // regexp to capture the colors (hex, rgb, rgba, hsl, hsla, color name)
  const colorRegex = /#[0-9a-fA-F]{3,6}|\b(?:rgba?|hsla?)\([^)]*\)|\b[a-zA-Z]+\b/g;
  const colors: string[] = props.match(colorRegex) || [];

  const top = colors[0] ?? "";
  let right = colors[1] ?? "";
  let bottom = colors[2] ?? "";
  let left = colors[3] ?? "";

  switch (colors.length) {
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
