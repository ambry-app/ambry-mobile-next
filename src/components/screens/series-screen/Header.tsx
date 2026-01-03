import { AuthorsAndNarrators } from "@/components";
import { MediaAuthorOrNarrator } from "@/services/library-service";

type FooterProps = {
  authorsAndNarrators: MediaAuthorOrNarrator[];
};

export function Header({ authorsAndNarrators }: FooterProps) {
  return <AuthorsAndNarrators authorsAndNarrators={authorsAndNarrators} />;
}
