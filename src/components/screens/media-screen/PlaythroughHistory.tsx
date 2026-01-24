import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";

import { PlaythroughContextMenu } from "@/components/PlaythroughContextMenu";
import { useLibraryData } from "@/services/library-service";
import {
  getAllPlaythroughsForMedia,
  PlaythroughForMedia,
} from "@/services/playthrough-query-service";
import { useDataVersion } from "@/stores/data-version";
import { useDebug } from "@/stores/debug";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors, decorative, surface } from "@/styles/colors";
import { Session } from "@/types/session";
import { timeAgo } from "@/utils/date";
import { secondsDisplay } from "@/utils/time";

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
  const loadedPlaythroughId = useTrackPlayer((state) => state.playthrough?.id);

  const primaryPlaythrough = playthroughs?.[0];
  if (!primaryPlaythrough) return null;

  const hasMultiple = playthroughs.length > 1;
  const otherPlaythroughs = playthroughs.slice(1);

  // Check if the primary in-progress playthrough is currently loaded in player
  const primaryIsNowPlaying =
    primaryPlaythrough.status === "in_progress" &&
    primaryPlaythrough.id === loadedPlaythroughId;

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

  const handleDebugTap = () => {
    router.push(`/playthrough-debug/${playthroughId}`);
  };

  const rowContent = (
    <>
      <View style={styles.iconContainer}>
        <FontAwesome6 name="book-open" size={18} color={Colors.zinc[100]} />
      </View>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: Colors.zinc[100] }]}>
            Now Playing
          </Text>
          <NowPlayingTimeInfo />
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
  const progress = useTrackPlayer((state) => state.progress);
  const playbackRate = useTrackPlayer((state) => state.playbackRate);

  const remainingBookTime = progress.duration - progress.position;
  const remainingRealTime = remainingBookTime / playbackRate;

  return (
    <Text style={styles.timeInfo}>
      {progress.percent.toFixed(1)}% · {secondsDisplay(remainingRealTime)} left
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
  // Use cache position if newer than playthrough position, otherwise use playthrough position
  const cachePosition =
    playthrough.stateCache?.position ?? playthrough.position;
  const cacheUpdatedAt = playthrough.stateCache?.updatedAt ?? new Date(0);
  const position =
    cacheUpdatedAt > playthrough.lastEventAt
      ? cachePosition
      : playthrough.position;
  const rate = playthrough.playbackRate;
  const duration = mediaDuration ?? 0;
  const percentage = duration > 0 ? Math.round((position / duration) * 100) : 0;
  const remainingBookTime = duration - position;
  const remainingRealTime =
    rate > 0 ? remainingBookTime / rate : remainingBookTime;

  const statusDate =
    playthrough.status === "finished"
      ? (playthrough.finishedAt ?? playthrough.lastEventAt)
      : playthrough.status === "abandoned"
        ? (playthrough.abandonedAt ?? playthrough.lastEventAt)
        : playthrough.lastEventAt;

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

  const handleDebugTap = () => {
    router.push(`/playthrough-debug/${playthrough.id}`);
  };

  const rowContent = (
    <>
      <View style={styles.iconContainer}>
        <FontAwesome6
          name={statusIcon}
          size={18}
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
      <PlaythroughContextMenu session={session} playthrough={playthrough} />
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
    backgroundColor: surface.card,
    borderRadius: 16,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: surface.base,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.zinc[800],
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
    fontSize: 15,
    fontWeight: "600",
  },
  timeInfo: {
    fontSize: 15,
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
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: decorative.divider,
  },
  moreText: {
    fontSize: 12,
    color: Colors.zinc[500],
  },
  expandedRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: decorative.divider,
  },
  debugRow: {
    borderWidth: 1,
    borderColor: Colors.lime[600],
    borderRadius: 8,
    padding: 8,
    margin: -8,
  },
});
