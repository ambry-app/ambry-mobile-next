import { consoleTransport, logger } from "react-native-logs";

export const logBase = logger.createLogger({
  enabled: __DEV__,
  severity: "debug",
  levels: {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
  },
  transport: consoleTransport,
  transportOptions: {
    colors: {
      trace: "magentaBright",
      debug: "blueBright",
      warn: "yellowBright",
      error: "redBright",
    },
    extensionColors: {
      "track-player-service": "magenta",
      "track-player-wrapper": "blue",
      "boot-service": "red",
      "sleep-timer-service": "black",
      "position-heartbeat": "grey",
      "accurate-play-pause-service": "cyan",
    },
  },
});
