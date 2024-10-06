import { MediaForIndex } from "@/src/db/library";
import { FlatList } from "react-native";
import MediaTile from "./Grid/MediaTile";

export default function Grid({ media }: { media: MediaForIndex[] }) {
  return (
    <FlatList
      className="p-2"
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <MediaTile media={item} />}
    />
  );
}
