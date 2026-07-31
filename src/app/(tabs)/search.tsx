import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Stack, useRouter } from "expo-router";

import { FocusableTextInput } from "@/components/FocusableTextInput";
import { SearchResults } from "@/components/screens/search-screen/SearchResults";
import { PLAYER_HEIGHT, TAB_BAR_BASE_HEIGHT } from "@/constants";
import { useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors, surface } from "@/styles/colors";

const MINI_PROGRESS_BAR_HEIGHT = 2;

export default function SearchRoute() {
  const session = useSession((state) => state.session);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");

  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const playerLoaded = useTrackPlayer((state) => !!state.playthrough);

  // Calculate the height of the bottom bar (tab bar + player if loaded)
  const bottomBarHeight =
    TAB_BAR_BASE_HEIGHT +
    safeAreaBottom +
    (playerLoaded ? PLAYER_HEIGHT + MINI_PROGRESS_BAR_HEIGHT : 0);

  // Keyboard height is from screen bottom, but content is above the bottom bar
  const rawKeyboardHeight = useKeyboardState((state) => state.height);
  const keyboardHeight = Math.max(0, rawKeyboardHeight - bottomBarHeight);

  const animatedHeight = useSharedValue(keyboardHeight);

  useEffect(() => {
    animatedHeight.value = withTiming(keyboardHeight, { duration: 250 });
  }, [keyboardHeight, animatedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: animatedHeight.value,
  }));

  if (!session) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Search Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <FontAwesome6 name="arrow-left" size={20} color={Colors.zinc[100]} />
        </Pressable>

        <View style={styles.searchBar}>
          <FontAwesome6
            name="magnifying-glass"
            size={16}
            color={Colors.zinc[500]}
            style={styles.searchIcon}
          />
          <FocusableTextInput
            style={styles.input}
            placeholder="Search Library"
            placeholderTextColor={Colors.zinc[500]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <FontAwesome6 name="xmark" size={16} color={Colors.zinc[100]} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results */}
      {searchQuery.trim().length >= 3 ? (
        <SearchResults session={session} searchQuery={searchQuery.trim()} />
      ) : (
        <Animated.View style={[styles.placeholderContainer, animatedStyle]}>
          <FontAwesome6
            name="magnifying-glass"
            size={48}
            color={Colors.zinc[700]}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.placeholderText}>
            Type at least 3 characters to search
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: surface.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.zinc[800],
    gap: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: surface.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: Colors.zinc[100],
    fontSize: 16,
    height: "100%",
  },
  placeholderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  placeholderText: {
    color: Colors.zinc[500],
    fontSize: 16,
    textAlign: "center",
  },
});
