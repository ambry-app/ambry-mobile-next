import { AuthorsAndNarrators } from "@/components/AuthorsAndNarrators";
import { MediaAuthorOrNarrator } from "@/services/library-service";

type FooterProps = {
  authorsAndNarrators: MediaAuthorOrNarrator[];
};

export function Header({ authorsAndNarrators }: FooterProps) {
  return <AuthorsAndNarrators authorsAndNarrators={authorsAndNarrators} />;
}
