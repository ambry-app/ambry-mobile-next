// `@expo/metro-runtime` MUST be the first import to ensure Fast Refresh works
// on web.
import "@expo/metro-runtime";

import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

import TrackPlayer from "react-native-track-player";
import { PlaybackService } from "@/src/services/playback-service";

// This file should only import and register the root. No components or exports
// should be added here.
renderRootComponent(App);

TrackPlayer.registerPlaybackService(() => PlaybackService);
