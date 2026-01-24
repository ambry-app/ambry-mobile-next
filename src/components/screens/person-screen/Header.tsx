import { StyleSheet, Text, View } from "react-native";

import { Description } from "@/components/Description";
import { ThumbnailImage } from "@/components/ThumbnailImage";
import { PersonHeaderInfo } from "@/services/library-service";
import { Colors } from "@/styles/colors";

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
      <PersonName name={person.name} />
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

type PersonNameProps = {
  name: string;
};

function PersonName(props: PersonNameProps) {
  const { name } = props;

  return (
    <Text style={styles.personName} numberOfLines={1}>
      {name}
    </Text>
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
  personName: {
    fontWeight: "bold",
    fontSize: 24,
    textAlign: "center",
    color: Colors.zinc[100],
    marginTop: 8,
  },
});
