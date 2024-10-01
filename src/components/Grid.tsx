import { Media } from "@/src/app/(tabs)/(index)";
import { FlatList } from "react-native";
import MediaTile from "./Grid/MediaTile";

export default function Grid({ media }: { media: Media[] }) {
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
