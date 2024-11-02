import Button from "@/src/components/Button";
import useBackHandler from "@/src/hooks/use.back.handler";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";

export default function SleepTimerModal() {
  useBackHandler(() => {
    router.back();
    return true;
  });

  return (
    <View style={styles.container}>
      <Button
        size={32}
        onPress={() => router.back()}
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    backgroundColor: colors.zinc[950],
    height: "100%",
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  closeButton: {
    marginTop: 32,
  },
  closeButtonText: {
    color: colors.lime[400],
  },
});
