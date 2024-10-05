import migrations from "@/drizzle/migrations";
import { db } from "@/src/db/db";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (!success) return;
    if (error) {
      console.error("Migration error", error);
      return;
    }
    setIsReady(true);
  }, [success, error]);

  return { isReady };
};

export { useAppBoot };
