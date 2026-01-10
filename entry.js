// `@expo/metro-runtime` MUST be the first import to ensure Fast Refresh works
// on web.
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

import { PlaybackService } from "@/services/playback-service";
import { registerPlaybackService } from "@/services/track-player-wrapper";

import "@expo/metro-runtime";

// This file should only import and register the root. No components or exports
// should be added here.
renderRootComponent(App);

registerPlaybackService(() => PlaybackService);
