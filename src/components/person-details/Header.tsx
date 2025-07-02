import { Description, FadeInOnMount, ThumbnailImage } from "@/src/components";
import { usePersonHeaderInfo } from "@/src/hooks/library";
import { Session } from "@/src/stores/session";
import { View, StyleSheet } from "react-native";

type HeaderProps = {
  personId: string;
  session: Session;
};

export function Header({ personId, session }: HeaderProps) {
  const { person } = usePersonHeaderInfo(session, personId);

  if (!person) return null;

  return (
    <FadeInOnMount>
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
      <PersonDescription description={person.description} />
    </FadeInOnMount>
  );
}

type PersonDescriptionProps = {
  description: string | null;
};

function PersonDescription(props: PersonDescriptionProps) {
  const { description } = props;

  if (!description) return null;

  return (
    <View style={styles.spacingTop}>
      <Description description={description} />
    </View>
  );
}

const styles = StyleSheet.create({
  spacingTop: {
    marginTop: 32,
  },
});
