import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, eq, is } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { AnySQLiteSelect } from "drizzle-orm/sqlite-core";
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { useEffect, useState } from "react";

export default function useSyncedDataQuery<
  T extends
    | Pick<AnySQLiteSelect, "_" | "then">
    | SQLiteRelationalQuery<"sync", unknown>,
>(session: Session, query: T, additionalDeps: unknown[] = []) {
  const lastSyncedQuery = db
    .select({ lastDownSync: schema.servers.lastDownSync })
    .from(schema.servers)
    .where(
      and(
        eq(schema.servers.url, session.url),
        eq(schema.servers.userEmail, session.email),
      ),
    )
    .limit(1);

  const { data: lastSyncedAtData } = useLiveQuery(lastSyncedQuery);
  const lastSyncedAt = lastSyncedAtData?.[0]?.lastDownSync;

  const [data, setData] = useState<Awaited<T>>(
    // @ts-ignore: drizzle types are wrong
    (is(query, SQLiteRelationalQuery) && query.mode === "first"
      ? undefined
      : []) as Awaited<T>,
  );
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState<Date>();

  useEffect(() => {
    if (!lastSyncedAt) return;

    const handleData = (data: any) => {
      setData(data);
      setUpdatedAt(new Date());
    };

    console.debug(
      "[useSyncedDataQuery] lastSyncedAt changed:",
      lastSyncedAt,
      "running query...",
    );
    query.then(handleData).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncedAt, ...additionalDeps]);

  return { data, error, updatedAt } as const;
}
