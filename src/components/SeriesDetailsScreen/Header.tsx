import NamesList from "@/src/components/NamesList";
import { View } from "react-native";
import { AuthorOrNarrator } from "./SeriesDetailsFlatList";

type HeaderProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
};

export default function Header({ authors, narrators }: HeaderProps) {
  return (
    <View className="p-2 gap-1">
      <NamesList
        names={authors.map((a) => a.name)}
        className="text-xl font-medium text-zinc-100 leading-tight"
        prefix="By"
      />
      <NamesList
        names={narrators.map((n) => n.name)}
        className="text-zinc-300 leading-tight mb-4"
        prefix="Read by"
      />
    </View>
  );
}
