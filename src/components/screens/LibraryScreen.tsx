import {
  FullLibrary,
  SearchResults,
} from "@/src/components/screens/library-screen";
import { useDebounce } from "@/src/hooks/use-debounce";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { useNavigation } from "expo-router";
import { useLayoutEffect, useState } from "react";

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
