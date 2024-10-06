import { BookAuthor } from "@/src/db/library";
import { Thumbnails } from "@/src/db/schema";
import { useMediaDetails } from "@/src/hooks/use.media.details";
import { useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Image } from "expo-image";
import { Link, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import colors from "tailwindcss/colors";

function MediaImage({ thumbnails }: { thumbnails: Thumbnails | null }) {
  const session = useSessionStore((state) => state.session);

  if (!thumbnails || !session) {
    return <View className="w-14 h-14 rounded-sm bg-zinc-800" />;
  }

  const source = {
    uri: `${session.url}/${thumbnails.small}`,
    headers: { Authorization: `Bearer ${session!.token}` },
  };
  const placeholder = { thumbhash: thumbnails.thumbhash };

  console.log("source", source);

  return (
    <Image
      source={source}
      style={{ height: 56, width: 56, borderRadius: 3 }}
      placeholder={placeholder}
      contentFit="cover"
      transition={250}
    />
  );
}

function AuthorList({ bookAuthors }: { bookAuthors: BookAuthor[] }) {
  return (
    <Text className="text-sm text-zinc-400 leading-tight" numberOfLines={1}>
      {bookAuthors.map((bookAuthor, i) => [
        i > 0 && ", ",
        <Text key={i}>{bookAuthor.author.name}</Text>,
      ])}
    </Text>
  );
}

function FloatingPlayer() {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const { media } = useMediaDetails(mediaId);

  if (!media) {
    return null;
  }

  return (
    <Link
      href={{
        pathname: "/",
      }}
      asChild
    >
      <Pressable className="flex flex-row p-4 h-full items-center gap-4 border-t-[0.25px] border-zinc-600">
        <MediaImage thumbnails={media.thumbnails || null} />
        <View className="flex-1">
          <Text className="text-zinc-100" numberOfLines={1}>
            {media.book.title}
          </Text>
          <AuthorList bookAuthors={media.book.bookAuthors} />
        </View>
        <View className="pr-2">
          {/* TODO: play or pause depending on state */}
          <FontAwesome6 size={24} name="play" color={colors.zinc[100]} />
        </View>
        {/* TODO: progress bar at bottom */}
      </Pressable>
    </Link>
  );
}

const tabBarHeight = 49;
const playerHeight = 64;

export default function TabLayout() {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const playerVisible = !!mediaId;

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.lime[400],
          tabBarStyle: {
            height: tabBarHeight,
            borderTopWidth: playerVisible ? 0 : 0.25,
          },
        }}
        sceneContainerStyle={{
          paddingBottom: playerVisible ? playerHeight : 0,
        }}
      >
        <Tabs.Screen
          name="(library)"
          options={{
            headerShown: false,
            title: "Library",
            tabBarIcon: ({ color }) => (
              <FontAwesome6 size={24} name="book-open" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="shelf"
          options={{
            title: "Shelf",
            tabBarIcon: ({ color }) => (
              <FontAwesome6 size={24} name="book-bookmark" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: "Downloads",
            tabBarIcon: ({ color }) => (
              <FontAwesome6 size={24} name="download" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <FontAwesome6 size={24} name="gear" color={color} />
            ),
          }}
        />
      </Tabs>
      {playerVisible && (
        <View
          className="absolute bg-zinc-800"
          style={{
            left: 0,
            right: 0,
            bottom: tabBarHeight,
            height: playerHeight,
          }}
        >
          <FloatingPlayer />
        </View>
      )}
    </>
  );
}
