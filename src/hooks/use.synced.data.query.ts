import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { eq, is } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { useEffect, useState } from "react";

/**
 * @deprecated
 */
type LiveQueryParams = Parameters<typeof useLiveQuery>;

/**
 * @deprecated
 */
type Query = LiveQueryParams[0];

/**
 * @deprecated
 */
type Deps = LiveQueryParams[1];

/**
 * @deprecated
 */
export default function useSyncedDataQuery<T extends Query>(
  session: Session,
  query: T,
  additionalDeps: Deps = [],
) {
  const syncedServersQuery = db
    .select({ newDataAsOf: schema.syncedServers.newDataAsOf })
    .from(schema.syncedServers)
    .where(eq(schema.syncedServers.url, session.url))
    .limit(1);

  const { data: syncedServers } = useLiveQuery(syncedServersQuery);
  const newDataAsOf = syncedServers?.[0]?.newDataAsOf?.getTime();

  const [data, setData] = useState<Awaited<T>>(
    // @ts-ignore: drizzle types are wrong
    (is(query, SQLiteRelationalQuery) && query.mode === "first"
      ? undefined
      : []) as Awaited<T>,
  );
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState<Date>();

  useEffect(() => {
    if (!newDataAsOf) return;

    const handleData = (data: any) => {
      setData(data);
      setUpdatedAt(new Date());
    };

    query.then(handleData).catch(setError);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDataAsOf, ...additionalDeps]);

  return { data, error, updatedAt } as const;
}
