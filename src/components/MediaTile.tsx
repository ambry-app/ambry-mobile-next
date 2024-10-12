import { MediaForIndex } from "@/src/db/library";
import { Link } from "expo-router";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import MediaImage from "./MediaImage";
import NamesList from "./NamesList";

export default function MediaTile({ media }: { media: MediaForIndex }) {
  return (
    <View className="p-2 w-1/2 mb-2">
      <View className="mb-3">
        <Link
          href={{
            pathname: "/media/[id]",
            params: { id: media.id },
          }}
          asChild
        >
          <Pressable>
            <MediaImage
              thumbnails={media.thumbnails}
              size="large"
              className="w-full rounded-lg aspect-square"
            />
          </Pressable>
        </Link>
      </View>
      <Link
        href={{
          pathname: "/media/[id]",
          params: { id: media.id },
        }}
        asChild
      >
        <TouchableOpacity>
          <Text
            className="text-lg leading-tight font-medium text-zinc-100"
            numberOfLines={1}
          >
            {media.book.title}
          </Text>
          <NamesList
            names={media.book.bookAuthors.map((ba) => ba.author.name)}
            className="text-md text-zinc-300 leading-tight"
            numberOfLines={1}
          />
          <NamesList
            prefix="Narrated by"
            names={media.mediaNarrators.map((mn) => mn.narrator.name)}
            className="text-sm text-zinc-400 leading-tight"
            numberOfLines={1}
          />
        </TouchableOpacity>
      </Link>
    </View>
  );
}
