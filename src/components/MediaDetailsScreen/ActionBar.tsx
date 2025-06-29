import { IconButton } from "@/src/components";
import FadeInOnMount from "@/src/components/FadeInOnMount";
import { MediaActionBarInfo } from "@/src/db/library";
import { useMediaActionBarInfo } from "@/src/hooks/library";
import { useShelvedMedia } from "@/src/hooks/use-shelved-media";
import useLoadMediaCallback from "@/src/hooks/use.load.media.callback";
import { startDownload, useDownloads } from "@/src/stores/downloads";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { router } from "expo-router";
import { Alert, Share, StyleSheet, View } from "react-native";

type ActionBarProps = {
  mediaId: string;
  session: Session;
};

export default function ActionBar(props: ActionBarProps) {
  const { mediaId, session } = props;
  const { media } = useMediaActionBarInfo(session, mediaId);
  const { isOnShelf, toggleOnShelf } = useShelvedMedia(
    session,
    mediaId,
    "saved",
  );

  if (!media) return null;

  return (
    <FadeInOnMount style={styles.container}>
      <View style={styles.buttonsContainer}>
        <DownloadButton media={media} session={session} />
        <IconButton
          icon="heart"
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
              session.url + "/audiobooks/" + atob(mediaId).split(":")[1];
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
    </FadeInOnMount>
  );
}

type PlayButtonProps = {
  media: MediaActionBarInfo;
  session: Session;
};

function PlayButton({ session, media }: PlayButtonProps) {
  const loadMedia = useLoadMediaCallback(session, media.id);

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
  media: MediaActionBarInfo;
  session: Session;
};

function DownloadButton({ media, session }: DownloadButtonProps) {
  const download = useDownloads((state) => state.downloads[media.id]);

  if (download?.progress || download?.status === "pending") {
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

  if (download?.status === "ready") {
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
