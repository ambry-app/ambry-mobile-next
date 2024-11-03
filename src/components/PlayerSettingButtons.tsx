import { usePlayer } from "@/src/stores/player";
import { formatPlaybackRate } from "@/src/utils/rate";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";
import IconButton from "./IconButton";

export default function PlayerSettingButtons() {
  const playbackRate = usePlayer((state) => state.playbackRate);
  return (
    <View style={styles.container}>
      <IconButton
        icon="stopwatch"
        size={16}
        color={colors.zinc[100]}
        style={styles.button}
        onPress={() => {
          router.navigate("/sleep-timer");
        }}
      >
        <Text style={styles.sleepTimerText}>10:00</Text>
      </IconButton>
      <IconButton
        icon="gauge"
        size={16}
        color={colors.zinc[100]}
        style={styles.button}
        onPress={() => {
          router.navigate("/playback-rate");
        }}
      >
        <Text style={styles.sleepTimerText}>
          {formatPlaybackRate(playbackRate)}×
        </Text>
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: -20,
  },
  button: {
    backgroundColor: colors.zinc[800],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 4,
  },
  sleepTimerText: {
    color: colors.zinc[100],
  },
});
