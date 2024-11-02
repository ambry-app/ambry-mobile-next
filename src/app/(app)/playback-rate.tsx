import Button from "@/src/components/Button";
import useBackHandler from "@/src/hooks/use.back.handler";
import { usePlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { formatPlaybackRate } from "@/src/utils/rate";
import { secondsDisplay } from "@/src/utils/time";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";

export default function PlaybackRateModal() {
  useBackHandler(() => {
    router.back();
    return true;
  });

  const { session } = useSession((state) => state);

  const { position, duration, playbackRate, setPlaybackRate } = usePlayer(
    (state) => state,
  );

  const [displayPlaybackRate, setDisplayPlaybackRate] = useState(1.0);

  useEffect(() => {
    setDisplayPlaybackRate(playbackRate);
  }, [playbackRate]);

  const setPlaybackRateAndDisplay = useCallback(
    (value: number) => {
      if (!session) return;
      setDisplayPlaybackRate(value);
      setPlaybackRate(session, value);
    },
    [session, setPlaybackRate],
  );

  if (!session) return null;

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>
          {formatPlaybackRate(displayPlaybackRate)}×
        </Text>
        <Slider
          value={playbackRate}
          minimumValue={0.5}
          maximumValue={3.0}
          step={0.05}
          thumbTintColor={colors.lime[400]}
          minimumTrackTintColor={colors.zinc[400]}
          maximumTrackTintColor={colors.zinc[400]}
          onValueChange={(value) => {
            console.log(value);
            setDisplayPlaybackRate(parseFloat(value.toFixed(2)));
          }}
          onSlidingComplete={(value) => {
            console.log(value);
            setPlaybackRateAndDisplay(parseFloat(value.toFixed(2)));
          }}
        />
      </View>

      <View style={styles.rateButtonRow}>
        <PlaybackRateButton
          rate={1.0}
          setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
        />
        <PlaybackRateButton
          rate={1.25}
          setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
        />
        <PlaybackRateButton
          rate={1.5}
          setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
        />
        <PlaybackRateButton
          rate={1.75}
          setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
        />
        <PlaybackRateButton
          rate={2.0}
          setPlaybackRateAndDisplay={setPlaybackRateAndDisplay}
        />
      </View>

      <Text style={styles.timeLeftText}>
        Finish in{" "}
        {secondsDisplay(Math.max(duration - position, 0) / displayPlaybackRate)}
      </Text>

      <Button
        size={32}
        onPress={() => router.back()}
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </Button>
    </View>
  );
}

type PlaybackRateButtonProps = {
  rate: number;
  setPlaybackRateAndDisplay: (value: number) => void;
};

function PlaybackRateButton(props: PlaybackRateButtonProps) {
  const { rate, setPlaybackRateAndDisplay } = props;

  return (
    <Button
      size={16}
      style={styles.rateButton}
      onPress={() => setPlaybackRateAndDisplay(rate)}
    >
      <Text style={styles.text}>{formatPlaybackRate(rate)}×</Text>
    </Button>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    backgroundColor: colors.zinc[950],
    height: "100%",
    display: "flex",
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: colors.zinc[100],
    margin: 16,
    fontSize: 18,
    textAlign: "center",
  },
  rateButtonRow: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
  },
  rateButton: {
    backgroundColor: colors.zinc[800],
    borderRadius: 999,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  text: {
    color: colors.zinc[100],
    fontSize: 12,
  },
  timeLeftText: {
    color: colors.zinc[400],
    textAlign: "center",
  },
  closeButton: {
    marginTop: 32,
  },
  closeButtonText: {
    color: colors.lime[400],
  },
});