import { StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Colors } from "@/styles/colors";
import { formatBytes } from "@/utils/format";

type DownloadProgressProps = {
  bytesWritten?: number;
  totalBytes?: number;
};

/**
 * How far a download has got.
 *
 * One bar for the whole recording, however many files it is made of: the
 * reader is downloading a book, not a queue. Until the total is known — a
 * legacy server that sends no Content-Length — the bytes so far are shown
 * without a bar, because a bar with no end is worse than no bar.
 */
export function DownloadProgress({
  bytesWritten,
  totalBytes,
}: DownloadProgressProps) {
  if (bytesWritten === undefined) return null;

  const known = totalBytes !== undefined && totalBytes > 0;
  const percent = known
    ? Math.min(100, (bytesWritten / totalBytes) * 100)
    : null;

  return (
    <View style={styles.container}>
      {percent !== null && (
        <View style={styles.bar}>
          <ProgressBar percent={percent} />
        </View>
      )}
      <Text style={styles.text} numberOfLines={1}>
        {known
          ? `${formatBytes(bytesWritten)} of ${formatBytes(totalBytes)}`
          : formatBytes(bytesWritten)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    gap: 4,
  },
  bar: {
    width: "100%",
  },
  text: {
    fontSize: 12,
    color: Colors.zinc[400],
  },
});
