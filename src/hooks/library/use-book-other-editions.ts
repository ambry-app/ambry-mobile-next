import { getBookOtherEditions, BookOtherEditions } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useBookOtherEditions(session: Session, mediaId: string) {
  const [book, setBook] = useState<BookOtherEditions | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getBookOtherEditions(session, mediaId);
    setBook(result);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { book };
}
