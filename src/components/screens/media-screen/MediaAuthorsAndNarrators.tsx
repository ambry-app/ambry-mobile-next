import { AuthorsAndNarrators } from "@/components/AuthorsAndNarrators";
import {
  getMediaAuthorsAndNarrators,
  MediaHeaderInfo,
  useLibraryData,
} from "@/services/library-service";
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
