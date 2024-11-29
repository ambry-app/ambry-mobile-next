import Logo from "@/assets/images/logo.svg";
import { FocusableTextInput, IconButton, Loading } from "@/src/components";
import { useScreen } from "@/src/stores/screen";
import { clearError, signIn, useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { Redirect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export default function SignInScreen() {
  const { session, error, isLoading } = useSession((state) => state);
  const [email, setEmail] = useState(session?.email || "");
  const [host, setHost] = useState(session?.url || "");
  const [password, setPassword] = useState("");
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const { screenWidth } = useScreen();
  const logoWidth = screenWidth - 64;
  const logoHeight = logoWidth / 4.5;

  const doSignIn = useCallback(() => {
    // to help the automated Google Play pre-launch report
    if (email === "demo@ambry.app") {
      signIn("https://demo.ambry.app", email, password);
    } else {
      signIn(host, email, password);
    }
  }, [host, email, password]);

  if (session?.token) {
    // Redirect back to library if already signed in
    return <Redirect href="/(app)/(tabs)/(library)" />;
  }

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
          placeholder="Host"
          value={host}
          autoCapitalize="none"
          onChangeText={(host: string) => {
            setHost(host);
            clearError();
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
            clearError();
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
            clearError();
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
      {error && (
        <Text style={styles.errorText}>
          Invalid host, username, or password
        </Text>
      )}
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
