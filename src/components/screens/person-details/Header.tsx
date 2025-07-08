import { Description, ThumbnailImage } from "@/src/components";
import { PersonHeaderInfo } from "@/src/db/library";
import { StyleSheet, View } from "react-native";

type HeaderProps = {
  person: PersonHeaderInfo;
};

export function Header({ person }: HeaderProps) {
  return (
    <>
      <ThumbnailImage
        thumbnails={person.thumbnails}
        size="extraLarge"
        style={styles.thumbnail}
      />
      <PersonDescription description={person.description} />
    </>
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
  thumbnail: {
    aspectRatio: 1,
    borderRadius: 9999,
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: 16,
    width: "75%",
  },
  spacingTop: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
});
