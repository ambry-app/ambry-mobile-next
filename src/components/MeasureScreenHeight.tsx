import { setDimensions } from "@/src/stores/screen";
import { StyleSheet, View } from "react-native";

// This is a workaround due to Android screen height currently being broken:
// https://github.com/facebook/react-native/issues/47080

export function MeasureScreenHeight() {
  return (
    <View
      onLayout={({ nativeEvent }) => {
        setDimensions(nativeEvent.layout.height, nativeEvent.layout.width);
      }}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    height: "100%",
    width: "100%",
    zIndex: -999,
  },
});
