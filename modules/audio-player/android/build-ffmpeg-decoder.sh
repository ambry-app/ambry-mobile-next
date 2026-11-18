#!/usr/bin/env bash
# Rebuilds libs/media3-decoder-ffmpeg-<media3Version>.aar. Run after bumping media3Version.
set -euo pipefail

FFMPEG_BRANCH="release/6.0"
DECODERS=(ac3 eac3)

here="$(cd "$(dirname "$0")" && pwd)"
app="$(cd "$here/../../.." && pwd)"
versions="$app/node_modules/react-native/gradle/libs.versions.toml"

media3=$(sed -nE 's/^ *def media3Version = "(.+)"/\1/p' "$here/build.gradle")
ndk_version=$(sed -nE 's/^ndkVersion = "(.+)"/\1/p' "$versions")
min_sdk=$(sed -nE 's/^minSdk = "(.+)"/\1/p' "$versions")
sdk="${ANDROID_HOME:-$HOME/Android/sdk}"
ndk="$sdk/ndk/$ndk_version"

[[ -n "$media3" && -n "$ndk_version" && -n "$min_sdk" ]] || { echo "could not read versions" >&2; exit 1; }
[[ -d "$ndk" ]] || { echo "NDK $ndk_version not found at $ndk" >&2; exit 1; }
echo "media3 $media3, FFmpeg $FFMPEG_BRANCH, NDK $ndk_version, minSdk $min_sdk, decoders: ${DECODERS[*]}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone -q --depth 1 --branch "$media3" https://github.com/androidx/media.git "$work/media"
git clone -q --depth 1 --branch "$FFMPEG_BRANCH" https://github.com/FFmpeg/FFmpeg.git "$work/ffmpeg"

module="$work/media/libraries/decoder_ffmpeg/src/main"
ln -s "$work/ffmpeg" "$module/jni/ffmpeg"
"$module/jni/build_ffmpeg.sh" "$module" "$ndk" linux-x86_64 "$min_sdk" "${DECODERS[@]}"

echo "sdk.dir=$sdk" > "$work/media/local.properties"
(cd "$work/media" && ./gradlew -q :lib-decoder-ffmpeg:assembleRelease)

rm -f "$here"/libs/media3-decoder-ffmpeg-*.aar
mkdir -p "$here/libs"
cp "$work/media/libraries/decoder_ffmpeg/buildout/outputs/aar/lib-decoder-ffmpeg-release.aar" \
  "$here/libs/media3-decoder-ffmpeg-$media3.aar"
echo "wrote libs/media3-decoder-ffmpeg-$media3.aar"
