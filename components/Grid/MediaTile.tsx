import { Pressable, Text, TouchableOpacity, View } from "react-native";

import { Image } from "expo-image";

import { useSession } from "@/contexts/session";
import type { Thumbnails } from "@/db/schema";
import { Link } from "expo-router";

export type MediaTileMedia = {
  id: string;
  book: {
    title: string;
    bookAuthors: {
      author: { id: string; name: string; person: { id: string } };
    }[];
    seriesBooks: {
      series: { id: string; name: string };
      bookNumber: string;
    }[];
  };
  thumbnails: Thumbnails | null;
};

type MediaTileProps = {
  media: MediaTileMedia;
};

function MediaImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const { session } = useSession();

  if (!thumbnails) {
    return <View className="w-full" style={{ aspectRatio: 1 / 1 }} />;
  }

  const source = {
    uri: `${session!.url}/${thumbnails.large}`,
    headers: { Authorization: `Bearer ${session!.token}` },
  };
  const placeholder = { thumbhash: thumbnails.thumbhash };

  return (
    <Image
      source={source}
      className="w-full"
      style={{ aspectRatio: 1 / 1 }}
      placeholder={placeholder}
      contentFit="cover"
      transition={250}
    />
  );
}

export default function MediaTile({ media }: MediaTileProps) {
  const basicAuthorsList = (
    <Text className="text-md text-zinc-400 leading-tight" numberOfLines={2}>
      {media.book.bookAuthors.map((bookAuthor, i) => [
        i > 0 && ", ",
        <Text key={i}>{bookAuthor.author.name}</Text>,
      ])}
    </Text>
  );

  return (
    <View className="p-2 w-1/2 mb-2">
      <View className="rounded-lg bg-zinc-800 mb-3 overflow-hidden">
        <Link
          href={{
            pathname: "/media/[id]",
            params: { id: media.id },
          }}
          asChild
        >
          <Pressable>
            <View>
              <MediaImage thumbnails={media.thumbnails} />
            </View>
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
            className="text-lg leading-5 font-medium text-zinc-100 mb-1"
            numberOfLines={2}
          >
            {media.book.title}
          </Text>
          {basicAuthorsList}
        </TouchableOpacity>
      </Link>
    </View>
  );
}
