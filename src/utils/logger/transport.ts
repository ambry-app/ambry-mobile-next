import { type transportFunctionType } from "react-native-logs";

type NamedColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "grey"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright";

// Hex color string like "#ff5500" or "#f50"
type HexColor = `#${string}`;

export type Color = NamedColor | HexColor;

export type TransportOptions = {
  colors?: Record<string, Color>;
  extensionColors?: Record<string, Color>;
};

// ANSI codes for named colors
const namedColorCodes: Record<NamedColor, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  grey: 90,
  redBright: 91,
  greenBright: 92,
  yellowBright: 93,
  blueBright: 94,
  magentaBright: 95,
  cyanBright: 96,
  whiteBright: 97,
};

// Approximate RGB values for named colors (for luminance calculation)
const namedColorRgb: Record<NamedColor, [number, number, number]> = {
  black: [0, 0, 0],
  red: [170, 0, 0],
  green: [0, 170, 0],
  yellow: [170, 170, 0],
  blue: [0, 0, 170],
  magenta: [170, 0, 170],
  cyan: [0, 170, 170],
  white: [170, 170, 170],
  grey: [85, 85, 85],
  redBright: [255, 85, 85],
  greenBright: [85, 255, 85],
  yellowBright: [255, 255, 85],
  blueBright: [85, 85, 255],
  magentaBright: [255, 85, 255],
  cyanBright: [85, 255, 255],
  whiteBright: [255, 255, 255],
};

const resetColors = "\x1b[0m";

/** Parse hex color to RGB tuple */
function parseHex(hex: string): [number, number, number] | null {
  const match = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const captured = match?.[1];
  if (!captured) return null;

  // Expand shorthand (#f50 → #ff5500)
  const hexVal =
    captured.length === 3
      ? captured
          .split("")
          .map((c) => c + c)
          .join("")
      : captured;

  const r = parseInt(hexVal.slice(0, 2), 16);
  const g = parseInt(hexVal.slice(2, 4), 16);
  const b = parseInt(hexVal.slice(4, 6), 16);
  return [r, g, b];
}

/** Calculate relative luminance (0-1, higher = brighter) */
function luminance(r: number, g: number, b: number): number {
  // sRGB to linear, then weighted sum per WCAG
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Check if a color is dark (needs light text) */
function isDark(color: Color): boolean {
  if (color.startsWith("#")) {
    const rgb = parseHex(color);
    if (rgb) return luminance(...rgb) < 0.2;
    return false;
  }
  const rgb = namedColorRgb[color as NamedColor];
  if (rgb) return luminance(...rgb) < 0.2;
  return false;
}

/** Generate foreground ANSI escape code */
function fgCode(color: Color): string | null {
  if (color.startsWith("#")) {
    const rgb = parseHex(color);
    if (rgb) return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    return null;
  }
  const code = namedColorCodes[color as NamedColor];
  if (code) return `\x1b[${code}m`;
  return null;
}

/** Generate background ANSI escape code */
function bgCode(color: Color): string | null {
  if (color.startsWith("#")) {
    const rgb = parseHex(color);
    if (rgb) return `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    return null;
  }
  const code = namedColorCodes[color as NamedColor];
  if (code) return `\x1b[${code + 10}m`; // +10 for background
  return null;
}

/**
 * Custom console transport that combines:
 * - True color support (named colors + hex codes)
 * - Proper console method mapping (debug→console.debug, warn→console.warn, etc.)
 * - Automatic contrast detection for extension tag text
 */
export const coloredConsoleTransport: transportFunctionType<
  TransportOptions
> = (props) => {
  let msg = props.msg;
  let levelColorCode: string | undefined;

  // Apply level colors
  const levelColor = props.options?.colors?.[props.level.text];
  if (levelColor) {
    const code = fgCode(levelColor);
    if (code) {
      levelColorCode = code;
      msg = `${code}${msg}${resetColors}`;
    }
  }

  // Apply extension colors (background highlight with contrasting text)
  if (props.extension && props.options?.extensionColors) {
    const extColor = props.options.extensionColors[props.extension];
    if (extColor) {
      const bg = bgCode(extColor);
      if (bg) {
        const fg = isDark(extColor) ? "\x1b[97m" : "\x1b[30m"; // white or black text
        const extStart = resetColors + bg + fg;
        const extEnd = resetColors + (levelColorCode ?? "");
        msg = msg.replace(
          props.extension,
          `${extStart} ${props.extension} ${extEnd}`,
        );
      }
    }
  }

  // Map level to console method (silly → debug since console.trace prints stack traces)
  type ConsoleMethods = "log" | "debug" | "info" | "warn" | "error";
  const levelText = props.level.text === "silly" ? "debug" : props.level.text;
  const consoleMethod: ConsoleMethods =
    levelText in console ? (levelText as ConsoleMethods) : "log";

  console[consoleMethod](msg.trim());
};
