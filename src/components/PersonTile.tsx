import ThumbnailImage from "@/src/components/ThumbnailImage";
import { Thumbnails } from "@/src/db/schema";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { PressableScale } from "react-native-pressable-scale";

export default function PersonTile({
  personId,
  name,
  realName,
  thumbnails,
  label,
}: {
  personId: string;
  name: string;
  realName?: string;
  thumbnails: Thumbnails | null;
  label: string;
}) {
  const router = useRouter();

  const navigateToPerson = () => {
    router.push({
      pathname: "/person/[id]",
      params: { id: personId },
    });
  };

  return (
    <View className="flex gap-3">
      <PressableScale weight="light" onPress={navigateToPerson}>
        <ThumbnailImage
          thumbnails={thumbnails}
          size="large"
          className="rounded-full aspect-square"
        />
      </PressableScale>
      <TouchableOpacity onPress={navigateToPerson}>
        <View>
          <Text
            className="text-lg text-zinc-100 font-medium text-center leading-tight"
            numberOfLines={1}
          >
            {name}
          </Text>
          {realName !== name && (
            <Text
              className="text-zinc-300 text-center leading-tight"
              numberOfLines={1}
            >
              ({realName})
            </Text>
          )}
          <Text className="text-sm text-zinc-400 text-center leading-tight">
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
