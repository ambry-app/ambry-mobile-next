import { useLayoutEffect, useState } from "react";
import { Platform } from "react-native";
import { useNavigation } from "expo-router";

import { ScrollHandler } from "@/components/FadingHeader";
import { FullLibrary } from "@/components/screens/library-screen/FullLibrary";
import { SearchResults } from "@/components/screens/library-screen/SearchResults";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";
import { useDebounce } from "@/utils/hooks";

type LibraryScreenProps = {
  session: Session;
  scrollHandler?: ScrollHandler;
  topInset?: number;
};

export function LibraryScreen({
  session,
  scrollHandler,
  topInset = 0,
}: LibraryScreenProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const navigation = useNavigation();

  // iOS: Set up native search bar in header
  useLayoutEffect(() => {
    if (Platform.OS === "ios") {
      navigation.setOptions({
        headerSearchBarOptions: {
          onChangeText: (event: { nativeEvent: { text: string } }) => {
            setSearch(event.nativeEvent.text);
          },
          placeholder: "Search Library",
          textColor: Colors.zinc["100"],
          hintTextColor: Colors.zinc["600"],
          headerIconColor: Colors.white,
        },
      });
    }
  }, [navigation, setSearch]);

  // iOS: Show search results when searching
  if (Platform.OS === "ios" && debouncedSearch && debouncedSearch.length >= 3) {
    return <SearchResults session={session} searchQuery={debouncedSearch} />;
  }

  return (
    <FullLibrary
      session={session}
      scrollHandler={scrollHandler}
      topInset={topInset}
    />
  );
}
