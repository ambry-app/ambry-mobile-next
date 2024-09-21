import { router } from "expo-router";
import { Text, View } from "react-native";

import { useSession } from "../contexts/session";

export default function SignIn() {
  const { signIn } = useSession();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text
        onPress={async () => {
          const token = await signIn("fake", "fake", "fake");
          // Navigate after signing in. You may want to tweak this to ensure sign-in is
          // successful before navigating.
          if (token) {
            router.replace("/");
          } else {
            console.error("Sign in failed");
          }
        }}
      >
        Sign In
      </Text>
    </View>
  );
}
