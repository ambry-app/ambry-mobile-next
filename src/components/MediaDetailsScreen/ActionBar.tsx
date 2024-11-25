import IconButton from "@/src/components/IconButton";
import Loading from "@/src/components/Loading";
import { useMediaActionBarInfo } from "@/src/db/library";
import { syncDownUser } from "@/src/db/sync";
import { startDownload, useDownloads } from "@/src/stores/downloads";
import { loadMedia, requestExpandPlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

type ActionBarProps = {
  mediaId: string;
  session: Session;
};

export default function ActionBar({ mediaId, session }: ActionBarProps) {
  const progress = useDownloads((state) => state.downloadProgresses[mediaId]);
  const { media, opacity } = useMediaActionBarInfo(session, mediaId);

  if (!media) return null;

  if (progress) {
    return (
      <Animated.View style={[styles.inProgressContainer, { opacity }]}>
        <Pressable
          style={styles.inProgressButtonContainer}
          onPress={() => router.navigate("/downloads")}
        >
          <View style={styles.inProgressButton}>
            <View>
              <Loading size={36} />
            </View>
            <View>
              <Text style={styles.inProgressButtonLabel}>Downloading...</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  } else if (media.download && media.download.status !== "error") {
    return (
      <Animated.View style={[styles.container, { opacity }]}>
        <View style={styles.buttonOuterContainer}>
          <View style={styles.buttonContainer}>
            <IconButton
              icon="play-circle"
              size={32}
              style={styles.button}
              color={colors.zinc[100]}
              onPress={async () => {
                await syncDownUser(session, true);
                await loadMedia(session, media.id);
                requestExpandPlayer();
              }}
            >
              <Text style={styles.buttonLabel}>Play</Text>
            </IconButton>
          </View>
        </View>
        <Text style={styles.explanationText}>
          You have this audiobook downloaded, it will play from your device and
          not require an internet connection.
        </Text>
      </Animated.View>
    );
  } else {
    return (
      <Animated.View style={[styles.container, { opacity }]}>
        <View style={styles.buttonOuterContainer}>
          <View style={[styles.buttonContainer, styles.borderRight]}>
            <IconButton
              icon="play-circle"
              size={32}
              style={styles.button}
              color={colors.zinc[100]}
              onPress={async () => {
                await syncDownUser(session, true);
                await loadMedia(session, media.id);
                requestExpandPlayer();
              }}
            >
              <Text style={styles.buttonLabel}>Stream</Text>
            </IconButton>
          </View>
          <View style={styles.buttonContainer}>
            <IconButton
              icon="download"
              size={32}
              style={styles.button}
              color={colors.zinc[100]}
              onPress={() => {
                if (!media.mp4Path) return;
                startDownload(
                  session,
                  media.id,
                  media.mp4Path,
                  media.thumbnails,
                );
                router.navigate("/downloads");
              }}
            >
              <Text style={styles.buttonLabel}>Download</Text>
            </IconButton>
          </View>
        </View>
        <Text style={styles.explanationText}>
          Playing this audiobook will stream it and require an internet
          connection and may use your data plan.
        </Text>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
  inProgressContainer: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: colors.zinc[900],
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
  },
  inProgressButtonContainer: {
    flexGrow: 1,
    padding: 16,
  },
  inProgressButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  inProgressButtonLabel: {
    fontSize: 16,
    color: colors.zinc[100],
  },
  container: {
    gap: 8,
    marginTop: 32,
  },
  buttonOuterContainer: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: colors.zinc[900],
    borderRadius: 12,
    alignItems: "center",
  },
  buttonLabel: {
    fontSize: 16,
    color: colors.zinc[100],
    marginTop: 8,
    lineHeight: 16,
  },
  explanationText: {
    fontSize: 12,
    color: colors.zinc[500],
  },
  buttonContainer: {
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: colors.zinc[800],
  },
});
