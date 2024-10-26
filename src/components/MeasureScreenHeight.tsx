import { StyleSheet, View } from "react-native";
import { useScreenStore } from "../stores/screen";

// This is a workaround due to Android screen height currently being broken:
// https://github.com/facebook/react-native/issues/47080

export default function MeasureScreenHeight() {
  const { setDimensions } = useScreenStore((state) => state);

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
