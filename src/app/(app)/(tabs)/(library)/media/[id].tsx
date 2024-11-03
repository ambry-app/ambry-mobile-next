import Description from "@/src/components/Description";
import IconButton from "@/src/components/IconButton";
import Loading from "@/src/components/Loading";
import NamesList from "@/src/components/NamesList";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import {
  BookTile,
  MediaTile,
  PersonTile,
  SeriesBookTile,
} from "@/src/components/Tiles";
import {
  useMediaActionBarInfo,
  useMediaAuthorsAndNarrators,
  useMediaDescription,
  useMediaHeaderInfo,
  useMediaIds,
  useMediaOtherEditions,
  useOtherBooksByAuthor,
  useOtherBooksInSeries,
  useOtherMediaByNarrator,
} from "@/src/db/library";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { startDownload, useDownloads } from "@/src/stores/downloads";
import { loadMedia, requestExpandPlayer } from "@/src/stores/player";
import { useScreen } from "@/src/stores/screen";
import { Session, useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { formatPublished } from "@/src/utils/date";
import { durationDisplay } from "@/src/utils/time";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

export default function MediaDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: mediaId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <MediaDetailsFlatList session={session} mediaId={mediaId} />
    </>
  );
}

type HeaderSection = {
  id: string;
  type: "header";
  mediaId: string;
};

type ActionBarSection = {
  id: string;
  type: "actionBar";
  mediaId: string;
};

type MediaDescriptionSection = {
  id: string;
  type: "mediaDescription";
  mediaId: string;
};

type AuthorsAndNarratorsSection = {
  id: string;
  type: "authorsAndNarrators";
  mediaId: string;
};

type OtherEditionsSection = {
  id: string;
  type: "otherEditions";
  bookId: string;
  withoutMediaId: string;
};

type OtherBooksInSeriesSection = {
  id: string;
  type: "otherBooksInSeries";
  seriesId: string;
};

type OtherBooksByAuthorSection = {
  id: string;
  type: "otherBooksByAuthor";
  authorId: string;
  withoutBookId: string;
  withoutSeriesIds: string[];
};

type OtherMediaByNarratorSection = {
  id: string;
  type: "otherMediaByNarrator";
  narratorId: string;
  withoutMediaId: string;
  withoutSeriesIds: string[];
  withoutAuthorIds: string[];
};

type Section =
  | HeaderSection
  | ActionBarSection
  | MediaDescriptionSection
  | AuthorsAndNarratorsSection
  | OtherEditionsSection
  | OtherBooksInSeriesSection
  | OtherBooksByAuthorSection
  | OtherMediaByNarratorSection;

function useSections(mediaId: string, session: Session) {
  const { ids, opacity } = useMediaIds(session, mediaId);

  const [sections, setSections] = useState<Section[] | undefined>();

  useEffect(() => {
    if (!ids) return;

    const sections: Section[] = [
      { id: `header-${mediaId}`, type: "header", mediaId },
      { id: `actions-${mediaId}`, type: "actionBar", mediaId },
      {
        id: `description-${mediaId}`,
        type: "mediaDescription",
        mediaId,
      },
      {
        id: `authors-narrators-${mediaId}`,
        type: "authorsAndNarrators",
        mediaId,
      },
      {
        id: `editions-${mediaId}`,
        type: "otherEditions",
        bookId: ids.bookId,
        withoutMediaId: mediaId,
      },
      ...ids.seriesIds.map(
        (seriesId): OtherBooksInSeriesSection => ({
          id: `books-in-series-${seriesId}`,
          type: "otherBooksInSeries",
          seriesId,
        }),
      ),
      ...ids.authorIds.map(
        (authorId): OtherBooksByAuthorSection => ({
          id: `other-books-${authorId}`,
          type: "otherBooksByAuthor",
          authorId,
          withoutBookId: ids.bookId,
          withoutSeriesIds: ids.seriesIds,
        }),
      ),
      ...ids.narratorIds.map(
        (narratorId): OtherMediaByNarratorSection => ({
          id: `other-media-${narratorId}`,
          type: "otherMediaByNarrator",
          narratorId,
          withoutMediaId: mediaId,
          withoutSeriesIds: ids.seriesIds,
          withoutAuthorIds: ids.authorIds,
        }),
      ),
    ];
    setSections(sections);
  }, [ids, mediaId, session]);

  return { sections, opacity };
}

type MediaDetailsFlatListProps = {
  session: Session;
  mediaId: string;
};

