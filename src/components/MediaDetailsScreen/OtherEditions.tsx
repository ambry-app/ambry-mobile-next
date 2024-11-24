import { MediaTile } from "@/src/components/Tiles";
import { useMediaOtherEditions } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "./HeaderButton";

type OtherEditionsProps = {
  bookId: string;
  session: Session;
  withoutMediaId: string;
};

export default function OtherEditions(props: OtherEditionsProps) {
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
