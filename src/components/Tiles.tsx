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

import {
  DownloadedThumbnails,
  PlaythroughStatus,
  PlaythroughWithMedia,
  Thumbnails,
} from "@/services/library-service";
import { Colors, interactive, surface } from "@/styles/colors";
import {
  Edition,
  EditionMedia,
  stackedRepresentatives,
  toEditions,
} from "@/utils/editions";
import {
  useNavigateToBookCallback,
  useNavigateToMediaCallback,
} from "@/utils/hooks";
import { partsLabel, recordingTitle } from "@/utils/titles";

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

/**
 * Check if any media in a list is on the saved-for-later shelf.
 */
function isAnyMediaOnSavedShelf(
  media: { isOnSavedShelf?: boolean }[],
): boolean {
  return media.some((m) => m.isOnSavedShelf);
}

type Media = {
  id: string;
  title?: string | null;
  thumbnails: Thumbnails | null;
  narrators: {
    name: string;
  }[];
  download?: {
    thumbnails: DownloadedThumbnails | null;
  } | null;
  playthroughStatus?: PlaythroughStatus | null;
  isOnSavedShelf?: boolean;
};

/** A recording a book tile can collapse into editions. */
type StackableMedia = Media & EditionMedia;

/** What a set needs to describe itself on its own tile. */
type SetInfo = {
  id: string;
  partsTotal: number | null;
  partWord: string | null;
  partWordPlural: string | null;
};

/** A recording that knows which set it belongs to, if any. */
export type EditionTileMedia = StackableMedia & { set: SetInfo | null };

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
type BookProp = Book & { media: StackableMedia[] };
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
  isOnSavedShelf?: boolean;
};

type TileImageProps = {
  media: Media[];
  seriesBook?: SeriesBook;
  playthroughStatus?: PlaythroughStatus | null;
  isOnSavedShelf?: boolean;
};

type TileTextProps = {
  book: Book;
  media: Media[];
};

type EditionTileProps = {
  edition: Edition<EditionTileMedia>;
  book: Book;
  style?: StyleProp<ViewStyle>;
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
      isOnSavedShelf={media.isOnSavedShelf}
    />
  );
});

/**
 * A book, collapsed to one cover per edition.
 *
 * The recursive collapse means a book tile shows editions, not recordings: a
 * book whose only edition is a three-part set is one cover, not three, and the
 * set only fans out where it is the tile. Handing `Tile` the representatives
 * also gives it the right click target for free — a lone edition leaves one
 * entry, so the tile goes straight to it and skips the book screen.
 */
export const BookTile = React.memo(function BookTile(props: BookTileProps) {
  const { book, style } = props;
  const covers = useEditionCovers(book.media);

  if (covers.length === 0) return null;

  return (
    <Tile
      book={book}
      media={covers}
      style={style}
      playthroughStatus={getBestPlaythroughStatus(book.media)}
      isOnSavedShelf={isAnyMediaOnSavedShelf(book.media)}
    />
  );
});

export const SeriesBookTile = React.memo(function SeriesBookTile(
  props: SeriesBookTileProps,
) {
  const { seriesBook, style } = props;
  const covers = useEditionCovers(seriesBook.book.media);

  if (covers.length === 0) return null;

  return (
    <Tile
      book={seriesBook.book}
      media={covers}
      seriesBook={seriesBook}
      style={style}
      playthroughStatus={getBestPlaythroughStatus(seriesBook.book.media)}
      isOnSavedShelf={isAnyMediaOnSavedShelf(seriesBook.book.media)}
    />
  );
});

/**
 * One edition, rendered as itself.
 *
 * This is the one place a set fans out: its parts stack in part order, part 1
 * facing front, under the book's title and a count of its parts. Everywhere
 * else a set is one cover inside a larger stack. Either kind opens the
 * recording it stands for — for a set that is its first part, whose screen
 * carries the rest of the set.
 */
export const EditionTile = React.memo(function EditionTile(
  props: EditionTileProps,
) {
  const { edition, book, style } = props;
  const set = edition.kind === "set" ? edition.representative.set : null;

  const navigateToEdition = useNavigateToMediaCallback(
    edition.representative,
    book,
  );

  return (
    <Pressable onPress={navigateToEdition}>
      <View style={[styles.container, style]}>
        <TileImage
          media={edition.media}
          playthroughStatus={getBestPlaythroughStatus(edition.media)}
          isOnSavedShelf={isAnyMediaOnSavedShelf(edition.media)}
        />
        <View>
          <BookDetailsText
            baseFontSize={16}
            title={
              set
                ? book.title
                : recordingTitle(edition.representative.title, book.title)
            }
            narrators={
              set
                ? undefined
                : edition.representative.narrators.map((n) => n.name)
            }
          />
          {set && (
            <Text style={styles.partsLabel} numberOfLines={1}>
              {partsLabel(set, edition.media.length)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

function useEditionCovers(media: StackableMedia[]) {
  return React.useMemo(
    () => stackedRepresentatives(toEditions(media)),
    [media],
  );
}

/**
 * The tile every stack is built from.
 *
 * `media` arrives already collapsed and in front-to-back order: index 0 is the
 * cover that faces the reader and the thing the tile stands for. One entry
 * means the tile navigates straight to that recording; several mean it stands
 * for the book as a whole and opens the book screen.
 */
export const Tile = React.memo(function Tile(props: TileProps) {
  const { book, media, seriesBook, style, playthroughStatus, isOnSavedShelf } =
    props;
  const navigateToBook = useNavigateToBookCallback(book, media);

  return (
    <Pressable onPress={navigateToBook}>
      <View style={[styles.container, style]}>
        <TileImage
          media={media}
          seriesBook={seriesBook}
          playthroughStatus={playthroughStatus}
          isOnSavedShelf={isOnSavedShelf}
        />
        <TileText book={book} media={media} />
      </View>
    </Pressable>
  );
});

export const TileImage = React.memo(function TileImage(props: TileImageProps) {
  const { media, seriesBook, playthroughStatus, isOnSavedShelf } = props;

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
        {isOnSavedShelf && <SavedForLaterBadge />}
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

const SavedForLaterBadge = React.memo(function SavedForLaterBadge() {
  return (
    <View style={styles.savedBadge}>
      <FontAwesome6 name="bookmark" size={18} color={Colors.zinc[300]} solid />
    </View>
  );
});

export const TileText = React.memo(function TileText(props: TileTextProps) {
  const { book, media } = props;

  return (
    <View>
      <BookDetailsText
        baseFontSize={16}
        title={
          // a recording's own title only applies when it is the only one shown;
          // a book tile covering several recordings goes by the book's title
          media[0] && media.length === 1
            ? recordingTitle(media[0].title, book.title)
            : book.title
        }
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
        title: recordingTitle(
          playthrough.media.title,
          playthrough.media.book.title,
        ),
      },
    });
  }, [
    playthrough.media.id,
    playthrough.media.title,
    playthrough.media.book.title,
  ]);

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
          {percent !== false && <ProgressBar percent={percent} />}
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
  // sits under the title in a tile's text block, so it lines up with it
  // rather than centring like a person tile's label
  partsLabel: {
    fontSize: 12,
    color: Colors.zinc[400],
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
    backgroundColor: interactive.fill,
    borderWidth: 0.5,
    borderColor: surface.elevated,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  savedBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: interactive.fill,
    borderWidth: 0.5,
    borderColor: surface.elevated,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});
