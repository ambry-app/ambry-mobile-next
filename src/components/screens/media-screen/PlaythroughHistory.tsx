import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { PlaythroughContextMenu } from "@/components";
import {
  deletePlaythrough,
  getAllPlaythroughsForMedia,
  PlaythroughForMedia,
} from "@/db/playthroughs";
import { useLibraryData } from "@/hooks/use-library-data";
import useLoadMediaCallback from "@/hooks/use-load-media-callback";
import {
  bumpPlaythroughDataVersion,
  useDataVersion,
} from "@/stores/data-version";
import { useDebug } from "@/stores/debug";
import {
  abandonPlaythrough,
  finishPlaythrough,
  resumeAndLoadPlaythrough,
  usePlayer,
} from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";
import { timeAgo } from "@/utils/date";

type PlaythroughHistoryProps = {
  session: Session;
  mediaId: string;
  mediaDuration: number | null;
};

export function PlaythroughHistory({
  session,
  mediaId,
  mediaDuration,
}: PlaythroughHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );
  const playthroughs = useLibraryData(
    () => getAllPlaythroughsForMedia(session, mediaId),
    [mediaId, playthroughVersion],
  );

  // Get current player state for "Now Playing" detection
  const loadedMediaId = usePlayer((state) => state.loadedPlaythrough?.mediaId);

  const primaryPlaythrough = playthroughs?.[0];
  if (!primaryPlaythrough) return null;

  const hasMultiple = playthroughs.length > 1;
  const otherPlaythroughs = playthroughs.slice(1);

  // Check if the primary in-progress playthrough is currently loaded in player
  const primaryIsNowPlaying =
    primaryPlaythrough.status === "in_progress" &&
    primaryPlaythrough.mediaId === loadedMediaId;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {primaryIsNowPlaying ? (
          <NowPlayingRow playthroughId={primaryPlaythrough.id} />
        ) : (
          <PlaythroughRow
            session={session}
            playthrough={primaryPlaythrough}
            mediaDuration={mediaDuration}
          />
        )}

        {expanded &&
          otherPlaythroughs.map((playthrough) => (
            <View key={playthrough.id} style={styles.expandedRow}>
              <PlaythroughRow
                session={session}
                playthrough={playthrough}
                mediaDuration={mediaDuration}
              />
            </View>
          ))}

        {hasMultiple && (
          <Pressable
            onPress={() => setExpanded(!expanded)}
            style={styles.expandIndicator}
          >
            <Text style={styles.moreText}>
              {expanded
                ? "Hide"
                : `${otherPlaythroughs.length} more playthrough${otherPlaythroughs.length > 1 ? "s" : ""}`}
            </Text>
            <FontAwesome6
              name={expanded ? "chevron-up" : "chevron-down"}
              size={12}
              color={Colors.zinc[500]}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Special row for the currently playing media that shows real-time player state.
 * Uses conditional rendering to avoid subscribing to frequent updates when hidden.
 */
function NowPlayingRow({ playthroughId }: { playthroughId: string }) {
  const debugModeEnabled = useDebug((state) => state.debugModeEnabled);
  // Check if this screen is visible (not hidden behind expanded player)
  const shouldRenderMini = usePlayer((state) => state.shouldRenderMini);

  const handleDebugTap = () => {
    router.push(`/playthrough-debug/${playthroughId}`);
  };

  // Time info is only shown when visible (requires subscription to position updates)
  const timeInfo = shouldRenderMini ? <NowPlayingTimeInfo /> : null;

  const rowContent = (
    <>
      <View style={styles.iconContainer}>
        <FontAwesome6 name="book-open" size={16} color={Colors.zinc[100]} />
      </View>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: Colors.zinc[100] }]}>
            Now Playing
          </Text>
          {timeInfo}
        </View>
        <Text style={styles.dateLabel}>Currently listening</Text>
      </View>
    </>
  );

  if (debugModeEnabled) {
    return (
      <Pressable style={[styles.row, styles.debugRow]} onPress={handleDebugTap}>
        {rowContent}
      </Pressable>
    );
  }

  return <View style={styles.row}>{rowContent}</View>;
}

/**
 * Subscribes to real-time player state for time display.
 * Only mounted when the screen is visible (not hidden behind expanded player).
 */
function NowPlayingTimeInfo() {
  const { position, duration, playbackRate } = usePlayer(
    useShallow(({ position, duration, playbackRate }) => ({
      position,
      duration,
      playbackRate,
    })),
  );

  const percentage = duration > 0 ? Math.round((position / duration) * 100) : 0;
  const remainingBookTime = duration - position;
  const remainingRealTime =
    playbackRate > 0 ? remainingBookTime / playbackRate : remainingBookTime;

  return (
    <Text style={styles.timeInfo}>
      {percentage}% · {secondsDisplay(remainingRealTime)} left
    </Text>
  );
}

