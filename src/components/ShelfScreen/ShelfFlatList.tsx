import { Session } from "@/src/stores/session";
import { FlatList, StyleSheet, View } from "react-native";
import InProgress from "./InProgress";
import NowPlaying from "./NowPlaying";

// sections:
// 1. now listening
// 2. in-progress
// 3. saved for later (coming soon)
// 4. finished (maybe skip this one)

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
          return <InProgress session={props.session} />;
        return null;
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  separator: {
    height: 32,
  },
});
