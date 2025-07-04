import { DownloadActions } from "@/src/components/DownloadActionsModal";
import { useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DownloadActionsModal() {
  const { bottom } = useSafeAreaInsets();
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <View style={{ paddingBottom: Platform.OS === "android" ? bottom : 0 }}>
      {Platform.OS === "android" && <View style={styles.handle} />}
      <DownloadActions session={session} />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.zinc[500],
    borderRadius: 999,
    marginHorizontal: "auto",
    marginTop: 8,
  },
});
