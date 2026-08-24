const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Remove react-native-track-player's MusicService from the merged manifest.
 *
 * RNTP is still installed while the migration to modules/audio-player is in
 * progress, but it must be unstartable: System UI's media-playback resumption
 * starts whatever service in the package carries the media3 intent-filter
 * after a process death during playback, and that finds RNTP's MusicService
 * (audio-player's service deliberately declares no such filter). Its
 * onCreate then builds a media session whose default empty ID collides with
 * audio-player's session in media3's process-wide registry and crashes the
 * app at launch.
 *
 * Delete this plugin (and its entry in app.config.ts) together with the
 * react-native-track-player dependency.
 */
const withoutRntpMusicService = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ ?? {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const application = manifest.application?.[0];
    if (!application) return config;

    application.service = [
      ...(application.service ?? []),
      {
        $: {
          "android:name": "com.doublesymmetry.trackplayer.service.MusicService",
          "tools:node": "remove",
          // lintVitalRelease's Instantiatable check trips on the class name
          "tools:ignore": "Instantiatable",
        },
      },
    ];

    return config;
  });

module.exports = withoutRntpMusicService;
