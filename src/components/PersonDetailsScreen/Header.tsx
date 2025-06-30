import { ThumbnailImage } from "@/src/components";
import { usePersonHeaderInfo } from "@/src/db/library-old";
import { Session } from "@/src/stores/session";
import Animated from "react-native-reanimated";

type HeaderProps = {
  personId: string;
  session: Session;
};

export default function Header({ personId, session }: HeaderProps) {
  const { person, opacity } = usePersonHeaderInfo(session, personId);

  if (!person) return null;

  return (
    <Animated.View style={{ opacity }}>
      <ThumbnailImage
        thumbnails={person.thumbnails}
        size="extraLarge"
        style={{
          aspectRatio: 1,
          borderRadius: 9999,
          marginLeft: "auto",
          marginRight: "auto",
          marginTop: 32,
          width: "75%",
        }}
      />
    </Animated.View>
  );
}