function MediaDetailsFlatList({ session, mediaId }: MediaDetailsFlatListProps) {
  const { sections, opacity } = useSections(mediaId, session);

  if (!sections) return null;

  return (
    <Animated.FlatList
      style={[styles.container, { opacity }]}
      data={sections}
      keyExtractor={(item) => item.id}
      initialNumToRender={2}
      ListHeaderComponent={<View className="h-4" />}
      ListFooterComponent={<View className="h-4" />}
      renderItem={({ item }) => {
        switch (item.type) {
          case "header":
            return <Header mediaId={item.mediaId} session={session} />;
          case "actionBar":
            return <ActionBar mediaId={item.mediaId} session={session} />;
          case "mediaDescription":
            return (
              <MediaDescription mediaId={item.mediaId} session={session} />
            );
          case "authorsAndNarrators":
            return (
              <AuthorsAndNarrators mediaId={item.mediaId} session={session} />
            );
          case "otherEditions":
            return (
              <OtherEditions
                bookId={item.bookId}
                withoutMediaId={item.withoutMediaId}
                session={session}
              />
            );
          case "otherBooksInSeries":
            return (
              <OtherBooksInSeries seriesId={item.seriesId} session={session} />
            );
          case "otherBooksByAuthor":
            return (
              <OtherBooksByAuthor
                authorId={item.authorId}
                session={session}
                withoutBookId={item.withoutBookId}
                withoutSeriesIds={item.withoutSeriesIds}
              />
            );
          case "otherMediaByNarrator":
            return (
              <OtherMediaByNarrator
                narratorId={item.narratorId}
                session={session}
                withoutMediaId={item.withoutMediaId}
                withoutSeriesIds={item.withoutSeriesIds}
                withoutAuthorIds={item.withoutAuthorIds}
              />
            );
          default:
            // can't happen
            console.error("unknown section type:", item);
            return null;
        }
      }}
    />
  );
}

type HeaderProps = {
  mediaId: string;
  session: Session;
};

