export const black = "#000";
export const white = "#fff";
export const transparent = "transparent";

export const zinc = {
  "50": "#fafafa",
  "100": "#f4f4f5",
  "200": "#e4e4e7",
  "300": "#d4d4d8",
  "400": "#a1a1aa",
  "500": "#71717a",
  "600": "#52525b",
  "700": "#3f3f46",
  "800": "#27272a",
  "900": "#18181b",
  "950": "#09090b",
};

export const lime = {
  "50": "#f7fee7",
  "100": "#ecfccb",
  "200": "#d9f99d",
  "300": "#bef264",
  "400": "#a3e635",
  "500": "#84cc16",
  "600": "#65a30d",
  "700": "#4d7c0f",
  "800": "#3f6212",
  "900": "#365314",
  "950": "#1a2e05",
};

export const red = {
  "50": "#fef2f2",
  "100": "#fee2e2",
  "200": "#fecaca",
  "300": "#fca5a5",
  "400": "#f87171",
  "500": "#ef4444",
  "600": "#dc2626",
  "700": "#b91c1c",
  "800": "#991b1b",
  "900": "#7f1d1d",
  "950": "#450a0a",
};

export const Colors = {
  black,
  white,
  transparent,
  zinc,
  lime,
  red,
};

/**
 * Surface color hierarchy for layered UI elements.
 * Lighter colors = more elevated (closer to user).
 *
 * Change these values to experiment with different color schemes.
 * All surface usages throughout the app reference these tokens.
 */
export const surface = {
  /** Page backgrounds, ScrollViews - the lowest layer */
  base: black,
  /** Cards, list items, grouped content sitting on the base */
  card: zinc[950],
  /** Fixed floating UI: tab bar, mini-player */
  elevated: zinc[900],
  /** Modals, sheets, context menus - same as elevated, differentiated by context */
  overlay: zinc[900],
};

/**
 * Interactive element colors (buttons, inputs).
 * These work across all surface levels.
 */
export const interactive = {
  /** A more subtle button/input background */
  fillSubtle: zinc[900],
  /** Default button/input background (tertiary actions, cancel buttons) */
  fill: zinc[800],
  /** More prominent button background (secondary actions) */
  fillProminent: zinc[700],
  /** Selected/active state (e.g., active playback rate) */
  selected: zinc[100],
};

/**
 * Decorative element colors.
 */
export const decorative = {
  /** Dividers, separators between content */
  divider: zinc[700],
  /** Progress bar tracks, slider backgrounds */
  track: zinc[700],
  /** Drag handles, modal grab indicators */
  handle: zinc[500],
  /** Image placeholders while loading */
  placeholder: zinc[800],
};
