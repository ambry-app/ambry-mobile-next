import { FlatList } from "react-native";

import { LoadedMedia } from "@/app/(app)";
import MediaTile from "./Grid/MediaTile";

export default function Grid({ media }: { media: LoadedMedia[] }) {
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
