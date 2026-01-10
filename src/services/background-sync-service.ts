import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { getExpoDb } from "@/db/db";
import { useSession } from "@/stores/session";
import { logBase } from "@/utils/logger";

import { sync } from "./sync-service";

const log = logBase.extend("background-sync");

const BACKGROUND_SYNC_TASK_NAME = "ambry-background-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  log.info("started");

  const session = useSession.getState().session;
  if (!session) {
    log.info("No session available, skipping sync");
    return BackgroundTask.BackgroundTaskResult.Success;
  }

  try {
    await sync(session);

    log.info("performing WAL checkpoint");
    getExpoDb().execSync("PRAGMA wal_checkpoint(PASSIVE);");

    log.info("completed successfully");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    log.error("failed:", error);
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
      log.info("registered");
    } else {
      log.info("already registered");
    }
  } catch (error) {
    log.error("failed to register:", error);
  }
}

export async function unregisterBackgroundSyncTask() {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
    log.info("unregistered");
  } catch (error) {
    log.error("failed to unregister:", error);
  }
}
