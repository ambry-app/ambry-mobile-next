import { AuthorsAndNarrators } from "@/components";
import { getMediaAuthorsAndNarrators, MediaHeaderInfo } from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { Session } from "@/types/session";

type MediaAuthorsAndNarratorsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function MediaAuthorsAndNarrators(props: MediaAuthorsAndNarratorsProps) {
  const { media, session } = props;
  const authorsAndNarrators = useLibraryData(() =>
    getMediaAuthorsAndNarrators(session, media),
  );

  if (!authorsAndNarrators) return null;

  return <AuthorsAndNarrators authorsAndNarrators={authorsAndNarrators} />;
}
