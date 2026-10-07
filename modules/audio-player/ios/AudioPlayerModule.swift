import ExpoModulesCore

/// The JS boundary, mirroring the Android module. Calls hop to the main
/// thread and resolve there (same ordering guarantee); seeks resolve only
/// once landed, because AVPlayer's position reads lag a pending seek.
public class AudioPlayerModule: Module {
  struct TrackRecord: Record {
    @Field var url: String = ""
    @Field var title: String? = nil
    @Field var artist: String? = nil
    @Field var artwork: String? = nil
    @Field var headers: [String: String]? = nil
    @Field var type: String = "default"
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
