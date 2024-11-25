import Loading from "@/src/components/Loading";
import ScreenCentered from "@/src/components/ScreenCentered";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Redirect, Stack } from "expo-router";
import { Platform, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: Colors.zinc[800],
  },
});

const modalOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetCornerRadius: 24,
  sheetGrabberVisible: true,
  contentStyle: styles.modalContent,
};

// Android scrollable within formSheet is really janky, so we use a regular
// modal for chapter select on Android.
const chapterSelectOptions: NativeStackNavigationOptions =
  Platform.OS === "ios"
    ? { ...modalOptions, sheetAllowedDetents: [0.5, 1.0] }
    : { presentation: "modal", headerTitle: "Select Chapter" };

export default function AppStackLayout() {
  const session = useSession((state) => state.session);
  const { isReady } = useAppBoot();

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

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
