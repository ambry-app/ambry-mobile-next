import ExpoModulesCore

/// The JS boundary, mirroring the Android module function for function. Every
/// call hops to the main thread before touching the player and resolves its
/// promise from there, so callers get the same ordering guarantee on both
/// platforms: a `seekTo` awaited before a `play` has been applied before the
/// play is. Seeks additionally resolve only once the seek has landed, because
/// AVPlayer's position reads don't reflect a seek until it completes.
public class AudioPlayerModule: Module {
  struct TrackRecord: Record {
    @Field var url: String = ""
    @Field var title: String? = nil
    @Field var artist: String? = nil
    @Field var artwork: String? = nil
    @Field var headers: [String: String]? = nil
    @Field var type: String = "default"

    // Seconds. The player derives real durations from the media; this feeds
    // the lock screen's book-time translation, so its bar can show the book
    // rather than the file currently playing.
    @Field var duration: Double? = nil
  }

  public func definition() -> ModuleDefinition {
    Name("AudioPlayer")

    Events("onStateChange", "onRemoteCommand", "onQueueEnded", "onError")

    OnCreate {
      PlayerCore.shared.emit = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    OnDestroy {
      PlayerCore.shared.emit = nil
      DispatchQueue.main.async {
        PlayerCore.shared.release()
      }
    }

    AsyncFunction("setup") { (promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.setup()
        promise.resolve()
      }
    }

    AsyncFunction("setQueue") { (tracks: [TrackRecord], promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.setQueue(
          tracks.map { track in
            PlayerCore.TrackSpec(
              url: track.url,
              title: track.title,
              artist: track.artist,
              artworkUrl: track.artwork,
              headers: track.headers ?? [:],
              type: track.type,
              durationSeconds: track.duration
            )
          }
        )
        promise.resolve()
      }
    }

    AsyncFunction("play") { (promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.play()
        promise.resolve()
      }
    }

    AsyncFunction("pause") { (promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.pause()
        promise.resolve()
      }
    }

    AsyncFunction("seekTo") { (index: Int, seconds: Double, promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.seek(index: index, seconds: seconds) {
          promise.resolve()
        }
      }
    }

    AsyncFunction("setRate") { (rate: Double, promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.setRate(rate)
        promise.resolve()
      }
    }

    AsyncFunction("setVolume") { (volume: Double, promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.setVolume(volume)
        promise.resolve()
      }
    }

    AsyncFunction("reset") { (promise: Promise) in
      DispatchQueue.main.async {
        PlayerCore.shared.reset()
        promise.resolve()
      }
    }

    AsyncFunction("getState") { (promise: Promise) in
      DispatchQueue.main.async {
        promise.resolve(PlayerCore.shared.snapshot())
      }
    }
  }
}
