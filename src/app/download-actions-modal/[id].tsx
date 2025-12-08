import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DownloadActionsModal } from "@/components/screens";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles";

export default function DownloadActionsRoute() {
  const { bottom } = useSafeAreaInsets();
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <View style={{ paddingBottom: Platform.OS === "android" ? bottom : 0 }}>
      {Platform.OS === "android" && <View style={styles.handle} />}
      <DownloadActionsModal session={session} />
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
