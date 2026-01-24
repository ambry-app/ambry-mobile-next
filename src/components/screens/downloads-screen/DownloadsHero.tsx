import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { File } from "expo-file-system";

import { DownloadedMedia } from "@/services/library-service";
import { useDownloads } from "@/stores/downloads";
import { Colors, surface } from "@/styles/colors";
import { formatBytes } from "@/utils/format";
import { documentDirectoryFilePath } from "@/utils/paths";

type DownloadsHeroProps = {
  media: DownloadedMedia[];
};

export function DownloadsHero({ media }: DownloadsHeroProps) {
  const [totalSize, setTotalSize] = useState<number | null>(null);

  // Subscribe to download updates (status) to refresh size calculation
  const updateTrigger = useDownloads((state) =>
    media
      .map((m) => {
        const d = state.downloads[m.id];
        return d ? d.status : "";
      })
      .join("|"),
  );

  useEffect(() => {
    let isMounted = true;
    const calculateSize = async () => {
      // Parallelize checks for speed
      const promises = media.map(async (item) => {
        if (item.download.filePath) {
          try {
            const file = new File(
              documentDirectoryFilePath(item.download.filePath),
            );
            if (file.exists) {
              return file.size;
            }
          } catch {
            // ignore
          }
        }
        return 0;
      });

      const sizes = await Promise.all(promises);
      const sum = sizes.reduce((a, b) => a + b, 0);

      if (isMounted) setTotalSize(sum);
    };

    calculateSize();
    return () => {
      isMounted = false;
    };
  }, [media, updateTrigger]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <FontAwesome6 name="download" size={24} color={Colors.zinc[100]} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{media.length}</Text>
            <Text style={styles.statLabel}>
              {media.length === 1 ? "Audiobook" : "Audiobooks"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {totalSize !== null ? formatBytes(totalSize) : "..."}
            </Text>
            <Text style={styles.statLabel}>Used Space</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  content: {
    backgroundColor: surface.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: surface.base,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.zinc[800],
  },
  statsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: Colors.zinc[100],
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.zinc[400],
    fontSize: 13,
    fontWeight: "500",
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.zinc[700],
  },
});
