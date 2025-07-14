import { AuthorsAndNarrators } from "@/src/components";
import { getMediaAuthorsAndNarrators, MediaHeaderInfo } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { Session } from "@/src/stores/session";

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
