import { PrismaClient } from "@prisma/client/react-native";
import "@prisma/react-native";
import { reactiveHooksExtension } from "@prisma/react-native";

export const baseClient = new PrismaClient();
export const extendedClient = baseClient.$extends(reactiveHooksExtension());

export async function initializeDb() {
  try {
    await baseClient.$applyPendingMigrations();
    console.log("Migrations applied successfully");
  } catch (e) {
    console.error(`failed to apply migrations: ${e}`);
    throw new Error(
      "Applying migrations failed, your app is now in an inconsistent state. We cannot guarantee safety, it is now your responsibility to reset the database or tell the user to re-install the app",
    );
  }
}
