import { Session } from "@/src/stores/session";
import { StyleSheet } from "react-native";

type AuthorDetailsProps = {
  authorId: string;
  session: Session;
};

export function AuthorDetails({ authorId, session }: AuthorDetailsProps) {
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
