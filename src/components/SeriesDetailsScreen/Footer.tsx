import { PersonTile } from "@/src/components/Tiles";
import { FlatList, Text, View } from "react-native";
import { AuthorOrNarrator } from "./SeriesDetailsFlatList";

type FooterProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
};

export default function Footer({ authors, narrators }: FooterProps) {
  return (
    <View className="mt-8">
      <Text
        className="text-2xl font-medium text-zinc-100 mb-2"
        numberOfLines={1}
      >
        Author{authors.length > 1 && "s"} & Narrator
        {narrators.length > 1 && "s"}
      </Text>
      <FlatList
        className="py-2"
        data={[...authors, ...narrators]}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          if (item.type === "skip") return null;

          return (
            <View className="w-48 mr-4">
              <PersonTile
                label={
                  item.type === "both"
                    ? "Author & Narrator"
                    : item.type === "author"
                      ? "Author"
                      : "Narrator"
                }
                personId={item.person.id}
                name={item.name}
                realName={item.person.name}
                thumbnails={item.person.thumbnails}
              />
            </View>
          );
        }}
      />
    </View>
  );
}
