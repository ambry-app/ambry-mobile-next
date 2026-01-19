import { FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import {
  getPlaythroughForDebug,
  PlaythroughDebugData,
} from "@/db/playthroughs";
import { PlaybackEventSelect } from "@/db/schema";
import { useLibraryData } from "@/services/library-service";
import { Colors } from "@/styles/colors";

export default function PlaythroughDebugRoute() {
  const { id: playthroughId } = useLocalSearchParams<{ id: string }>();

  // This debug screen shows data at page load time.
  // Navigate away and back to see updates.
  const data = useLibraryData(
    () => getPlaythroughForDebug(playthroughId),
    [playthroughId],
  );

  if (!data) {
    return (
      <>
        <Stack.Screen options={{ title: "Debug: Playthrough" }} />
        <View style={styles.container}>
          <Text style={styles.text}>Loading...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Debug: Playthrough" }} />
      <FlatList
        style={styles.container}
        ListHeaderComponent={<PlaythroughHeader data={data} />}
        data={data.events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventRow event={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </>
  );
}

function PlaythroughHeader({ data }: { data: PlaythroughDebugData }) {
  const { playthrough } = data;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Playthrough</Text>
      <DebugField label="id" value={playthrough.id} />
      <DebugField label="url" value={playthrough.url} />
      <DebugField label="userEmail" value={playthrough.userEmail} />
      <DebugField label="mediaId" value={playthrough.mediaId} />
      <DebugField label="status" value={playthrough.status} />
      <DebugField label="startedAt" value={formatDate(playthrough.startedAt)} />
      <DebugField
        label="finishedAt"
        value={formatDate(playthrough.finishedAt)}
      />
      <DebugField
        label="abandonedAt"
        value={formatDate(playthrough.abandonedAt)}
      />
      <DebugField label="deletedAt" value={formatDate(playthrough.deletedAt)} />
      <DebugField label="position" value={playthrough.position.toFixed(2)} />
      <DebugField
        label="playbackRate"
        value={playthrough.playbackRate.toFixed(2)}
      />
      <DebugField
        label="lastEventAt"
        value={formatDate(playthrough.lastEventAt)}
      />
      <DebugField
        label="refreshedAt"
        value={formatDate(playthrough.refreshedAt)}
      />

      {playthrough.stateCache && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            State Cache (Crash Recovery)
          </Text>
          <DebugField
            label="position"
            value={playthrough.stateCache.position.toFixed(2)}
          />
          <DebugField
            label="updatedAt"
            value={formatDate(playthrough.stateCache.updatedAt)}
          />
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
        Events ({data.events.length})
      </Text>
    </View>
  );
}

function EventRow({ event }: { event: PlaybackEventSelect }) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventType}>{event.type}</Text>
        <Text style={styles.eventTimestamp}>{formatDate(event.timestamp)}</Text>
      </View>
      <View style={styles.eventDetails}>
        {event.position !== null && (
          <Text style={styles.eventDetail}>
            pos: {event.position.toFixed(2)}
          </Text>
        )}
        {event.playbackRate !== null && (
          <Text style={styles.eventDetail}>rate: {event.playbackRate}</Text>
        )}
        {event.fromPosition !== null && (
          <Text style={styles.eventDetail}>
            from: {event.fromPosition.toFixed(2)}
          </Text>
        )}
        {event.toPosition !== null && (
          <Text style={styles.eventDetail}>
            to: {event.toPosition.toFixed(2)}
          </Text>
        )}
        {event.previousRate !== null && (
          <Text style={styles.eventDetail}>prevRate: {event.previousRate}</Text>
        )}
      </View>
      <Text style={styles.eventId}>{event.id}</Text>
      {event.syncedAt && (
        <Text style={styles.eventSynced}>
          synced: {formatDate(event.syncedAt)}
        </Text>
      )}
    </View>
  );
}

function DebugField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{value ?? "-"}</Text>
    </View>
  );
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return date.toISOString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  text: {
    color: Colors.zinc[100],
    padding: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: Colors.lime[400],
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  fieldLabel: {
    color: Colors.zinc[500],
    fontSize: 12,
    width: 120,
    fontFamily: "monospace",
  },
  fieldValue: {
    color: Colors.zinc[300],
    fontSize: 12,
    flex: 1,
    fontFamily: "monospace",
  },
  separator: {
    height: 1,
    backgroundColor: Colors.zinc[800],
    marginHorizontal: 16,
  },
  eventRow: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventType: {
    color: Colors.lime[300],
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  eventTimestamp: {
    color: Colors.zinc[400],
    fontSize: 11,
    fontFamily: "monospace",
  },
  eventDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  eventDetail: {
    color: Colors.zinc[300],
    fontSize: 12,
    fontFamily: "monospace",
  },
  eventId: {
    color: Colors.zinc[600],
    fontSize: 10,
    marginTop: 4,
    fontFamily: "monospace",
  },
  eventSynced: {
    color: Colors.zinc[500],
    fontSize: 10,
    fontFamily: "monospace",
  },
});
