import { FullLibrary, SearchResults } from "@/src/components/library";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { useDebounce } from "use-debounce";

type LibraryProps = {
  session: Session;
};

export function Library({ session }: LibraryProps) {
  const [search, setSearch] = useDebounce("", 500);
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

  if (search && search.length >= 3) {
    return <SearchResults session={session} searchQuery={search} />;
  } else {
    return <FullLibrary session={session} />;
  }
}
