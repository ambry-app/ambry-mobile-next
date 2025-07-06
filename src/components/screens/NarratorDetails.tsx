import { Session } from "@/src/stores/session";
import { StyleSheet } from "react-native";

type NarratorDetailsProps = {
  narratorId: string;
  session: Session;
};

export function NarratorDetails({ narratorId, session }: NarratorDetailsProps) {
  return null;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
