import { useLayoutEffect, useState } from "react";
import { useNavigation } from "expo-router";

import { FullLibrary } from "@/components/screens/library-screen/FullLibrary";
import { SearchResults } from "@/components/screens/library-screen/SearchResults";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";
import { useDebounce } from "@/utils/hooks";

type LibraryScreenProps = {
  session: Session;
};

export function LibraryScreen({ session }: LibraryScreenProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const navigation = useNavigation();

  useLayoutEffect(() => {
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
  }, [navigation, setSearch]);

  if (debouncedSearch && debouncedSearch.length >= 3) {
    return <SearchResults session={session} searchQuery={debouncedSearch} />;
  } else {
    return <FullLibrary session={session} />;
  }
}
