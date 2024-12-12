import { Session } from "@/src/stores/session";
import { ScrollView, StyleSheet } from "react-native";
import InProgress from "./InProgress";
import NowPlaying from "./NowPlaying";

// sections:
// 1. now listening
// 2. in-progress
// 3. saved for later (coming soon)
// 4. finished (maybe skip this one)

type ShelfScrollViewProps = {
  session: Session;
};

export default function ShelfScrollView(props: ShelfScrollViewProps) {
  const { session } = props;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
    >
      <NowPlaying session={session} />
      <InProgress />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});
