import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

export function ScreenCentered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  centered: {
    display: "flex",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
