import {
  getAuthorWithOtherBooks,
  AuthorWithOtherBooks,
} from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useAuthorWithOtherBooks(
  session: Session,
  authorId: string,
  withoutBookId: string,
  withoutSeriesIds: string[],
) {
  const [author, setAuthor] = useState<AuthorWithOtherBooks | undefined>(
    undefined,
  );
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getAuthorWithOtherBooks(
      session,
      authorId,
      withoutBookId,
      withoutSeriesIds,
    );
    setAuthor(result);
  }, [session, authorId, withoutBookId, withoutSeriesIds]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { author };
}
