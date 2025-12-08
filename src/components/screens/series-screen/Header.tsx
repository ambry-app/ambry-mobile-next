import { AuthorsAndNarrators } from "@/components";
import { MediaAuthorOrNarrator } from "@/db/library/shared-queries";

type FooterProps = {
  authorsAndNarrators: MediaAuthorOrNarrator[];
};

export function Header({ authorsAndNarrators }: FooterProps) {
  return <AuthorsAndNarrators authorsAndNarrators={authorsAndNarrators} />;
}
