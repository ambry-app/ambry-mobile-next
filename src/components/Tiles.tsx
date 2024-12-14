import { DownloadedThumbnails, Thumbnails } from "@/src/db/schema";
import { syncDownUser } from "@/src/db/sync";
import {
  loadMedia,
  prepareToLoadMedia,
  requestExpandPlayer,
} from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { router } from "expo-router";
import { useCallback } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import BookDetailsText from "./BookDetailsText";
import IconButton from "./IconButton";
import MultiThumbnailImage from "./MultiThumbnailImage";
import { PressableScale } from "./PressableScale";
import ProgressBar from "./ProgressBar";
import ThumbnailImage from "./ThumbnailImage";

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

type PlayerState = {
  position: number;
  playbackRate: number;
};

type MediaProp = Media & { book: Book };
type BookProp = Book & { media: Media[] };
type SeriesBookProp = SeriesBook & { book: BookProp };
type MediaWithPlayerStateProp = MediaProp & {
  playerState: PlayerState;
  duration: string | null;
};

type MediaTileProps = { media: MediaProp; style?: StyleProp<ViewStyle> };
type BookTileProps = { book: BookProp; style?: StyleProp<ViewStyle> };
type SeriesBookTileProps = {
  seriesBook: SeriesBookProp;
  style?: StyleProp<ViewStyle>;
};
type PlayerStateTileProps = {
  session: Session;
  media: MediaWithPlayerStateProp;
  style?: StyleProp<ViewStyle>;
};

type TileProps = {
  book: Book;
  media: Media[];
  seriesBook?: SeriesBook;
  style?: StyleProp<ViewStyle>;
};

type TileImageProps = {
  book: Book;
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

export function MediaTile({ media, style }: MediaTileProps) {
  return <Tile book={media.book} media={[media]} style={style} />;
}

export function BookTile({ book, style }: BookTileProps) {
  if (book.media.length === 0) return null;
  return <Tile book={book} media={book.media} style={style} />;
}

export function SeriesBookTile({ seriesBook, style }: SeriesBookTileProps) {
  if (seriesBook.book.media.length === 0) return null;
  return (
    <Tile
      book={seriesBook.book}
      media={seriesBook.book.media}
      seriesBook={seriesBook}
      style={style}
    />
  );
}

export function Tile({ book, media, seriesBook, style }: TileProps) {
  return (
    <View style={[styles.container, style]}>
      <TileImage book={book} media={media} seriesBook={seriesBook} />
      <TileText book={book} media={media} />
    </View>
  );
}

export function TileImage(props: TileImageProps) {
  const { book, media, seriesBook } = props;
  const navigateToBook = useNavigateToBookCallback(book, media);

  return (
    <View style={styles.tileImageContainer}>
      {seriesBook && (
        <Text style={styles.bookNumber} numberOfLines={1}>
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
          style={styles.bookThumbnail}
        />
      </PressableScale>
    </View>
  );
}

export function TileText({ book, media }: TileTextProps) {
  const navigateToBook = useNavigateToBookCallback(book, media);

  return (
    <TouchableOpacity onPress={navigateToBook}>
      <View>
        <BookDetailsText
          baseFontSize={16}
          title={book.title}
          authors={book.bookAuthors.map((ba) => ba.author.name)}
          narrators={
            media.length === 1
              ? media[0].mediaNarrators.map((mn) => mn.narrator.name)
              : undefined
          }
        />
      </View>
    </TouchableOpacity>
  );
}

function useNavigateToBookCallback(book: Book, media: Media[]) {
  return useCallback(() => {
    if (media.length === 1) {
      router.navigate({
        pathname: "/media/[id]",
        params: { id: media[0].id, title: book.title },
      });
    } else {
      router.navigate({
        pathname: "/book/[id]",
        params: { id: book.id, title: book.title },
      });
    }
  }, [book, media]);
}

export function PersonTile(props: PersonTileProps) {
  const { personId, name, realName, thumbnails, label, style } = props;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: personId, title: realName },
    });
  };

  return (
    <View style={[styles.container, style]}>
      <PressableScale weight="light" onPress={navigateToPerson}>
        <ThumbnailImage
          thumbnails={thumbnails}
          size="large"
          style={styles.personThumbnail}
        />
      </PressableScale>
      <TouchableOpacity onPress={navigateToPerson}>
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
      </TouchableOpacity>
    </View>
  );
}

export function PlayerStateTile(props: PlayerStateTileProps) {
  const { media, style, session } = props;
  const loadBookIntoPlayer = async () => {
    requestExpandPlayer();
    prepareToLoadMedia();
    setTimeout(async () => {
      await syncDownUser(session, true);
      await loadMedia(session, media.id);
    }, 400);
  };
  const duration = media.duration ? Number(media.duration) : false;
  const percent = duration
    ? (media.playerState.position / duration) * 100
    : false;

  return (
    <View style={[styles.playerStateTileContainer, style]}>
      <PressableScale weight="light" onPress={loadBookIntoPlayer}>
        <View style={styles.playerStateThumbnailContainer}>
          <ThumbnailImage
            thumbnails={media.thumbnails}
            downloadedThumbnails={media.download?.thumbnails}
            size="large"
            style={styles.playerStateThumbnail}
          />
          <IconButton
            icon="play"
            size={32}
            style={styles.playButton}
            iconStyle={styles.playButtonIcon}
            color={Colors.zinc[100]}
          />
        </View>
        {duration && (
          <ProgressBar
            position={media.playerState.position}
            duration={duration}
          />
        )}
        {percent && (
          <Text style={styles.progressText} numberOfLines={1}>
            {percent.toFixed(1)}%
          </Text>
        )}
      </PressableScale>
      <TileText book={media.book} media={[media]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 12,
  },
  playerStateTileContainer: {
    display: "flex",
    gap: 4,
  },
  tileImageContainer: {
    gap: 4,
  },
  bookThumbnail: {
    aspectRatio: 1,
    borderRadius: 8,
  },
  playerStateThumbnailContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  playerStateThumbnail: {
    position: "absolute",
    width: "100%",
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  playButton: {
    elevation: 4,
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
  },
  playButtonIcon: {
    // play button looks off center, so we need to adjust it a bit
    transform: [{ translateX: 2 }],
  },
  progressText: {
    fontSize: 14,
    color: Colors.zinc[400],
    textAlign: "center",
  },
  personThumbnail: {
    aspectRatio: 1,
    borderRadius: 999,
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
});
