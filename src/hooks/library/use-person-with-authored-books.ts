import {
  getPersonWithAuthoredBooks,
  PersonWithAuthoredBooks,
} from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function usePersonWithAuthoredBooks(session: Session, personId: string) {
  const [person, setPerson] = useState<PersonWithAuthoredBooks | undefined>(
    undefined,
  );
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getPersonWithAuthoredBooks(session, personId);
    setPerson(result);
  }, [session, personId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { person };
}
