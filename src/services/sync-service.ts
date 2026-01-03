import {
  PlaythroughsSyncSuccess,
  SyncError,
  syncLibrary as syncLibraryDb,
  syncPlaythroughs as syncPlaythroughsDb,
} from "@/db/sync";
import {
  bumpPlaythroughDataVersion,
  setLibraryDataVersion,
} from "@/stores/data-version";
import { getDeviceInfo } from "@/stores/device";
import { forceSignOut } from "@/stores/session";
import { Session } from "@/types/session";

export async function sync(session: Session) {
  return Promise.all([syncLibrary(session), syncPlaythroughs(session)]);
}

export async function syncLibrary(session: Session) {
  const result = await syncLibraryDb(session);

  if (!result.success && result.error === SyncError.AUTH_ERROR) {
    forceSignOut();
  }

  if (result.success && result.result !== "no_changes") {
    const { newDataAsOf } = result.result;
    if (newDataAsOf) {
      // Update global data version store
      setLibraryDataVersion(newDataAsOf);
    }
  }

  return result;
}

export async function syncPlaythroughs(session: Session) {
  const deviceInfo = await getDeviceInfo();
  const result = await syncPlaythroughsDb(session, deviceInfo);

  if (!result.success && result.error === SyncError.AUTH_ERROR) {
    forceSignOut();
  }

  if (result.success && result.result === PlaythroughsSyncSuccess.SYNCED) {
    // Notify UI that playthrough data changed
    bumpPlaythroughDataVersion();
  }

  return result;
}