function Header({ mediaId, session }: HeaderProps) {
  const { data: media, opacity } = useMediaHeaderInfo(session, mediaId);

  if (!media) return null;

  return (
    <Animated.View style={[styles.headerContainer, { opacity }]}>
      <ThumbnailImage
        thumbnails={media.thumbnails}
        downloadedThumbnails={media.download?.thumbnails}
        size="extraLarge"
        style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
      />
      <View>
        <Text className="text-2xl text-zinc-100 font-bold leading-tight">
          {media.book.title}
        </Text>
        {media.book.seriesBooks.length !== 0 && (
          <NamesList
            names={media.book.seriesBooks.map(
              (sb) => `${sb.series.name} #${sb.bookNumber}`,
            )}
            className="text-lg text-zinc-100 leading-tight"
          />
        )}
        <NamesList
          names={media.book.bookAuthors.map((ba) => ba.author.name)}
          className="text-lg text-zinc-300 leading-tight"
        />
        {media.mediaNarrators.length > 0 && (
          <NamesList
            prefix={
              media.fullCast ? "Read by a full cast including" : "Read by"
            }
            names={media.mediaNarrators.map((mn) => mn.narrator.name)}
            className="text-zinc-400 leading-tight"
          />
        )}
        {media.mediaNarrators.length === 0 && media.fullCast && (
          <Text className="text-zinc-400 leading-tight">
            Read by a full cast
          </Text>
        )}
      </View>
      {media.duration && (
        <View>
          <Text className=" text-zinc-500 leading-tight italic">
            {durationDisplay(media.duration)} {media.abridged && "(abridged)"}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

type ActionBarProps = {
  mediaId: string;
  session: Session;
};

function ActionBar({ mediaId, session }: ActionBarProps) {
  const progress = useDownloads((state) => state.downloadProgresses[mediaId]);
  const { data: media, opacity } = useMediaActionBarInfo(session, mediaId);

  if (!media) return null;

  if (progress) {
    return (
      <Animated.View
        style={{ opacity }}
        className="flex flex-row bg-zinc-900 rounded-xl items-center mt-8"
      >
        <Pressable
          className="grow p-4"
          onPress={() => router.navigate("/downloads")}
        >
          <View className="flex items-center justify-end">
            <View>
              <Loading size={36} />
            </View>
            <View>
              <Text className="text-lg text-zinc-100">Downloading...</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  } else if (media.download && media.download.status !== "error") {
    return (
      <Animated.View style={{ opacity }} className="gap-2 mt-8">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <View className="grow flex items-center justify-center">
            <IconButton
              icon="play-circle"
              size={32}
              style={{ padding: 8 }}
              color={colors.zinc[100]}
              onPress={() => {
                loadMedia(session, media.id);
                requestExpandPlayer();
              }}
            >
              <Text className="text-lg text-zinc-100 leading-none mt-2">
                Play
              </Text>
            </IconButton>
          </View>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          You have this audiobook downloaded, it will play from your device and
          not require an internet connection.
        </Text>
      </Animated.View>
    );
  } else {
    return (
      <Animated.View style={{ opacity }} className="gap-2 mt-8">
        <View className="flex flex-row bg-zinc-900 rounded-xl items-center">
          <View className="grow border-r border-zinc-800 flex items-center justify-center">
            <IconButton
              icon="play-circle"
              size={32}
              style={{ padding: 8 }}
              color={colors.zinc[100]}
              onPress={() => {
                loadMedia(session, media.id);
                requestExpandPlayer();
              }}
            >
              <Text className="text-lg text-zinc-100 leading-none mt-2">
                Stream
              </Text>
            </IconButton>
          </View>
          <View className="grow flex items-center justify-center">
            <IconButton
              icon="download"
              size={32}
              style={{ padding: 8 }}
              color={colors.zinc[100]}
              onPress={() => {
                if (!media.mp4Path) return;
                startDownload(
                  session,
                  media.id,
                  media.mp4Path,
                  media.thumbnails,
                );
                router.navigate("/downloads");
              }}
            >
              <Text className="text-lg text-zinc-100 leading-none mt-2">
                Download
              </Text>
            </IconButton>
          </View>
        </View>
        <Text className="text-zinc-500 text-sm leading-tight">
          Playing this audiobook will stream it and require an internet
          connection and may use your data plan.
        </Text>
      </Animated.View>
    );
  }
}

type MediaDescriptionProps = {
  mediaId: string;
  session: Session;
};

function MediaDescription({ mediaId, session }: MediaDescriptionProps) {
  const { data: media, opacity } = useMediaDescription(session, mediaId);

  if (!media?.description) return null;

  return (
    <Animated.View style={{ opacity }} className="gap-1 mt-8">
      <Description description={media.description} />
      <View>
        {media.book.published && (
          <Text className="text-sm text-zinc-400">
            First published{" "}
            {formatPublished(media.book.published, media.book.publishedFormat)}
          </Text>
        )}
        {media.published && (
          <Text className="text-sm text-zinc-400">
            This edition published{" "}
            {formatPublished(media.published, media.publishedFormat)}
          </Text>
        )}
        {media.publisher && (
          <Text className="text-sm text-zinc-400">by {media.publisher}</Text>
        )}
        {media.notes && (
          <Text className="text-sm text-zinc-400">Note: {media.notes}</Text>
        )}
      </View>
    </Animated.View>
  );
}

type AuthorsAndNarratorsProps = {
  mediaId: string;
  session: Session;
};

function AuthorsAndNarrators({ mediaId, session }: AuthorsAndNarratorsProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, authorSet, narratorSet, opacity } =
    useMediaAuthorsAndNarrators(session, mediaId);

  if (!media) return null;

  return (
    <Animated.View style={{ opacity }} className="mt-8">
      <Text
        className="text-2xl font-medium text-zinc-100 mb-2"
        numberOfLines={1}
      >
        Author{media.book.bookAuthors.length > 1 && "s"} & Narrator
        {media.mediaNarrators.length > 1 && "s"}
      </Text>
      <FlatList
        className="py-2"
        data={[...media.book.bookAuthors, ...media.mediaNarrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          if ("author" in item) {
            const label = narratorSet.has(item.author.person.id)
              ? "Author & Narrator"
              : "Author";
            return (
              <View style={{ width: screenWidth / 2.5, marginRight: 16 }}>
                <PersonTile
                  label={label}
                  personId={item.author.person.id}
                  name={item.author.name}
                  realName={item.author.person.name}
                  thumbnails={item.author.person.thumbnails}
                />
              </View>
            );
          }

          if ("narrator" in item) {
            // skip if this person is also an author, as they were already rendered
            if (authorSet.has(item.narrator.person.id)) return null;

            return (
              <View style={{ width: screenWidth / 2.5, marginRight: 16 }}>
                <PersonTile
                  label="Narrator"
                  personId={item.narrator.person.id}
                  name={item.narrator.name}
                  realName={item.narrator.person.name}
                  thumbnails={item.narrator.person.thumbnails}
                />
              </View>
            );
          }

          // can't happen:
          console.error("unknown item:", item);
          return null;
        }}
      />
    </Animated.View>
  );
}

type OtherEditionsProps = {
  bookId: string;
  session: Session;
  withoutMediaId: string;
};

function OtherEditions(props: OtherEditionsProps) {
  const { bookId, session, withoutMediaId } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, opacity } = useMediaOtherEditions(
    session,
    bookId,
    withoutMediaId,
  );

  if (media.length === 0) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/book/[id]",
      params: { id: media[0].book.id, title: media[0].book.title },
    });
  };

  return (
    <Animated.View style={{ opacity }} className="mt-8">
      <HeaderButton label="Other Editions" onPress={navigateToBook} />
      <FlatList
        className="p-2"
        data={media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={{ width: screenWidth / 2.5, marginRight: 16 }}
              media={item}
            />
          );
        }}
      />
    </Animated.View>
  );
}

