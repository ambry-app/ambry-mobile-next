import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useShallow } from "zustand/shallow";

import {
  getAllPlaythroughsForMedia,
  PlaythroughForMedia,
} from "@/db/playthroughs";
import { useLibraryData } from "@/hooks/use-library-data";
import useLoadMediaCallback from "@/hooks/use-load-media-callback";
import { useDataVersion } from "@/stores/data-version";
import {
  pauseIfPlaying,
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
  const playerMediaId = usePlayer((state) => state.mediaId);

  const primaryPlaythrough = playthroughs?.[0];
  if (!primaryPlaythrough) return null;

  const hasMultiple = playthroughs.length > 1;
  const otherPlaythroughs = playthroughs.slice(1);

  // Check if the primary in-progress playthrough is currently loaded in player
  const primaryIsNowPlaying =
    primaryPlaythrough.status === "in_progress" &&
    primaryPlaythrough.mediaId === playerMediaId;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {primaryIsNowPlaying ? (
          <NowPlayingRow />
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
 */
function NowPlayingRow() {
  // Use real-time player state
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
    <View style={styles.row}>
      <View style={styles.iconContainer}>
        <FontAwesome6 name="book-open" size={16} color={Colors.zinc[100]} />
      </View>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: Colors.zinc[100] }]}>
            Now Playing
          </Text>
          <Text style={styles.timeInfo}>
            {percentage}% · {secondsDisplay(remainingRealTime)} left
          </Text>
        </View>
        <Text style={styles.dateLabel}>Currently listening</Text>
      </View>
    </View>
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
    await pauseIfPlaying();
    await resumeAndLoadPlaythrough(
      session,
      playthrough.id,
      playthrough.mediaId,
    );
  }, [session, playthrough.id, playthrough.mediaId]);

  const handleMenu = () => {
    Alert.alert(
      "Playthrough Options",
      "What would you like to do with this playthrough?",
      [
        {
          text: "Delete Playthrough",
          style: "destructive",
          onPress: () => {
            // TODO: Implement delete
            Alert.alert("Coming Soon", "Delete functionality coming soon");
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  // Determine action button based on status
  const showActionButton = playthrough.status !== "finished";
  const actionLabel =
    playthrough.status === "in_progress" ? "Continue" : "Resume";
  const actionHandler =
    playthrough.status === "in_progress" ? handleContinue : handleResume;

  return (
    <View style={styles.row}>
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
      {showActionButton && (
        <TouchableOpacity onPress={actionHandler} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={handleMenu} style={styles.menuButton}>
        <FontAwesome6
          name="ellipsis-vertical"
          size={16}
          color={Colors.zinc[500]}
        />
      </TouchableOpacity>
    </View>
  );
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
  actionButton: {
    backgroundColor: Colors.zinc[700],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.zinc[100],
  },
  menuButton: {
    padding: 8,
    marginRight: -8,
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
});
