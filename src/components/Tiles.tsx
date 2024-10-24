import MultiThumbnailImage, {
  MultiThumbnailImageNoTW,
} from "@/src/components/MultiThumbnailImage";
import NamesList from "@/src/components/NamesList";
import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { PressableScale } from "react-native-pressable-scale";
import ThumbnailImage, { ThumbnailImageNoTW } from "./ThumbnailImage";

type Media = {
  id: string;
  thumbnails: Thumbnails | null;
  mediaNarrators: {
    narrator: {
      name: string;
    };
  }[];
  download: {
    thumbnails: DownloadedThumbnails | null;
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

type MediaTileProps = { media: MediaProp; className?: string };

export function MediaTile({ media, className }: MediaTileProps) {
  return <Tile book={media.book} media={[media]} className={className} />;
}

type BookTileProps = { book: BookProp; className?: string };

export function BookTile({ book, className }: BookTileProps) {
  if (book.media.length === 0) return null;
  return <Tile book={book} media={book.media} className={className} />;
}

type SeriesBookTileProps = { seriesBook: SeriesBookProp; className?: string };

export function SeriesBookTile({ seriesBook, className }: SeriesBookTileProps) {
  if (seriesBook.book.media.length === 0) return null;
  return (
    <Tile
      book={seriesBook.book}
      media={seriesBook.book.media}
      seriesBook={seriesBook}
      className={className}
    />
  );
}

type TileProps = {
  book: Book;
  media: Media[];
  seriesBook?: SeriesBook;
  className?: string;
};

export function Tile({ book, media, seriesBook, className }: TileProps) {
  const router = useRouter();

  const navigateToBook = () => {
    if (media.length === 1) {
      router.push({
        pathname: "/media/[id]",
        params: { id: media[0].id, title: book.title },
      });
    } else {
      router.push({
        pathname: "/book/[id]",
        params: { id: book.id, title: book.title },
      });
    }
  };

  return (
    <View className={(className || "") + " flex gap-3"}>
      <View className="gap-1">
        {seriesBook && (
          <Text className="text-lg text-zinc-100 font-medium" numberOfLines={1}>
            Book {seriesBook.bookNumber}
          </Text>
        )}
        <PressableScale weight="light" onPress={navigateToBook}>
          <MultiThumbnailImageNoTW
            thumbnailPairs={media.map((m) => ({
              thumbnails: m.thumbnails,
              downloadedThumbnails: m.download?.thumbnails || null,
            }))}
            size="large"
            // className="rounded-lg aspect-square"
            style={{ aspectRatio: 1, borderRadius: 8 }}
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

type PersonTileProps = {
  personId: string;
  name: string;
  realName: string;
  thumbnails: Thumbnails | null;
  label: string;
};

export function PersonTile({
  personId,
  name,
  realName,
  thumbnails,
  label,
}: PersonTileProps) {
  const router = useRouter();

  const navigateToPerson = () => {
    router.push({
      pathname: "/person/[id]",
      params: { id: personId, title: realName },
    });
  };

  return (
    <View className="flex gap-3">
      <PressableScale weight="light" onPress={navigateToPerson}>
        <ThumbnailImageNoTW
          thumbnails={thumbnails}
          size="large"
          style={{ aspectRatio: 1, borderRadius: 9999 }}
        />
      </PressableScale>
      <TouchableOpacity onPress={navigateToPerson}>
        <View>
          <Text
            className="text-lg text-zinc-100 font-medium text-center leading-tight"
            numberOfLines={1}
          >
            {name}
          </Text>
          {realName !== name && (
            <Text
              className="text-zinc-300 text-center leading-tight"
              numberOfLines={1}
            >
              ({realName})
            </Text>
          )}
          <Text className="text-sm text-zinc-400 text-center leading-tight">
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
