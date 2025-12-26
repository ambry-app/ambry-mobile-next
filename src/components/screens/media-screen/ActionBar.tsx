import { Alert, Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { IconButton, PlayButton as PlayerPlayButton } from "@/components";
import { MediaHeaderInfo } from "@/db/library";
import useLoadMediaCallback from "@/hooks/use-load-media-callback";
import { useShelvedMedia } from "@/hooks/use-shelved-media";
import { startDownload, useDownloads } from "@/stores/downloads";
import { usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type ActionBarProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function ActionBar({ media, session }: ActionBarProps) {
  const { isOnShelf, toggleOnShelf } = useShelvedMedia(
    session,
    media.id,
    "saved",
  );

  if (!media) return null;

  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <DownloadButton media={media} session={session} />
        <IconButton
          icon="bookmark"
          solid={isOnShelf}
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
          onPress={toggleOnShelf}
        />
        <PlayButton session={session} media={media} />
        <IconButton
          icon="share"
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
          onPress={async () => {
            const mediaURL =
              session.url + "/audiobooks/" + atob(media.id).split(":")[1];
            Share.share({ message: mediaURL });
          }}
        />
        <IconButton
          icon="ellipsis-vertical"
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
          onPress={() => {
            Alert.alert(
              "Coming soon",
              "This will show a list of additional actions you can take with this audiobook.",
            );
          }}
        />
      </View>
      {/* <ExplanationText download={download} /> */}
    </View>
  );
}

type PlayButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function PlayButton({ session, media }: PlayButtonProps) {
  const playerMediaId = usePlayer((state) => state.mediaId);
  const isCurrentlyLoaded = playerMediaId === media.id;
  const loadMedia = useLoadMediaCallback(session, media.id);

  // If this media is currently loaded, show real-time play/pause button
  if (isCurrentlyLoaded) {
    return (
      <PlayerPlayButton
        size={32}
        color={Colors.black}
        style={styles.playButton}
        playIconStyle={styles.playButtonIcon}
      />
    );
  }

  // Otherwise show "load media" button
  return (
    <IconButton
      icon="play"
      size={32}
      style={styles.playButton}
      iconStyle={styles.playButtonIcon}
      color={Colors.black}
      onPress={loadMedia}
    />
  );
}

type DownloadButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function DownloadButton({ media, session }: DownloadButtonProps) {
  const status = useDownloads(
    useShallow((state) => state.downloads[media.id]?.status),
  );

  if (status === "pending") {
    return (
      <IconButton
        icon="loading"
        size={24}
        style={styles.button}
        color={Colors.zinc[100]}
        onPress={() => router.navigate("/downloads")}
      />
    );
  }

  if (status === "ready") {
    return (
      <IconButton
        icon="circle-check"
        size={24}
        style={styles.button}
        color={Colors.zinc[100]}
        onPress={() => router.navigate("/downloads")}
        solid
      />
    );
  }

  return (
    <IconButton
      icon="download"
      size={24}
      style={styles.button}
      color={Colors.zinc[100]}
      onPress={() => {
        if (!media.mp4Path) return;
        startDownload(session, media.id, media.mp4Path, media.thumbnails);
        router.navigate("/downloads");
      }}
    />
  );
}

// type ExplanationTextProps = {
//   download: Download;
// };

// function ExplanationText({ download }: ExplanationTextProps) {
//   if (download && download.status === "ready") {
//     return (
//       <Text style={styles.explanationText}>
//         You have this audiobook downloaded, it will play from your device and
//         not require an internet connection.
//       </Text>
//     );
//   } else {
//     return (
//       <Text style={styles.explanationText}>
//         Playing this audiobook will stream it and require an internet connection
//         and may use your data plan.
//       </Text>
//     );
//   }
// }

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    gap: 16,
  },
  buttonsContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  playButton: {
    backgroundColor: Colors.zinc[100],
    borderRadius: 999,
  },
  button: {
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
  },
  playButtonIcon: {
    // play button looks off center, so we need to adjust it a bit
    transform: [{ translateX: 2 }],
  },
  explanationText: {
    fontSize: 12,
    color: Colors.zinc[500],
  },
});
