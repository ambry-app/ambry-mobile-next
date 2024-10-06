import { BookAuthor, MediaForIndex } from "@/src/db/library";
import type { Thumbnails } from "@/src/db/schema";
import { useSessionStore } from "@/src/stores/session";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, TouchableOpacity, View } from "react-native";

function MediaImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const session = useSessionStore((state) => state.session);

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

function AuthorList({ bookAuthors }: { bookAuthors: BookAuthor[] }) {
  return (
    <Text className="text-md text-zinc-400 leading-tight" numberOfLines={2}>
      {bookAuthors.map((bookAuthor, i) => [
        i > 0 && ", ",
        <Text key={i}>{bookAuthor.author.name}</Text>,
      ])}
    </Text>
  );
}

export default function MediaTile({ media }: { media: MediaForIndex }) {
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
          <AuthorList bookAuthors={media.book.bookAuthors} />
        </TouchableOpacity>
      </Link>
    </View>
  );
}
