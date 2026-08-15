import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components/Delay";
import {
  SolidHeaderBackground,
  useFadingHeader,
} from "@/components/FadingHeader";
import { MultiThumbnailImage } from "@/components/MultiThumbnailImage";
import { AuthorScreen } from "@/components/screens/AuthorScreen";
import {
  AuthorHeaderInfo,
  getAuthorHeaderInfo,
  useLibraryData,
} from "@/services/library-service";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles/colors";
import { RouterParams } from "@/types/router";

export default function AuthorRoute() {
  const session = useSession((state) => state.session);
  const { id: authorId } = useLocalSearchParams<RouterParams>();
  const insets = useSafeAreaInsets();
  const { scrollHandler, headerOpacity } = useFadingHeader();

  // Fetch author data for the header - session is checked after hooks
  const author = useLibraryData(
    async () => (session ? getAuthorHeaderInfo(session, authorId) : null),
    [session, authorId],
  );

  if (!session) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerBackground: () => (
            <SolidHeaderBackground
              borderOpacity={headerOpacity}
              height={insets.top + 56}
            />
          ),
          headerTitle: () =>
            author ? (
              <View style={styles.headerTitleContainer}>
                <MultiThumbnailImage
                  thumbnailPairs={author.people.map((person) => ({
                    thumbnails: person.thumbnails,
                    downloadedThumbnails: null,
                  }))}
                  size="small"
                  style={styles.headerThumbnail}
                />
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    By {authorHeaderName(author)}
                  </Text>
                  {authorHeaderSubtitle(author) && (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {authorHeaderSubtitle(author)}
                    </Text>
                  )}
                </View>
              </View>
            ) : null,
        }}
      />
      <Delay delay={10}>
        <AuthorScreen
          session={session}
          authorId={authorId}
          author={author ?? null}
          scrollHandler={scrollHandler}
        />
      </Delay>
    </>
  );
}

/**
 * A byline is one person's pen name, or several people sharing one. With a
 * single person we lead with their real name and note the pen name below; with
 * several there is no single real name to lead with, so the byline stands on
 * its own and the people are named underneath.
 */
function authorHeaderName(author: AuthorHeaderInfo) {
  const [person, ...rest] = author.people;

  if (person && rest.length === 0) return person.name;

  return author.name;
}

function authorHeaderSubtitle(author: AuthorHeaderInfo) {
  const [person, ...rest] = author.people;

  if (person && rest.length === 0) {
    return person.name === author.name ? null : `writing as ${author.name}`;
  }

  if (author.people.length === 0) return null;

  return `a pen name of ${joinNames(author.people.map((p) => p.name))}`;
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTextContainer: {
    flexDirection: "column",
  },
  headerTitle: {
    color: Colors.zinc[100],
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: Colors.zinc[400],
    fontSize: 12,
  },
});
