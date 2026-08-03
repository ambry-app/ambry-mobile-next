import { StyleSheet, Text, View } from "react-native";

import { Loading } from "@/components/Loading";
import { ProgressBar } from "@/components/ProgressBar";
import { ScreenCentered } from "@/components/ScreenCentered";
import {
  SyncStage,
  SyncTask,
  TaskProgress,
  useSyncProgress,
} from "@/stores/sync-progress";
import { Colors } from "@/styles/colors";

const TASK_NAMES: Record<SyncTask, string> = {
  [SyncTask.LIBRARY]: "Library",
  [SyncTask.EVENTS]: "Listening progress",
};

/** One line of plain English for what this task is doing right now. */
function statusText(progress: TaskProgress): string {
  switch (progress.stage) {
    case SyncStage.PENDING:
      return "Waiting…";
    case SyncStage.DOWNLOADING:
      return "Downloading…";
    case SyncStage.SAVING:
      return progress.detail ? `Saving ${progress.detail}…` : "Saving…";
    case SyncStage.DONE:
      return "Done";
    case SyncStage.FAILED:
      return "Failed";
  }
}

function percentComplete(progress: TaskProgress): number {
  if (progress.stage === SyncStage.DONE) return 100;
  if (progress.total === 0) return 0;

  return Math.min(100, (progress.current / progress.total) * 100);
}

function TaskRow({ task }: { task: SyncTask }) {
  const progress = useSyncProgress((state) => state.tasks[task]);
  const showCounts = progress.stage === SyncStage.SAVING && progress.total > 0;

  return (
    <View style={styles.task}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskName}>{TASK_NAMES[task]}</Text>
        <Text
          style={[
            styles.taskStatus,
            progress.stage === SyncStage.FAILED && styles.taskStatusFailed,
          ]}
        >
          {statusText(progress)}
        </Text>
      </View>

      <ProgressBar percent={percentComplete(progress)} />

      {showCounts && (
        <Text style={styles.counts}>
          {progress.current.toLocaleString()} of{" "}
          {progress.total.toLocaleString()}
        </Text>
      )}
    </View>
  );
}

/**
 * Shown while the first sync populates an empty database. Large libraries take
 * a while, so this names the step in progress rather than spinning silently.
 */
export function SyncProgress() {
  return (
    <ScreenCentered>
      <View style={styles.container}>
        <Loading />
        <Text style={styles.title}>Setting up your library</Text>
        <Text style={styles.subtitle}>
          This only happens once. Large libraries can take a few minutes.
        </Text>

        <View style={styles.tasks}>
          <TaskRow task={SyncTask.LIBRARY} />
          <TaskRow task={SyncTask.EVENTS} />
        </View>
      </View>
    </ScreenCentered>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    color: Colors.zinc[100],
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 12,
    textAlign: "center",
  },
  subtitle: {
    color: Colors.zinc[500],
    fontSize: 14,
    textAlign: "center",
  },
  tasks: {
    alignSelf: "stretch",
    marginTop: 24,
    gap: 24,
  },
  task: {
    alignSelf: "stretch",
    gap: 6,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  taskName: {
    color: Colors.zinc[100],
    fontSize: 16,
    fontWeight: "bold",
  },
  taskStatus: {
    color: Colors.zinc[400],
    fontSize: 14,
  },
  taskStatusFailed: {
    color: Colors.red[400],
  },
  counts: {
    color: Colors.zinc[500],
    fontSize: 12,
  },
});
