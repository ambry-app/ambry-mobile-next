import { Text, View } from "react-native";

import { useSession } from "../../contexts/session";

export default function Index() {
  const { session, signOut } = useSession();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text
        onPress={() => {
          // The `app/(app)/_layout.tsx` will redirect to the sign-in screen.
          signOut(session!.url, session!.token);
        }}
      >
        Sign Out
      </Text>
    </View>
  );
}
