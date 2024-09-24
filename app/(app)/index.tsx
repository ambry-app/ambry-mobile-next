import { Button, View } from "react-native";
import colors from "tailwindcss/colors";

import { useSession } from "@/contexts/session";

export default function Index() {
  const { session, signOut } = useSession();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button
        title="Sign out"
        color={colors.lime[500]}
        onPress={() => {
          // The `app/(app)/_layout.tsx` will redirect to the sign-in screen.
          signOut(session!);
        }}
      />
    </View>
  );
}
