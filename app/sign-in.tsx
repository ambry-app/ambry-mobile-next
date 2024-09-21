import { Button, Text, TextInput, View } from "react-native";

import { useCallback, useState } from "react";

import Logo from "@/assets/images/logo.svg";
import LargeActivityIndicator from "@/components/LargeActivityIndicator";
import { useSession } from "@/contexts/session";
import { router } from "expo-router";
import colors from "tailwindcss/colors";

export default function SignIn() {
  // const knownHosts = useAmbryAPI(state => state.knownHosts)
  // const [showHostInput, setShowHostInput] = useState();
  const [email, setEmail] = useState("");
  const [host, setHost] = useState("http://192.168.0.45:4000");
  const [password, setPassword] = useState("");
  const { signIn } = useSession();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const login = useCallback(async () => {
    setLoading(true);
    setError(false);
    const token = await signIn(host, email, password);
    // Navigate after signing in. You may want to tweak this to ensure sign-in is
    // successful before navigating.
    if (token) {
      setLoading(false);
      router.replace("/");
    } else {
      setLoading(false);
      setError(true);
      console.error("Sign in failed");
    }
  }, [email, host, password, signIn]);

  // useEffect(() => {
  //   if (knownHosts[0]) {
  //     setHost(knownHosts[0])
  //   }
  // }, [knownHosts])

  // useEffect(() => {
  //   if (host === 'new') {
  //     setShowHostInput(true)
  //     setHost('')
  //   }
  // }, [host])

  // const { isLoading, isError, login } = useLoginAction(host, email, password)

  // const [hostPickerOpen, setHostPickerOpen] = useState(false)
  // const [hostPickerItems, setHostPickerItems] = useState(
  //   knownHosts
  //     .map(selectableHost => ({
  //       label: selectableHost,
  //       value: selectableHost
  //     }))
  //     .concat([{ label: 'New Host', value: 'new' }])
  // )

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
        onChangeText={setHost}
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-3 py-2"
        placeholderTextColor={colors.zinc[500]}
      />

      <TextInput
        placeholder="Email"
        value={email}
        autoCapitalize="none"
        onChangeText={setEmail}
        textContentType="emailAddress"
        keyboardType="email-address"
        className="my-2 text-zinc-200 bg-zinc-800 rounded px-3 py-2"
        placeholderTextColor={colors.zinc[500]}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="my-2 mb-4 text-zinc-200 bg-zinc-800 rounded px-3 py-2"
        placeholderTextColor={colors.zinc[500]}
      />
      <Button
        title="Sign in"
        color={colors.lime[500]}
        onPress={login}
        disabled={loading}
      />
      {loading && <LargeActivityIndicator className="mt-4" />}
      {error && (
        <Text className="mt-4 text-red-500 text-center">
          Invalid username or password
        </Text>
      )}
    </View>
  );
}
