import { Loading, ScreenCentered } from "@/src/components";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { Colors } from "@/src/styles";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: Colors.zinc[900],
  },
});

const modalOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  contentStyle: styles.modalContent,
};

const chapterSelectOptions: NativeStackNavigationOptions = {
  presentation: "modal",
  headerTitle: "Select Chapter",
  contentStyle: styles.modalContent,
};

export default function AppStackLayout() {
  const { isReady } = useAppBoot();

  if (!isReady) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sleep-timer" options={modalOptions} />
      <Stack.Screen name="playback-rate" options={modalOptions} />
      <Stack.Screen name="chapter-select" options={chapterSelectOptions} />
      <Stack.Screen name="download-actions-modal/[id]" options={modalOptions} />
    </Stack>
  );
}
