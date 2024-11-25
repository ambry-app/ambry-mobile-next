import { ListedDownload } from "@/src/db/downloads";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import colors from "tailwindcss/colors";

export default function FileSize({ download }: { download: ListedDownload }) {
  const [size, setSize] = useState<string | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  useEffect(() => {
    (async function () {
      const info = await FileSystem.getInfoAsync(download.filePath);
      if (!info.exists) {
        setIsMissing(true);
      }
      if (info.exists && !info.isDirectory) {
        setSize(formatBytes(info.size));
      }
    })();
  }, [download.filePath]);

  if (isMissing) return <Text style={styles.errorText}>file is missing!</Text>;

  if (!size) return null;

  return (
    <Text style={styles.text} numberOfLines={1}>
      {size} and some more text here and some more text here and some more text
      here and some more text here and some more text here
    </Text>
  );
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    "Bytes",
    "KiB",
    "MiB",
    "GiB",
    "TiB",
    "PiB",
    "EiB",
    "ZiB",
    "YiB",
  ];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const styles = StyleSheet.create({
  text: {
    color: colors.zinc[400],
    fontSize: 10,
  },
  errorText: {
    color: colors.red[500],
    fontSize: 10,
  },
});
