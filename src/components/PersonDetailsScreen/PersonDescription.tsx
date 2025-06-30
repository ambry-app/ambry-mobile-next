import { Description } from "@/src/components";
import { usePersonDescription } from "@/src/db/library-old";
import { Session } from "@/src/stores/session";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

type PersonDescriptionProps = {
  personId: string;
  session: Session;
};

export default function PersonDescription({
  personId,
  session,
}: PersonDescriptionProps) {
  const { person, opacity } = usePersonDescription(session, personId);

  if (!person?.description) return null;

  return (
    <Animated.View style={[styles.spacingTop, { opacity }]}>
      <Description description={person.description} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spacingTop: {
    marginTop: 32,
  },
});
