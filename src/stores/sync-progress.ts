import { create } from "zustand";

/**
 * The two halves of a sync. They run concurrently, so each reports its own
 * progress rather than sharing one linear set of steps.
 */
export enum SyncTask {
  LIBRARY = "library",
  EVENTS = "events",
}

export enum SyncStage {
  /** Not started, or finished long enough ago that we no longer show it. */
  PENDING = "pending",
  /**
   * Waiting on the server. The response arrives in one piece, so there is no
   * meaningful progress to report during this stage.
   */
  DOWNLOADING = "downloading",
  /** Writing to the local database; `current` and `total` count rows. */
  SAVING = "saving",
  DONE = "done",
  FAILED = "failed",
}

export interface TaskProgress {
  stage: SyncStage;
  /** What is being written right now, e.g. "books". Only set while SAVING. */
  detail: string | null;
  current: number;
  total: number;
}

interface SyncProgressState {
  tasks: Record<SyncTask, TaskProgress>;
}

const pendingTask = (): TaskProgress => ({
  stage: SyncStage.PENDING,
  detail: null,
  current: 0,
  total: 0,
});

export const initialSyncProgressState: SyncProgressState = {
  tasks: {
    [SyncTask.LIBRARY]: pendingTask(),
    [SyncTask.EVENTS]: pendingTask(),
  },
};

export const useSyncProgress = create<SyncProgressState>(
  () => initialSyncProgressState,
);

function updateTask(task: SyncTask, changes: Partial<TaskProgress>) {
  useSyncProgress.setState((state) => ({
    tasks: { ...state.tasks, [task]: { ...state.tasks[task], ...changes } },
  }));
}

/** Reset both tasks back to pending at the start of a sync. */
export function beginSyncProgress() {
  useSyncProgress.setState(initialSyncProgressState);
}

/**
 * Move a task to a new stage. Row counts only mean something while saving, so
 * they are cleared on every other transition.
 */
export function setSyncStage(task: SyncTask, stage: SyncStage) {
  if (stage === SyncStage.SAVING) {
    updateTask(task, { stage });
  } else {
    updateTask(task, { stage, detail: null, current: 0, total: 0 });
  }
}

/** Report how far through writing a task's rows we are. */
export function setSyncSaveProgress(
  task: SyncTask,
  detail: string,
  current: number,
  total: number,
) {
  updateTask(task, { stage: SyncStage.SAVING, detail, current, total });
}

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  useSyncProgress.setState(initialSyncProgressState, true);
}
