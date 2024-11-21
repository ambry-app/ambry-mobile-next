import Logo from "@/assets/images/logo.svg";
import Loading from "@/src/components/Loading";
import { clearError, signIn, useSession } from "@/src/stores/session";
import { Redirect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import colors from "tailwindcss/colors";

export default function SignInScreen() {
  const { session, error, isLoading } = useSession((state) => state);
  const [email, setEmail] = useState(session?.email || "");
  const [host, setHost] = useState(session?.url || "");
  const [password, setPassword] = useState("");

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

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
      <View className="py-8 items-center">
        <Logo height="64px" />
        <Text className="text-lg font-semibold text-zinc-400">
          Personal Audiobook Streaming
        </Text>
      </View>

      <TextInput
        placeholder="Host"
        value={host}
        autoCapitalize="none"
        onChangeText={(host: string) => {
          setHost(host);
          clearError();
        }}
        textContentType="URL"
        keyboardType="url"
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailInputRef.current?.focus()}
      />

      <TextInput
        ref={emailInputRef}
        placeholder="Email"
        value={email}
        autoCapitalize="none"
        onChangeText={(email: string) => {
          setEmail(email);
          clearError();
        }}
        textContentType="emailAddress"
        keyboardType="email-address"
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordInputRef.current?.focus()}
      />
      <TextInput
        ref={passwordInputRef}
        placeholder="Password"
        value={password}
        onChangeText={(password: string) => {
          setPassword(password);
          clearError();
        }}
        secureTextEntry
        textContentType="password"
        className="my-2 mb-10 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
        returnKeyType="go"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={doSignIn}
      />
      <Button
        title="Sign in"
        color={colors.lime[500]}
        onPress={doSignIn}
        disabled={isLoading}
      />
      {isLoading && <Loading style={{ marginTop: 16 }} />}
      {error && (
        <Text className="mt-4 text-red-500 text-center">
          Invalid host, username, or password
        </Text>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
  },
});