type PlaythroughRowProps = {
  session: Session;
  playthrough: PlaythroughForMedia;
  mediaDuration: number | null;
};

function PlaythroughRow({
  session,
  playthrough,
  mediaDuration,
}: PlaythroughRowProps) {
  const debugModeEnabled = useDebug((state) => state.debugModeEnabled);
  const position = playthrough.stateCache?.currentPosition ?? 0;
  const rate = playthrough.stateCache?.currentRate ?? 1;
  const duration = mediaDuration ?? 0;
  const percentage = duration > 0 ? Math.round((position / duration) * 100) : 0;
  const remainingBookTime = duration - position;
  const remainingRealTime =
    rate > 0 ? remainingBookTime / rate : remainingBookTime;

  const statusDate =
    playthrough.status === "finished"
      ? (playthrough.finishedAt ?? playthrough.updatedAt)
      : playthrough.status === "abandoned"
        ? (playthrough.abandonedAt ?? playthrough.updatedAt)
        : (playthrough.stateCache?.lastEventAt ?? playthrough.updatedAt);

  const statusIcon =
    playthrough.status === "in_progress"
      ? "book-open"
      : playthrough.status === "finished"
        ? "circle-check"
        : "circle-xmark";

  const statusColor =
    playthrough.status === "in_progress"
      ? Colors.zinc[100]
      : playthrough.status === "finished"
        ? Colors.zinc[300]
        : Colors.zinc[500];

  const statusLabel =
    playthrough.status === "in_progress"
      ? "In Progress"
      : playthrough.status === "finished"
        ? "Finished"
        : "Abandoned";

  const timeInfo =
    playthrough.status === "in_progress"
      ? `${percentage}% · ${secondsDisplay(remainingRealTime)} left`
      : playthrough.status === "abandoned"
        ? `${percentage}% (${secondsDisplay(position)})`
        : null;

  const dateLabel =
    playthrough.status === "in_progress"
      ? `Last listened ${timeAgo(statusDate)}`
      : playthrough.status === "finished"
        ? timeAgo(statusDate)
        : timeAgo(statusDate);

  // Handler for continuing an in-progress playthrough (uses existing hook)
  const handleContinue = useLoadMediaCallback(session, playthrough.mediaId);

  // Handler for resuming an abandoned or finished playthrough
  const handleResume = useCallback(async () => {
    await resumeAndLoadPlaythrough(session, playthrough.id);
  }, [session, playthrough.id]);

  const handleMarkFinished = useCallback(async () => {
    await finishPlaythrough(session, playthrough.id);
  }, [session, playthrough.id]);

  const handleAbandon = useCallback(async () => {
    await abandonPlaythrough(session, playthrough.id);
  }, [session, playthrough.id]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Playthrough",
      "Are you sure you want to delete this playthrough? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deletePlaythrough(session, playthrough.id);
            bumpPlaythroughDataVersion();
          },
        },
      ],
    );
  }, [session, playthrough.id]);

  const handleDebugTap = () => {
    router.push(`/playthrough-debug/${playthrough.id}`);
  };

  const rowContent = (
    <>
      <View style={styles.iconContainer}>
        <FontAwesome6
          name={statusIcon}
          size={16}
          color={statusColor}
          solid={playthrough.status === "finished"}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {statusLabel}
          </Text>
          {timeInfo && <Text style={styles.timeInfo}>{timeInfo}</Text>}
        </View>
        <Text style={styles.dateLabel}>{dateLabel}</Text>
      </View>
      <PlaythroughContextMenu
        status={playthrough.status}
        onContinue={
          playthrough.status === "in_progress" ? handleContinue : undefined
        }
        onResume={
          playthrough.status === "abandoned" ||
          playthrough.status === "finished"
            ? handleResume
            : undefined
        }
        onMarkFinished={handleMarkFinished}
        onAbandon={handleAbandon}
        onDelete={handleDelete}
      />
    </>
  );

  if (debugModeEnabled) {
    return (
      <Pressable style={[styles.row, styles.debugRow]} onPress={handleDebugTap}>
        {rowContent}
      </Pressable>
    );
  }

  return <View style={styles.row}>{rowContent}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  card: {
    backgroundColor: Colors.zinc[900],
    borderRadius: 12,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.zinc[700],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  timeInfo: {
    fontSize: 14,
    color: Colors.zinc[400],
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.zinc[500],
    marginTop: 2,
  },
  expandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.zinc[700],
  },
  moreText: {
    fontSize: 12,
    color: Colors.zinc[500],
  },
  expandedRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.zinc[700],
  },
  debugRow: {
    borderWidth: 1,
    borderColor: Colors.lime[600],
    borderRadius: 8,
    padding: 8,
    margin: -8,
  },
});
