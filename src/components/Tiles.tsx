import React, { useCallback } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";

import { PlaythroughWithMedia } from "@/db/library";
import {
  DownloadedThumbnails,
  PlaythroughStatus,
  Thumbnails,
} from "@/db/schema";
import useNavigateToBookCallback from "@/hooks/use-navigate-to-book-callback";
import { Colors } from "@/styles";

import { BookDetailsText } from "./BookDetailsText";
import { MultiThumbnailImage } from "./MultiThumbnailImage";
import { ProgressBar } from "./ProgressBar";
import { ThumbnailImage } from "./ThumbnailImage";

/**
 * Get the most relevant playthrough status from a list of media.
 * Priority: in_progress > finished > abandoned
 */
function getBestPlaythroughStatus(
  media: { playthroughStatus?: PlaythroughStatus | null }[],
): PlaythroughStatus | null {
  const statuses = media
    .map((m) => m.playthroughStatus)
    .filter((s): s is PlaythroughStatus => s != null);
  if (statuses.includes("in_progress")) return "in_progress";
  if (statuses.includes("finished")) return "finished";
  if (statuses.includes("abandoned")) return "abandoned";
  return null;
}

type Media = {
  id: string;
  thumbnails: Thumbnails | null;
  narrators: {
    name: string;
  }[];
  download?: {
    thumbnails: DownloadedThumbnails | null;
  } | null;
  playthroughStatus?: PlaythroughStatus | null;
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

type MediaTileProps = {
  media: MediaProp;
  style?: StyleProp<ViewStyle>;
};
type BookTileProps = {
  book: BookProp;
  style?: StyleProp<ViewStyle>;
};
type SeriesBookTileProps = {
  seriesBook: SeriesBookProp;
  style?: StyleProp<ViewStyle>;
};

type TileProps = {
  book: Book;
  media: Media[];
  seriesBook?: SeriesBook;
  style?: StyleProp<ViewStyle>;
  playthroughStatus?: PlaythroughStatus | null;
};

type TileImageProps = {
  media: Media[];
  seriesBook?: SeriesBook;
  playthroughStatus?: PlaythroughStatus | null;
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
  return (
    <Tile
      book={media.book}
      media={[media]}
      style={style}
      playthroughStatus={media.playthroughStatus}
    />
  );
});

export const BookTile = React.memo(function BookTile(props: BookTileProps) {
  const { book, style } = props;
  if (book.media.length === 0) return null;
  return (
    <Tile
      book={book}
      media={book.media}
      style={style}
      playthroughStatus={getBestPlaythroughStatus(book.media)}
    />
  );
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
      playthroughStatus={getBestPlaythroughStatus(seriesBook.book.media)}
    />
  );
});

export const Tile = React.memo(function Tile(props: TileProps) {
  const { book, media, seriesBook, style, playthroughStatus } = props;
  const navigateToBook = useNavigateToBookCallback(book, media);

  return (
    <Pressable onPress={navigateToBook}>
      <View style={[styles.container, style]}>
        <TileImage
          media={media}
          seriesBook={seriesBook}
          playthroughStatus={playthroughStatus}
        />
        <TileText book={book} media={media} />
      </View>
    </Pressable>
  );
});

export const TileImage = React.memo(function TileImage(props: TileImageProps) {
  const { media, seriesBook, playthroughStatus } = props;

  return (
    <View style={styles.tileImageContainer}>
      {seriesBook && (
        <Text style={styles.bookNumber} numberOfLines={1}>
          Book {seriesBook.bookNumber}
        </Text>
      )}
      <View>
        <MultiThumbnailImage
          thumbnailPairs={media.map((m) => ({
            thumbnails: m.thumbnails,
            downloadedThumbnails: m.download?.thumbnails || null,
          }))}
          size="large"
          style={styles.bookThumbnail}
        />
        {playthroughStatus && (
          <PlaythroughStatusBadge status={playthroughStatus} />
        )}
      </View>
    </View>
  );
});

type PlaythroughStatusBadgeProps = {
  status: PlaythroughStatus;
};

const PlaythroughStatusBadge = React.memo(function PlaythroughStatusBadge(
  props: PlaythroughStatusBadgeProps,
) {
  const { status } = props;

  const iconName =
    status === "finished"
      ? "check"
      : status === "in_progress"
        ? "book-open"
        : "xmark"; // abandoned

  return (
    <View style={styles.badge}>
      <FontAwesome6 name={iconName} size={18} color={Colors.zinc[300]} solid />
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
  badge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.zinc[800],
    borderWidth: 0.5,
    borderColor: Colors.zinc[900],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});
