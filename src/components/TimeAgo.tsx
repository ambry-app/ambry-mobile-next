import { useEffect, useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { Colors } from "@/styles";
import { timeAgo } from "@/utils/date";

type TimeAgoProps = {
  date: Date;
  style?: StyleProp<TextStyle>;
};

/**
 * Get the appropriate refresh interval based on how old the date is.
 * More recent = more frequent updates.
 */
function getRefreshInterval(date: Date): number | null {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    // Less than 1 minute: update every second
    return 1000;
  }
  if (seconds < 3600) {
    // Less than 1 hour: update every minute
    return 60 * 1000;
  }
  if (seconds < 86400) {
    // Less than 1 day: update every hour
    return 60 * 60 * 1000;
  }
  // Older than 1 day: no need to update
  return null;
}

export function TimeAgo({ date, style }: TimeAgoProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      const delay = getRefreshInterval(date);
      if (delay === null) return;

      timeoutId = setTimeout(() => {
        setTick((t) => t + 1);
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [date]);

  return (
    <Text style={[styles.text, style]} numberOfLines={1}>
      {timeAgo(date)}
    </Text>
  );
}

const styles = {
  text: {
    fontSize: 14,
    color: Colors.zinc[400],
    marginBottom: 4,
  },
};