type OtherBooksInSeriesProps = {
  seriesId: string;
  session: Session;
};

function OtherBooksInSeries({ seriesId, session }: OtherBooksInSeriesProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { data: series, opacity } = useOtherBooksInSeries(session, seriesId);

  if (!series) return null;

  const navigateToSeries = () => {
    router.navigate({
      pathname: "/series/[id]",
      params: { id: series.id, title: series.name },
    });
  };

  return (
    <Animated.View style={{ opacity }} className="mt-8">
      <HeaderButton label={series.name} onPress={navigateToSeries} />
      <FlatList
        className="py-2"
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return (
            <SeriesBookTile
              style={{ width: screenWidth / 2.5, marginRight: 16 }}
              seriesBook={item}
            />
          );
        }}
      />
    </Animated.View>
  );
}

type OtherBooksByAuthorProps = {
  authorId: string;
  session: Session;
  withoutBookId: string;
  withoutSeriesIds: string[];
};

function OtherBooksByAuthor(props: OtherBooksByAuthorProps) {
  const { authorId, session, withoutBookId, withoutSeriesIds } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { books, author, opacity } = useOtherBooksByAuthor(
    session,
    authorId,
    withoutBookId,
    withoutSeriesIds,
  );

  if (!author) return null;
  if (books.length === 0) return null;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: author.person.id, title: author.person.name },
    });
  };

  return (
    <Animated.View style={{ opacity }} className="mt-8">
      <HeaderButton
        label={`More by ${author.name}`}
        onPress={navigateToPerson}
      />
      <FlatList
        className="py-2"
        data={books}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return (
            <BookTile
              style={{ width: screenWidth / 2.5, marginRight: 16 }}
              book={item}
            />
          );
        }}
      />
    </Animated.View>
  );
}

type OtherMediaByNarratorProps = {
  narratorId: string;
  session: Session;
  withoutMediaId: string;
  withoutSeriesIds: string[];
  withoutAuthorIds: string[];
};

function OtherMediaByNarrator(props: OtherMediaByNarratorProps) {
  const {
    narratorId,
    session,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, narrator, opacity } = useOtherMediaByNarrator(
    session,
    narratorId,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  );

  if (!narrator) return null;
  if (media.length === 0) return null;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: narrator.person.id, title: narrator.person.name },
    });
  };

  return (
    <Animated.View style={{ opacity }} className="mt-8">
      <HeaderButton
        label={`More by ${narrator.name}`}
        onPress={navigateToPerson}
      />
      <FlatList
        className="py-2"
        data={media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={{ width: screenWidth / 2.5, marginRight: 16 }}
              media={item}
            />
          );
        }}
      />
    </Animated.View>
  );
}

type HeaderButtonProps = {
  label: string;
  onPress: () => void;
};

function HeaderButton({ label, onPress }: HeaderButtonProps) {
  return (
    <IconButton
      icon="chevron-right"
      size={16}
      color={colors.zinc[100]}
      style={{
        flexDirection: "row-reverse",
        justifyContent: "space-between",
        paddingLeft: 0,
        paddingRight: 16,
      }}
      onPress={onPress}
    >
      <Text className="text-2xl font-medium text-zinc-100" numberOfLines={1}>
        {label}
      </Text>
    </IconButton>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    gap: 8,
  },
});
