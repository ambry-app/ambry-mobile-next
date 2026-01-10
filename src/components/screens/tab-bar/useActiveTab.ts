import { Href, useSegments } from "expo-router";

export type TabConfig = {
  name: string;
  segment: string;
  href: Href;
  icon: string;
  label: string;
};

// Detail pages hoisted from library that should keep Library tab highlighted
const LIBRARY_SEGMENTS = [
  "media",
  "book",
  "author",
  "narrator",
  "person",
  "series",
];

// Modals that should keep Settings tab highlighted
const SETTINGS_SEGMENTS = ["playback-rate", "sleep-timer"];

export const TABS: TabConfig[] = [
  {
    name: "(shelf)",
    segment: "(shelf)",
    href: "/(tabs)/(home)/(shelf)" as Href,
    icon: "book-bookmark",
    label: "My Shelf",
  },
  {
    name: "(library)",
    segment: "(library)",
    href: "/(tabs)/(home)/(library)" as Href,
    icon: "book-open",
    label: "Library",
  },
  {
    name: "(downloads)",
    segment: "(downloads)",
    href: "/downloads" as Href,
    icon: "download",
    label: "Downloads",
  },
  {
    name: "(settings)",
    segment: "(settings)",
    href: "/settings" as Href,
    icon: "gear",
    label: "Settings",
  },
];

/**
 * Hook to determine the active tab based on current route segments.
 * Handles both tab routes and hoisted detail pages.
 */
export function useActiveTab(): TabConfig | undefined {
  const segments = useSegments();

  // For tab routes: segments = ["(tabs)", "(home)", "(library)"] → segments[2] is the tab
  // For hoisted routes: segments = ["(tabs)", "media", "id"] → segments[1] is the route name
  // For root modals: segments = ["playback-rate"] → segments[0] is the route name
  const activeSegment = segments[2] || segments[1];

  const libraryTab = TABS.find((tab) => tab.name === "(library)");
  const settingsTab = TABS.find((tab) => tab.name === "(settings)");

  // Check for direct tab segment match first
  const matchedTab = TABS.find((tab) => tab.segment === activeSegment);
  if (matchedTab) return matchedTab;

  // Check for library detail pages
  if (segments[1] && LIBRARY_SEGMENTS.includes(segments[1])) {
    return libraryTab;
  }

  // Check for settings modals (root-level modals like playback-rate, sleep-timer)
  if (segments[0] && SETTINGS_SEGMENTS.includes(segments[0])) {
    return settingsTab;
  }

  // Default to first tab on initial load when segments aren't populated yet
  return TABS[0];
}
