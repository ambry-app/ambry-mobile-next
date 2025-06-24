import { Loading, MediaTile, ScreenCentered } from "@/src/components";
import { useMediaByBookTitleSearch, useMediaList } from "@/src/db/library";
import { syncDown, useLastDownSync } from "@/src/db/sync";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useDebounce } from "use-debounce";

type LibraryFlatListProps = {
  session: Session;
};

export default function LibraryFlatList({ session }: LibraryFlatListProps) {
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
    return <SearchResultsFlatList session={session} searchQuery={search} />;
  } else {
    return <FullLibraryFlatList session={session} />;
  }
}

type FullLibraryFlatListProps = {
  session: Session;
};

function FullLibraryFlatList({ session }: FullLibraryFlatListProps) {
  const { media, updatedAt, opacity } = useMediaList(session);
  const lastDownSync = useLastDownSync(session);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDown(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  if (!lastDownSync || !updatedAt) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  if (updatedAt && lastDownSync && media.length === 0) {
    return (
      <Text style={styles.text}>
        Your library is empty. Log into the server on the web and add some
        audiobooks to get started!
      </Text>
    );
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.flatlist, { opacity }]}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <MediaTile style={styles.tile} media={item} />}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

type SearchResultsFlatListProps = {
  session: Session;
  searchQuery: string;
};

function SearchResultsFlatList(props: SearchResultsFlatListProps) {
  const { session, searchQuery } = props;
  const { media, updatedAt, opacity } = useMediaByBookTitleSearch(
    session,
    searchQuery,
  );
  const lastDownSync = useLastDownSync(session);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDown(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  if (!lastDownSync || !updatedAt) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  if (updatedAt && lastDownSync && media.length === 0) {
    return (
      <Text style={styles.text}>
        Nothing in the library matches your search term. Search is very basic
        right now and only matches on book titles. Please try another search.
      </Text>
    );
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.flatlist, { opacity }]}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <MediaTile style={styles.tile} media={item} />}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
