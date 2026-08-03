import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { IconButton } from "@/components/IconButton";
import { ScreenCentered } from "@/components/ScreenCentered";
import { Colors } from "@/styles/colors";

type ErrorScreenProps = {
  title: string;
  message: string;
  /** Shows a "Try again" button. Omit when the failure is not recoverable. */
  onRetry?: () => void;
  /** Shows a "Sign out" escape hatch below the retry button. */
  onSignOut?: () => void;
};

/**
 * Full-screen explanation of why the app cannot continue. Anywhere we would
 * otherwise sit on a spinner indefinitely should render this instead.
 */
export function ErrorScreen(props: ErrorScreenProps) {
  const { title, message, onRetry, onSignOut } = props;
  const [retrying, setRetrying] = useState(false);

  const retry = () => {
    setRetrying(true);
    onRetry?.();
  };

  return (
    <ScreenCentered>
      <View style={styles.container}>
        <FontAwesome6
          name="triangle-exclamation"
          size={48}
          color={Colors.red[400]}
          solid
        />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {onRetry && (
          <IconButton
            style={styles.button}
            icon={retrying ? "loading" : "rotate-right"}
            size={20}
            color={Colors.zinc[900]}
            onPress={retry}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </IconButton>
        )}

        {onSignOut && (
          <TouchableOpacity onPress={onSignOut} accessibilityRole="button">
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenCentered>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: Colors.zinc[100],
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  message: {
    color: Colors.zinc[400],
    fontSize: 16,
    textAlign: "center",
  },
  button: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    backgroundColor: Colors.lime[400],
    borderRadius: 999,
  },
  buttonText: {
    color: Colors.zinc[900],
    fontWeight: "bold",
  },
  signOutText: {
    color: Colors.zinc[400],
    fontSize: 16,
    padding: 8,
  },
});
