import React, { useCallback } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { router } from "expo-router";

import { PlaythroughWithMedia } from "@/db/library";
import { DownloadedThumbnails, Thumbnails } from "@/db/schema";
import useNavigateToBookCallback from "@/hooks/use-navigate-to-book-callback";
import { Colors } from "@/styles";

import { BookDetailsText } from "./BookDetailsText";
import { MultiThumbnailImage } from "./MultiThumbnailImage";
import { ProgressBar } from "./ProgressBar";
import { ThumbnailImage } from "./ThumbnailImage";

type Media = {
  id: string;
  thumbnails: Thumbnails | null;
  narrators: {
    name: string;
  }[];
  download?: {
    thumbnails: DownloadedThumbnails | null;
  } | null;
};

type Book = {
  id: string;
  title: string;
  authors: {
    name: string;
  }[];
};

type SeriesBook = {
  id: string;
  bookNumber: string;
};

type MediaProp = Media & { book: Book };
type BookProp = Book & { media: Media[] };
type SeriesBookProp = SeriesBook & { book: BookProp };

type MediaTileProps = { media: MediaProp; style?: StyleProp<ViewStyle> };
type BookTileProps = { book: BookProp; style?: StyleProp<ViewStyle> };
type SeriesBookTileProps = {
  seriesBook: SeriesBookProp;
  style?: StyleProp<ViewStyle>;
};

type TileProps = {
  book: Book;
  media: Media[];
  seriesBook?: SeriesBook;
  style?: StyleProp<ViewStyle>;
};

type TileImageProps = {
  media: Media[];
  seriesBook?: SeriesBook;
};

type TileTextProps = {
  book: Book;
  media: Media[];
};

type PersonTileProps = {
  personId: string;
  name: string;
  realName: string;
  thumbnails: Thumbnails | null;
  label: string;
  style?: StyleProp<ViewStyle>;
};

type PlaythroughTileProps = {
  playthrough: PlaythroughWithMedia;
  style?: StyleProp<ViewStyle>;
};

export const MediaTile = React.memo(function MediaTile(props: MediaTileProps) {
  const { media, style } = props;
  const tile = <Tile book={media.book} media={[media]} style={style} />;
  return tile;
});

export const BookTile = React.memo(function BookTile(props: BookTileProps) {
  const { book, style } = props;
  if (book.media.length === 0) return null;
  return <Tile book={book} media={book.media} style={style} />;
});

export const SeriesBookTile = React.memo(function SeriesBookTile(
  props: SeriesBookTileProps,
) {
  const { seriesBook, style } = props;
  if (seriesBook.book.media.length === 0) return null;
  return (
    <Tile
      book={seriesBook.book}
      media={seriesBook.book.media}
      seriesBook={seriesBook}
      style={style}
    />
  );
});

export const Tile = React.memo(function Tile(props: TileProps) {
  const { book, media, seriesBook, style } = props;
  const navigateToBook = useNavigateToBookCallback(book, media);

  return (
    <Pressable onPress={navigateToBook}>
      <View style={[styles.container, style]}>
        <TileImage media={media} seriesBook={seriesBook} />
        <TileText book={book} media={media} />
      </View>
    </Pressable>
  );
});

export const TileImage = React.memo(function TileImage(props: TileImageProps) {
  const { media, seriesBook } = props;

  return (
    <View style={styles.tileImageContainer}>
      {seriesBook && (
        <Text style={styles.bookNumber} numberOfLines={1}>
          Book {seriesBook.bookNumber}
        </Text>
      )}
      <MultiThumbnailImage
        thumbnailPairs={media.map((m) => ({
          thumbnails: m.thumbnails,
          downloadedThumbnails: m.download?.thumbnails || null,
        }))}
        size="large"
        style={styles.bookThumbnail}
      />
    </View>
  );
});

export const TileText = React.memo(function TileText(props: TileTextProps) {
  const { book, media } = props;

  return (
    <View>
      <BookDetailsText
        baseFontSize={16}
        title={book.title}
        authors={book.authors.map((author) => author.name)}
        narrators={
          // only show narrators if there is exactly one media
          media[0] && media.length === 1
            ? media[0].narrators.map((narrator) => narrator.name)
            : undefined
        }
      />
    </View>
  );
});

export const PersonTile = React.memo(function PersonTile(
  props: PersonTileProps,
) {
  const { personId, name, realName, thumbnails, label, style } = props;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: personId, title: realName },
    });
  };

  return (
    <Pressable onPress={navigateToPerson}>
      <View style={[styles.container, style]}>
        <ThumbnailImage
          thumbnails={thumbnails}
          size="large"
          style={styles.personThumbnail}
        />
        <View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {realName !== name && (
            <Text style={styles.realName} numberOfLines={1}>
              ({realName})
            </Text>
          )}
          <Text style={styles.label}>{label}</Text>
        </View>
      </View>
    </Pressable>
  );
});

export const PlaythroughTile = React.memo(function PlaythroughTile(
  props: PlaythroughTileProps,
) {
  const { playthrough, style } = props;
  const duration = playthrough.media.duration
    ? Number(playthrough.media.duration)
    : false;
  const percent = duration ? (playthrough.position / duration) * 100 : false;

  const navigateToMedia = useCallback(() => {
    router.navigate({
      pathname: "/media/[id]",
      params: {
        id: playthrough.media.id,
        title: playthrough.media.book.title,
      },
    });
  }, [playthrough.media.id, playthrough.media.book.title]);

  return (
    <Pressable onPress={navigateToMedia}>
      <View style={[styles.playthroughContainer, style]}>
        <View>
          <ThumbnailImage
            thumbnails={playthrough.media.thumbnails}
            downloadedThumbnails={playthrough.media.download?.thumbnails}
            size="large"
            style={styles.playthroughThumbnail}
          />
          {duration !== false && (
            <ProgressBar position={playthrough.position} duration={duration} />
          )}
          {percent !== false && (
            <Text style={styles.progressText} numberOfLines={1}>
              {percent.toFixed(1)}%
            </Text>
          )}
        </View>
        <TileText book={playthrough.media.book} media={[playthrough.media]} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 12,
  },
  playthroughContainer: {
    display: "flex",
    gap: 4,
  },
  tileImageContainer: {
    display: "flex",
    gap: 4,
  },
  bookThumbnail: {
    aspectRatio: 1,
    borderRadius: 8,
  },
  personThumbnail: {
    aspectRatio: 1,
    borderRadius: 999,
  },
  playthroughThumbnail: {
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bookNumber: {
    fontSize: 16,
    fontWeight: 500,
    color: Colors.zinc[100],
  },
  name: {
    fontSize: 16,
    fontWeight: 500,
    color: Colors.zinc[100],
    textAlign: "center",
  },
  realName: {
    fontSize: 14,
    color: Colors.zinc[300],
    textAlign: "center",
  },
  label: {
    fontSize: 12,
    color: Colors.zinc[400],
    textAlign: "center",
  },
  progressText: {
    fontSize: 14,
    color: Colors.zinc[400],
    textAlign: "center",
  },
});
