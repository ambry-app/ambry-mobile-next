import { is } from "drizzle-orm";
import { type AnySQLiteSelect } from "drizzle-orm/sqlite-core";
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect, useState } from "react";

export const useLiveTablesQuery = <
  T extends
    | Pick<AnySQLiteSelect, "_" | "then">
    | SQLiteRelationalQuery<"sync", unknown>,
>(
  query: T,
  tables: string[],
  deps: unknown[] = [],
) => {
  const [data, setData] = useState<Awaited<T>>(
    (is(query, SQLiteRelationalQuery) && query.mode === "first"
      ? undefined
      : []) as Awaited<T>,
  );
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState<Date>();

  useEffect(() => {
    let listener: ReturnType<typeof addDatabaseChangeListener> | undefined;

    const handleData = (data: any) => {
      setData(data);
      setUpdatedAt(new Date());
    };

    query.then(handleData).catch(setError);

    listener = addDatabaseChangeListener(({ tableName }) => {
      if (tables.includes(tableName)) {
        query.then(handleData).catch(setError);
      }
    });

    return () => {
      listener?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    error,
    updatedAt,
  } as const;
};
