import Logo from "@/assets/images/logo.svg";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import { useSessionStore } from "@/src/stores/session";
import { Redirect } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import colors from "tailwindcss/colors";

export default function SignIn() {
  const { session, error, isLoading, signIn, clearError } = useSessionStore(
    (state) => state,
  );
  const [email, setEmail] = useState(session?.email || "");
  const [host, setHost] = useState(session?.url || "");
  const [password, setPassword] = useState("");

  const setEmailAndClearError = useCallback(
    (email: string) => {
      setEmail(email);
      clearError();
    },
    [clearError],
  );

  const setHostAndClearError = useCallback(
    (host: string) => {
      setHost(host);
      clearError();
    },
    [clearError],
  );

  const setPasswordAndClearError = useCallback(
    (password: string) => {
      setPassword(password);
      clearError();
    },
    [clearError],
  );

  const signInCallback = useCallback(() => {
    signIn(host, email, password);
  }, [host, email, password, signIn]);

  if (session?.token) {
    // Redirect back to library if already signed in
    return <Redirect href="/" />;
  }

  return (
    <View className="p-12">
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
        onChangeText={setHostAndClearError}
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
      />

      <TextInput
        placeholder="Email"
        value={email}
        autoCapitalize="none"
        onChangeText={setEmailAndClearError}
        textContentType="emailAddress"
        keyboardType="email-address"
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPasswordAndClearError}
        secureTextEntry
        className="my-2 mb-10 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
      />
      <Button
        title="Sign in"
        color={colors.lime[500]}
        onPress={signInCallback}
        disabled={isLoading}
      />
      {isLoading && <LargeActivityIndicator className="mt-4" />}
      {error && (
        <Text className="mt-4 text-red-500 text-center">
          Invalid host, username, or password
        </Text>
      )}
    </View>
  );
}
