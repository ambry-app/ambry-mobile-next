import { expoDb } from "@/src/db/db";
import { syncDown, syncUp } from "@/src/db/sync";
import { useSession } from "@/src/stores/session";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_SYNC_TASK_NAME = "ambry-background-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  try {
    console.debug("[BackgroundSync] started");

    const session = useSession.getState().session;
    if (!session) {
      console.debug("[BackgroundSync] No session available, skipping sync");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    await syncDown(session);
    await syncUp(session);

    console.debug("[BackgroundSync] performing WAL checkpoint");
    expoDb.execSync("PRAGMA wal_checkpoint(TRUNCATE);");

    console.debug("[BackgroundSync] completed successfully");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[BackgroundSync] failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSyncTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_SYNC_TASK_NAME,
    );

    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
        minimumInterval: 15,
      });
      console.debug("[BackgroundSync] registered");
    } else {
      console.debug("[BackgroundSync] already registered");
    }
  } catch (error) {
    console.error("[BackgroundSync] failed to register:", error);
  }
}

export async function unregisterBackgroundSyncTask() {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
    console.debug("[BackgroundSync] unregistered");
  } catch (error) {
    console.error("[BackgroundSync] failed to unregister:", error);
  }
}
