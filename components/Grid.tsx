import { FlatList } from "react-native";
import MediaTile from "./Grid/MediaTile";

// import PersonLink from "./Grid/PersonLink";
// import SeriesLink from "./Grid/SeriesLink";

import type { MediaTileMedia } from "./Grid/MediaTile";

export default function Grid({ media }: { media: MediaTileMedia[] }) {
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
