import HeaderButton from "@/src/components/MediaDetailsScreen/HeaderButton";
import { BookTile } from "@/src/components/Tiles";
import { useOtherBooksByAuthor } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList } from "react-native";
import Animated from "react-native-reanimated";

type OtherBooksByAuthorProps = {
  authorId: string;
  session: Session;
  withoutBookId: string;
  withoutSeriesIds: string[];
};

export default function OtherBooksByAuthor(props: OtherBooksByAuthorProps) {
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
