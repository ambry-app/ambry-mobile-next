import MultiThumbnailImage from "@/src/components/MultiThumbnailImage";
import NamesList from "@/src/components/NamesList";
import * as schema from "@/src/db/schema";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { PressableScale } from "react-native-pressable-scale";

type Media = {
  id: string;
  thumbnails: schema.Thumbnails | null;
  mediaNarrators: {
    narrator: {
      name: string;
    };
  }[];
  download: {
    thumbnails: schema.DownloadedThumbnails | null;
  } | null;
};

type Book = {
  id: string;
  title: string;
  bookAuthors: {
    author: {
      name: string;
    };
  }[];
};

type SeriesBook = {
  id: string;
  bookNumber: string;
};

type MediaProp = Media & { book: Book };
type BookProp = Book & { media: Media[] };
type SeriesBookProp = SeriesBook & { book: BookProp };

export default function BookTile({
  book: givenBook,
  media: givenMedia,
  seriesBook,
}: {
  book?: BookProp;
  media?: MediaProp;
  seriesBook?: SeriesBookProp;
}) {
  const router = useRouter();

  const book: Book | undefined =
    givenBook || givenMedia?.book || seriesBook?.book;
  const media: Media[] | undefined = givenMedia
    ? [givenMedia]
    : givenBook?.media || seriesBook?.book.media;

  if (!book || !media || media.length === 0) return null;

  const navigateToBook = () => {
    if (media.length === 1) {
      router.push({
        pathname: "/media/[id]",
        params: { id: media[0].id },
      });
    } else {
      router.push({
        pathname: "/book/[id]",
        params: { id: book.id },
      });
    }
  };

  return (
    <View className="flex gap-3">
      <View className="gap-1">
        {seriesBook && (
          <Text className="text-lg text-zinc-100 font-medium" numberOfLines={1}>
            Book {seriesBook.bookNumber}
          </Text>
        )}
        <PressableScale weight="light" onPress={navigateToBook}>
          <MultiThumbnailImage
            thumbnailPairs={media.map((m) => ({
              thumbnails: m.thumbnails,
              downloadedThumbnails: m.download?.thumbnails || null,
            }))}
            size="large"
            className="rounded-lg aspect-square"
          />
        </PressableScale>
      </View>
      <TouchableOpacity onPress={navigateToBook}>
        <View>
          <Text
            className="text-lg leading-tight font-medium text-zinc-100"
            numberOfLines={1}
          >
            {book.title}
          </Text>
          <NamesList
            names={book.bookAuthors.map((ba) => ba.author.name)}
            className="text-zinc-300 leading-tight"
            numberOfLines={1}
          />
          {media.length === 1 && (
            <NamesList
              prefix="Read by"
              names={media[0].mediaNarrators.map((mn) => mn.narrator.name)}
              className="text-sm text-zinc-400 leading-tight"
              numberOfLines={1}
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}
