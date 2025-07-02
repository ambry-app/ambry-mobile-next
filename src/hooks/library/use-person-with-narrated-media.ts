import {
  getPersonWithNarratedMedia,
  PersonWithNarratedMedia,
} from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function usePersonWithNarratedMedia(session: Session, personId: string) {
  const [person, setPerson] = useState<PersonWithNarratedMedia | undefined>(
    undefined,
  );
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getPersonWithNarratedMedia(session, personId);
    setPerson(result);
  }, [session, personId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { person };
}
