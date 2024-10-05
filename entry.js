// `@expo/metro-runtime` MUST be the first import to ensure Fast Refresh works
// on web.
import "@expo/metro-runtime";

import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

import { PlaybackService } from "@/src/services/PlaybackService";
import TrackPlayer from "react-native-track-player";

// This file should only import and register the root. No components or exports
// should be added here.
renderRootComponent(App);

// not sure if this is allowed given the warnings above, but we'll give it a try...
TrackPlayer.registerPlaybackService(() => PlaybackService);