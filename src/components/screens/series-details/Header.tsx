import { AuthorsAndNarrators } from "@/src/components";
import { MediaAuthorOrNarrator } from "@/src/db/library/shared-queries";

type FooterProps = {
  authorsAndNarrators: MediaAuthorOrNarrator[];
};

export function Header({ authorsAndNarrators }: FooterProps) {
  return <AuthorsAndNarrators authorsAndNarrators={authorsAndNarrators} />;
}
