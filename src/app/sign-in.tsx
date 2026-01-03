import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { FocusableTextInput, IconButton, Loading } from "@/components";
import { CreateSessionErrorCode } from "@/graphql/api";
import { ExecuteErrorCode } from "@/graphql/client/execute";
import { signIn } from "@/services/auth-service";
import { useScreen } from "@/stores/screen";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles";
import Logo from "@assets/images/logo.svg";

export default function SignInRoute() {
  const { session } = useSession((state) => state);

  const [email, setEmail] = useState(session?.email || "");
  const [host, setHost] = useState(session?.url || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const { screenWidth } = useScreen();
  const logoWidth = screenWidth - 64;
  const logoHeight = logoWidth / 4.5;

  const doSignIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    let result;

    // to help the automated Google Play pre-launch report
    if (email === "demo@ambry.app") {
      result = await signIn("https://demo.ambry.app", email, password);
    } else {
      result = await signIn(host, email, password);
    }

    setIsLoading(false);

    if (!result.success) {
      switch (result.error.code) {
        case ExecuteErrorCode.NETWORK_ERROR:
          setError(
            "Could not reach server. Please check your connection or server address and try again.",
          );
          return;
        case ExecuteErrorCode.SERVER_ERROR:
        case ExecuteErrorCode.GQL_ERROR:
          setError("Server error. Please contact the server admin.");
          return;
        case CreateSessionErrorCode.INVALID_CREDENTIALS:
          setError(
            "Invalid email address or password. Please check your credentials and try again.",
          );
          return;
        default:
          return result.error satisfies never;
      }
    }
  }, [host, email, password]);

  return (
    <KeyboardAwareScrollView
      bottomOffset={96}
      contentContainerStyle={styles.container}
    >
      <View>
        <Logo width={logoWidth} height={logoHeight} />
        <Text style={styles.logoText}>Personal Audiobook Streaming</Text>
      </View>

      <View style={styles.inputsContainer}>
        <FocusableTextInput
          style={styles.input}
          focusedStyle={styles.inputFocused}
          placeholderTextColor={Colors.zinc[500]}
          placeholder="Server address"
          value={host}
          autoCapitalize="none"
          onChangeText={(host: string) => {
            setHost(host);
            setError(null);
          }}
          textContentType="URL"
          keyboardType="url"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailInputRef.current?.focus()}
        />

        <FocusableTextInput
          inputRef={emailInputRef}
          style={styles.input}
          focusedStyle={styles.inputFocused}
          placeholderTextColor={Colors.zinc[500]}
          placeholder="Email"
          value={email}
          autoCapitalize="none"
          onChangeText={(email: string) => {
            setEmail(email);
            setError(null);
          }}
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />
        <FocusableTextInput
          inputRef={passwordInputRef}
          style={styles.input}
          focusedStyle={styles.inputFocused}
          placeholderTextColor={Colors.zinc[500]}
          placeholder="Password"
          value={password}
          onChangeText={(password: string) => {
            setPassword(password);
            setError(null);
          }}
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={doSignIn}
        />
      </View>
      <IconButton
        style={styles.button}
        icon="arrow-right"
        size={24}
        color={Colors.zinc[900]}
        onPress={doSignIn}
      >
        <Text style={styles.buttonText}>Sign in</Text>
      </IconButton>
      {isLoading && <Loading />}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 64,
    padding: 32,
    gap: 32,
  },
  logoText: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.zinc[400],
    textAlign: "center",
  },
  errorText: {
    color: Colors.red[500],
    textAlign: "center",
  },
  buttonText: {
    color: Colors.zinc[900],
    fontWeight: "bold",
  },
  button: {
    flexDirection: "row-reverse",
    gap: 8,
    backgroundColor: Colors.lime[400],
    borderRadius: 999,
  },
  inputsContainer: {
    gap: 16,
  },
  input: {
    color: Colors.zinc[200],
    backgroundColor: Colors.zinc[800],
    borderRadius: 4,
    padding: 16,
    borderWidth: 2,
  },
  inputFocused: {
    borderColor: Colors.zinc[700],
  },
});
