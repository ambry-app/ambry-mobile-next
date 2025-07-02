import { getPersonHeaderInfo, PersonHeaderInfo } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function usePersonHeaderInfo(session: Session, personId: string) {
  const [person, setPerson] = useState<PersonHeaderInfo | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const person = await getPersonHeaderInfo(session, personId);
    setPerson(person);
  }, [session, personId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { person };
}
