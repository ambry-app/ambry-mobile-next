import { Loading, ScreenCentered } from "@/src/components";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Redirect, Stack } from "expo-router";
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
