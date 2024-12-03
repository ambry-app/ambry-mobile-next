import { IconButton } from "@/src/components";
import { Download, useDownload } from "@/src/db/downloads";
import { ActionBarMedia, useMediaActionBarInfo } from "@/src/db/library";
import { syncDownUser } from "@/src/db/sync";
import { startDownload, useDownloads } from "@/src/stores/downloads";
import {
  loadMedia,
  prepareToLoadMedia,
  requestExpandPlayer,
} from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { router } from "expo-router";
import { Alert, Share, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

type ActionBarProps = {
  mediaId: string;
  session: Session;
};

export default function ActionBar({ mediaId, session }: ActionBarProps) {
  const { media, opacity } = useMediaActionBarInfo(session, mediaId);
  const { download } = useDownload(session, mediaId);

  if (!media) return null;

  const onPressPlay = async () => {
    requestExpandPlayer();
    prepareToLoadMedia();
    setTimeout(async () => {
      await syncDownUser(session, true);
      await loadMedia(session, media.id);
    }, 400);
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.buttonsContainer}>
        <DownloadButton media={media} download={download} session={session} />
        <IconButton
          icon="heart"
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
          onPress={() => {
            Alert.alert(
              "Coming soon",
              "This will allow you to add audiobooks to a list liked audiobooks.",
            );
          }}
        />
        <IconButton
          icon="play"
          size={32}
          style={styles.playButton}
          iconStyle={styles.playButtonIcon}
          color={Colors.black}
          onPress={onPressPlay}
        />
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
    </Animated.View>
  );
}

type DownloadButtonProps = {
  media: ActionBarMedia;
  download: Download;
  session: Session;
};

function DownloadButton({ media, download, session }: DownloadButtonProps) {
  const inProgress = useDownloads(
    (state) => media.id in state.downloadProgresses,
  );

  if (inProgress) {
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

  if (download && download.status !== "error") {
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
