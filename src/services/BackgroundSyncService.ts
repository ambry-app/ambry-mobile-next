import { syncDown, syncUp } from "@/src/db/sync";
import { useSession } from "@/src/stores/session";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_SYNC_TASK_NAME = "ambry-background-sync";

// Define the background task
TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  try {
    console.log("Background sync started");

    // Get the current session
    const session = useSession.getState().session;
    if (!session) {
      console.log("No session available, skipping background sync");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Sync down library and user data
    await syncDown(session);

    // Sync up local player states
    await syncUp(session);

    console.log("Background sync completed successfully");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("Background sync failed:", error);
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
      console.log("Background sync task registered");
    } else {
      console.log("Background sync task already registered");
    }
  } catch (error) {
    console.error("Failed to register background sync task:", error);
  }
}

export async function unregisterBackgroundSyncTask() {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
    console.log("Background sync task unregistered");
  } catch (error) {
    console.error("Failed to unregister background sync task:", error);
  }
}
