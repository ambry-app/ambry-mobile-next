import { Session } from "@/src/stores/session";
import { FlatList, StyleSheet, View } from "react-native";
import NowPlaying from "./NowPlaying";
import RecentInProgress from "./RecentInProgress";

// sections:
// 1. now listening
// 2. in-progress
// 3. saved for later (coming soon)
// 4. finished (coming soon)

type ShelfFlatListProps = {
  session: Session;
};

export default function ShelfFlatList(props: ShelfFlatListProps) {
  const sections = ["now_playing", "in_progress"];

  return (
    <FlatList
      style={styles.container}
      data={sections}
      keyExtractor={(item) => item}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListFooterComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        if (item === "now_playing")
          return <NowPlaying session={props.session} />;
        if (item === "in_progress")
          return <RecentInProgress session={props.session} />;
        return null;
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {},
  separator: {
    height: 32,
  },
});
