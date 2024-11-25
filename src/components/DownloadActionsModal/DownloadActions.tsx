import IconButton from "@/src/components/IconButton";
import { useDownload } from "@/src/db/downloads";
import { cancelDownload, removeDownload } from "@/src/stores/downloads";
import { Session } from "@/src/stores/session";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

export default function DownloadActions({ session }: { session: Session }) {
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();
  const { download, opacity } = useDownload(session, mediaId);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {download?.status === "ready" ? (
        <DeleteButton session={session} mediaId={mediaId} />
      ) : (
        <CancelButton session={session} mediaId={mediaId} />
      )}
    </Animated.View>
  );
}

type ButtonProps = {
  session: Session;
  mediaId: string;
};

function DeleteButton({ session, mediaId }: ButtonProps) {
  return (
    <IconButton
      icon="trash"
      size={16}
      color={colors.zinc[100]}
      style={styles.button}
      onPress={() => {
        removeDownload(session, mediaId);
        router.back();
      }}
    >
      <Text style={styles.buttonText}>Delete downloaded files</Text>
    </IconButton>
  );
}

function CancelButton({ session, mediaId }: ButtonProps) {
  return (
    <IconButton
      icon="xmark"
      size={16}
      color={colors.zinc[100]}
      style={styles.button}
      onPress={() => {
        cancelDownload(session, mediaId);
        router.back();
      }}
    >
      <Text style={styles.buttonText}>Cancel download</Text>
    </IconButton>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  button: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 24,
  },
  buttonText: {
    color: colors.zinc[100],
    fontSize: 18,
    textAlign: "center",
  },
});
