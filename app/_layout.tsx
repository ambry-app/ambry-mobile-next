import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import colors from "tailwindcss/colors";
import { SessionProvider } from "../contexts/session";
import "../global.css";

const Theme = {
  dark: true,
  colors: {
    primary: colors.lime[400],
    background: colors.black,
    card: colors.zinc[900],
    text: colors.zinc[100],
    border: colors.zinc[600],
    notification: colors.red[400],
  },
};

export default function Root() {
  return (
    <SessionProvider>
      <ThemeProvider value={Theme}>
        <Stack>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}
