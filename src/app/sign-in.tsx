import Logo from "@/assets/images/logo.svg";
import Loading from "@/src/components/Loading";
import { useSessionStore } from "@/src/stores/session";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import colors from "tailwindcss/colors";

export default function SignInScreen() {
  const { session, error, isLoading, signIn, clearError } = useSessionStore(
    (state) => state,
  );
  const [email, setEmail] = useState(session?.email || "");
  const [host, setHost] = useState(session?.url || "");
  const [password, setPassword] = useState("");

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
        onChangeText={(host: string) => {
          setHost(host);
          clearError();
        }}
        textContentType="URL"
        keyboardType="url"
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-4 py-4 border-2 focus:border-zinc-700"
        placeholderTextColor={colors.zinc[500]}
      />

      <TextInput
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
      />
      <TextInput
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
      />
      <Button
        title="Sign in"
        color={colors.lime[500]}
        onPress={() => {
          // to help the automated Google Play pre-launch report
          if (email === "demo@ambry.app") {
            signIn("https://demo.ambry.app", email, password);
          } else {
            signIn(host, email, password);
          }
        }}
        disabled={isLoading}
      />
      {isLoading && <Loading style={{ marginTop: 16 }} />}
      {error && (
        <Text className="mt-4 text-red-500 text-center">
          Invalid host, username, or password
        </Text>
      )}
    </View>
  );
}
