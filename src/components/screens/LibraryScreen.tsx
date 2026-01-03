import { useLayoutEffect, useState } from "react";
import { useNavigation } from "expo-router";

import {
  FullLibrary,
  SearchResults,
} from "@/components/screens/library-screen";
import { useDebounce } from "@/hooks/use-debounce";
import { Colors } from "@/styles";
import { Session } from "@/types/session";

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
        hintTextColor: Colors.zinc["500"],
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
