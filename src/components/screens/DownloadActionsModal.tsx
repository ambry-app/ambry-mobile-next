import { FadeInOnMount, IconButton } from "@/src/components";
import {
  cancelDownload,
  removeDownload,
  useDownloads,
} from "@/src/stores/downloads";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useShallow } from "zustand/shallow";

export function DownloadActionsModal({ session }: { session: Session }) {
  const { id: mediaId } = useLocalSearchParams<{ id: string }>();
  const status = useDownloads(
    useShallow((state) => state.downloads[mediaId]?.status),
  );

  if (!status) return null;

  return (
    <FadeInOnMount style={styles.container}>
      {status === "ready" ? (
        <DeleteButton session={session} mediaId={mediaId} />
      ) : (
        <CancelButton session={session} mediaId={mediaId} />
      )}
    </FadeInOnMount>
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
      color={Colors.zinc[100]}
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
      color={Colors.zinc[100]}
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
    color: Colors.zinc[100],
    fontSize: 18,
    textAlign: "center",
  },
});
