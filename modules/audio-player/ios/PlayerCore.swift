import AVFoundation
import MediaPlayer
import UIKit

/// The one AVQueuePlayer, plus the two system surfaces the player feeds:
/// MPRemoteCommandCenter (media keys, lock screen, control center buttons in)
/// and MPNowPlayingInfoCenter (what those surfaces display). The Android half
/// splits this between PlayerCore and PlaybackService because Android puts a
/// media session inside a foreground service; iOS has no service and no task
/// removal - JS keeps running under `UIBackgroundModes: ["audio"]` - so the
/// whole native half fits in this one object.
///
/// Transport commands from remote surfaces are NOT acted on here. The command
/// center is handler-based, so a command arrives with nothing having happened
/// yet - exactly the contract the Android ForwardingPlayer has to fight for -
/// and each handler just reports it to JS, which owns rate-scaled seeks and
/// pause-rewind ordering, then drives the player through the ordinary API.
///
/// Everything runs on the main thread: the module dispatches every call there,
/// and observation callbacks hop there before touching state. That is what
/// makes the promise-ordering guarantee (a seekTo awaited before a play has
/// been applied before the play is) hold on this platform too.
final class PlayerCore {
  static let shared = PlayerCore()

  static let seekIncrementSeconds = 10.0

  struct TrackSpec {
    let url: String
    let title: String?
    let artist: String?
    let artworkUrl: String?
    let headers: [String: String]
    let type: String
    let durationSeconds: Double?
  }

  /// Wired by the module; events are dropped while the JS runtime is gone.
  var emit: ((String, [String: Any]) -> Void)?

  private var player: AVQueuePlayer?
  private var tracks: [TrackSpec] = []
  private var currentIndex = 0

  /// AVQueuePlayer consumes items as it advances and every rebuild creates
  /// fresh ones (an AVPlayerItem cannot be re-inserted), so the queue's items
  /// carry no index of their own - this map is how an item's notifications
  /// and transitions find their way back to a track.
  private var itemIndices: [ObjectIdentifier: Int] = [:]

  /// Play intent, kept apart from whether audio is actually running:
  /// AVPlayer's rate drops to zero for stalls and interruptions without the
  /// intent changing, and the lock-screen toggle resolves against intent.
  private var playWhenReady = false
  private var desiredRate: Float = 1.0

  /// AVQueuePlayer ends with `currentItem == nil` and every read zeroed, so
  /// the ended state has to be remembered alongside where the book stopped -
  /// media3 keeps reporting the final position in STATE_ENDED and callers
  /// were written against that.
  private var ended = false
  private var endedPositionSeconds = 0.0

  /// True while a rebuild is tearing the queue down, so the transient
  /// `currentItem` changes it causes are not mistaken for playback advancing.
  private var suppressItemTransitions = false

  /// Where each file starts on the book's timeline, and the book's whole
  /// length. This is what lets the LOCK SCREEN speak book time: its bar must
  /// read "3:12:44 of 14:02:10", not where file 23 of 40 happens to be. Nil
  /// when the queue is a single stream (already the whole book) or a duration
  /// is missing, in which case file time is shown as-is.
  private var bookOffsets: [Double]?
  private var bookDurationSeconds = 0.0

  private var timeControlObservation: NSKeyValueObservation?
  private var currentItemObservation: NSKeyValueObservation?
  private var itemStatusObservation: NSKeyValueObservation?
  private var notificationTokens: [NSObjectProtocol] = []
  private var commandTargets: [(MPRemoteCommand, Any)] = []

  private var artwork: MPMediaItemArtwork?
  private var artworkUrlLoaded: String?

  private var wasPlayingBeforeInterruption = false

  // MARK: - Lifecycle

  func setup() {
    guard player == nil else { return }

    // .spokenAudio tells the system this is speech: other audio that ducks
    // around us pauses instead, and the media controls surface accordingly.
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .spokenAudio, options: [])

    let queuePlayer = AVQueuePlayer()
    player = queuePlayer

    timeControlObservation = queuePlayer.observe(\.timeControlStatus, options: [.new]) {
      [weak self] _, _ in
      DispatchQueue.main.async {
        self?.emitState()
        self?.updateNowPlaying()
      }
    }

    currentItemObservation = queuePlayer.observe(\.currentItem, options: [.new]) {
      [weak self] _, _ in
      DispatchQueue.main.async { self?.handleCurrentItemChange() }
    }

    observeNotifications()
    configureRemoteCommands()
  }

  func release() {
    timeControlObservation = nil
    currentItemObservation = nil
    itemStatusObservation = nil
    notificationTokens.forEach { NotificationCenter.default.removeObserver($0) }
    notificationTokens = []
    commandTargets.forEach { command, target in command.removeTarget(target) }
    commandTargets = []
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    player?.pause()
    player = nil
    tracks = []
    itemIndices = [:]
  }

  // MARK: - Queue

  func setQueue(_ specs: [TrackSpec]) {
    guard player != nil else { return }

    tracks = specs
    ended = false
    endedPositionSeconds = 0.0

    if specs.count > 1, specs.allSatisfy({ $0.durationSeconds != nil }) {
      var offsets: [Double] = []
      var elapsed = 0.0
      for spec in specs {
        offsets.append(elapsed)
        elapsed += spec.durationSeconds ?? 0.0
      }
      bookOffsets = offsets
      bookDurationSeconds = elapsed
    } else {
      bookOffsets = nil
      bookDurationSeconds = 0.0
    }

    rebuildQueue(from: 0)
    loadArtwork(for: specs.first)
    emitState()
    updateNowPlaying()
  }

  func reset() {
    guard let player else { return }

    suppressItemTransitions = true
    player.pause()
    player.removeAllItems()
    suppressItemTransitions = false

    tracks = []
    itemIndices = [:]
    currentIndex = 0
    playWhenReady = false
    ended = false
    endedPositionSeconds = 0.0
    bookOffsets = nil
    bookDurationSeconds = 0.0
    artwork = nil
    artworkUrlLoaded = nil
    itemStatusObservation = nil

    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    emitState()
  }

  // MARK: - Transport

  func play() {
    guard let player else { return }

    playWhenReady = true
    try? AVAudioSession.sharedInstance().setActive(true)

    // Setting a nonzero rate IS the play command, and it keeps
    // automaticallyWaitsToMinimizeStalling in charge: the player reports
    // waitingToPlayAtSpecifiedRate (our "buffering") until it can sustain
    // playback. defaultRate covers system-initiated resumes on iOS 16+.
    if #available(iOS 16.0, *) {
      player.defaultRate = desiredRate
    }
    player.rate = desiredRate

    emitState()
    updateNowPlaying()
  }

  func pause() {
    guard let player else { return }
    playWhenReady = false
    player.pause()
    emitState()
    updateNowPlaying()
  }

  func seek(index: Int, seconds: Double, completion: @escaping () -> Void) {
    guard let player, !tracks.isEmpty else {
      completion()
      return
    }

    let target = min(max(index, 0), tracks.count - 1)
    ended = false

    // A natural queue end leaves the player empty, so seeking after it must
    // rebuild no matter which index is asked for.
    if target == currentIndex, let item = player.currentItem {
      item.seek(
        to: CMTime(seconds: seconds, preferredTimescale: 1000),
        toleranceBefore: .zero,
        toleranceAfter: .zero
      ) { [weak self] _ in
        DispatchQueue.main.async {
          self?.emitState()
          self?.updateNowPlaying()
          completion()
        }
      }
      return
    }

    // Crossing into another file: AVQueuePlayer only advances forward, so the
    // queue is rebuilt from the target file. Playback is held during the
    // rebuild and the seek lands before it resumes, which is what "atomic
    // skip-to-(index, position)" means here - the listener never hears the
    // head of the target file first.
    let wasPlaying = playWhenReady
    player.pause()
    rebuildQueue(from: target)

    guard let item = player.currentItem else {
      emitState()
      completion()
      return
    }

    item.seek(
      to: CMTime(seconds: seconds, preferredTimescale: 1000),
      toleranceBefore: .zero,
      toleranceAfter: .zero
    ) { [weak self] _ in
      DispatchQueue.main.async {
        guard let self else {
          completion()
          return
        }
        if wasPlaying, self.playWhenReady {
          self.player?.rate = self.desiredRate
        }
        self.emitState()
        self.updateNowPlaying()
        completion()
      }
    }
  }

  func setRate(_ rate: Double) {
    desiredRate = Float(rate)
    if #available(iOS 16.0, *) {
      player?.defaultRate = desiredRate
    }
    if playWhenReady {
      player?.rate = desiredRate
    }
    emitState()
    updateNowPlaying()
  }

  func setVolume(_ volume: Double) {
    player?.volume = Float(volume)
  }

  // MARK: - State

  func snapshot() -> [String: Any] {
    guard let player, !tracks.isEmpty else {
      return [
        "state": "idle",
        "playing": false,
        "playWhenReady": false,
        "index": 0,
        "positionSeconds": 0.0,
        "durationSeconds": 0.0,
        "bufferedSeconds": 0.0,
        "rate": Double(desiredRate),
      ]
    }

    let item = player.currentItem

    let state: String
    if ended {
      state = "ended"
    } else if let item {
      switch item.status {
      case .readyToPlay:
        state = player.timeControlStatus == .waitingToPlayAtSpecifiedRate ? "buffering" : "ready"
      case .failed:
        state = "idle"
      default:
        state = "buffering"
      }
    } else {
      state = "idle"
    }

    return [
      "state": state,
      "playing": player.timeControlStatus == .playing,
      "playWhenReady": playWhenReady,
      "index": currentIndex,
      "positionSeconds": ended ? endedPositionSeconds : positionSeconds(),
      "durationSeconds": itemDurationSeconds(),
      "bufferedSeconds": bufferedSeconds(),
      "rate": Double(desiredRate),
    ]
  }

  private func emitState() {
    emit?("onStateChange", snapshot())
  }

  private func positionSeconds() -> Double {
    guard let player else { return 0.0 }
    let seconds = player.currentTime().seconds
    return seconds.isFinite && seconds >= 0 ? seconds : 0.0
  }

  private func itemDurationSeconds() -> Double {
    if let item = player?.currentItem {
      let seconds = item.duration.seconds
      if seconds.isFinite && seconds > 0 { return seconds }
    }
    guard currentIndex < tracks.count else { return 0.0 }
    return tracks[currentIndex].durationSeconds ?? 0.0
  }

  private func bufferedSeconds() -> Double {
    guard let player, let item = player.currentItem else { return 0.0 }
    let current = player.currentTime()
    var buffered = 0.0
    for value in item.loadedTimeRanges {
      let range = value.timeRangeValue
      if range.containsTime(current) || range.start <= current {
        buffered = max(buffered, range.end.seconds)
      }
    }
    return buffered.isFinite ? buffered : 0.0
  }

  // MARK: - Queue internals

  private func rebuildQueue(from index: Int) {
    guard let player else { return }

    suppressItemTransitions = true
    player.removeAllItems()
    itemIndices = [:]
    for trackIndex in index..<tracks.count {
      let item = makeItem(tracks[trackIndex])
      itemIndices[ObjectIdentifier(item)] = trackIndex
      player.insert(item, after: nil)
    }
    currentIndex = index
    suppressItemTransitions = false

    if let item = player.currentItem {
      observeStatus(of: item)
    }
  }

  /// Each item gets its own asset because headers are per-track: streamed
  /// files carry the session's bearer token, downloaded files carry nothing.
  /// The header option only applies to HTTP requests, so local playback never
  /// sees it. `type` needs no dispatch here: iOS is only ever served HLS for
  /// legacy media, and AVPlayer identifies an m3u8 from the response itself.
  private func makeItem(_ spec: TrackSpec) -> AVPlayerItem {
    let url = parseUrl(spec.url)
    let options: [String: Any]? =
      spec.headers.isEmpty ? nil : ["AVURLAssetHTTPHeaderFieldsKey": spec.headers]
    let asset = AVURLAsset(url: url, options: options)
    let item = AVPlayerItem(asset: asset)

    // Rate changes speed, the narrator keeps their voice. timeDomain is what
    // RNTP's PitchAlgorithm.Voice mapped to, and it holds pitch across the
    // whole 0.5-3.0 range the rate slider offers.
    item.audioTimePitchAlgorithm = .timeDomain
    return item
  }

  private func parseUrl(_ raw: String) -> URL {
    if let url = URL(string: raw), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: raw)
  }

  private func handleCurrentItemChange() {
    guard !suppressItemTransitions else { return }

    guard let item = player?.currentItem else {
      // The queue ran out. The didPlayToEnd notification for the final item
      // has already recorded the ended state; this is just the reads going
      // stale, which the snapshot's ended branch papers over.
      emitState()
      return
    }

    if let index = itemIndices[ObjectIdentifier(item)] {
      currentIndex = index
    }
    observeStatus(of: item)
    emitState()
    updateNowPlaying()
  }

  private func observeStatus(of item: AVPlayerItem) {
    itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      DispatchQueue.main.async {
        guard let self else { return }
        if item.status == .failed, let error = item.error {
          self.emit?("onError", ["message": self.describe(error)])
        }
        self.emitState()
        self.updateNowPlaying()
      }
    }
  }

  // MARK: - Notifications

  private func observeNotifications() {
    let center = NotificationCenter.default

    notificationTokens.append(
      center.addObserver(
        forName: AVPlayerItem.didPlayToEndTimeNotification,
        object: nil,
        queue: .main
      ) { [weak self] note in
        guard let self,
          let item = note.object as? AVPlayerItem,
          let index = self.itemIndices[ObjectIdentifier(item)],
          index == self.tracks.count - 1
        else { return }

        // Intermediate items advance through the currentItem observation;
        // only the final one ends the book.
        self.ended = true
        self.endedPositionSeconds =
          self.tracks[index].durationSeconds ?? item.duration.seconds
        if !self.endedPositionSeconds.isFinite {
          self.endedPositionSeconds = 0.0
        }
        self.playWhenReady = false
        self.emitState()
        self.updateNowPlaying()
        self.emit?("onQueueEnded", [:])
      })

    notificationTokens.append(
      center.addObserver(
        forName: AVPlayerItem.failedToPlayToEndTimeNotification,
        object: nil,
        queue: .main
      ) { [weak self] note in
        guard let self,
          let item = note.object as? AVPlayerItem,
          self.itemIndices[ObjectIdentifier(item)] != nil
        else { return }
        let error = note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
        self.emit?("onError", ["message": error.map(self.describe) ?? "failed to play to end"])
        self.emitState()
      })

    // Interruptions (a call, another app taking the session): the system has
    // already stopped the audio, so this acts natively and JS learns of the
    // resulting state - the same visibility it has on Android, where
    // ExoPlayer's focus handling does the equivalent.
    notificationTokens.append(
      center.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: nil,
        queue: .main
      ) { [weak self] note in
        guard let self,
          let rawType = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else { return }

        switch type {
        case .began:
          self.wasPlayingBeforeInterruption = self.playWhenReady
          if self.playWhenReady {
            self.playWhenReady = false
            self.player?.pause()
            self.emitState()
            self.updateNowPlaying()
          }
        case .ended:
          let rawOptions = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
          let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
          if options.contains(.shouldResume), self.wasPlayingBeforeInterruption {
            self.play()
          }
          self.wasPlayingBeforeInterruption = false
        @unknown default:
          break
        }
      })

    // Becoming-noisy: unplugged headphones must pause, not hand the book to
    // the room. iOS pauses the audio itself; this records the intent change
    // so the state JS sees agrees with what happened.
    notificationTokens.append(
      center.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: nil,
        queue: .main
      ) { [weak self] note in
        guard let self,
          let rawReason = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: rawReason),
          reason == .oldDeviceUnavailable,
          self.playWhenReady
        else { return }
        self.playWhenReady = false
        self.player?.pause()
        self.emitState()
        self.updateNowPlaying()
      })
  }

  private func describe(_ error: Error) -> String {
    var parts: [String] = []
    var next: Error? = error
    while let current = next {
      let nsError = current as NSError
      parts.append("\(nsError.domain)(\(nsError.code)): \(nsError.localizedDescription)")
      next = nsError.userInfo[NSUnderlyingErrorKey] as? Error
    }
    return parts.joined(separator: " <- ")
  }

  // MARK: - Remote commands

  /// Every handler reports the command to JS and acts on nothing - JS is the
  /// actor, not an observer. The advertised commands are also where the lock
  /// screen gets its shape: next/previous are disabled (an audiobook's files
  /// are not chapters), and so is dragging the timeline - too sensitive to be
  /// useful against a ten-hour book, so the position command is off and the
  /// bar renders read-only. The ±10s skips are what the surfaces offer
  /// instead, and JS scales them by the playback rate like any in-app press.
  private func configureRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()

    func handle(
      _ command: MPRemoteCommand,
      _ handler: @escaping () -> Void
    ) {
      command.isEnabled = true
      let target = command.addTarget { _ in
        handler()
        return .success
      }
      commandTargets.append((command, target))
    }

    handle(center.playCommand) { [weak self] in
      self?.emitRemoteCommand("play")
    }
    handle(center.pauseCommand) { [weak self] in
      self?.emitRemoteCommand("pause")
    }

    // A headset's single button arrives as a toggle; resolving it against the
    // play intent here mirrors media3's session doing the same on Android, so
    // JS always receives the play or pause the press meant.
    handle(center.togglePlayPauseCommand) { [weak self] in
      guard let self else { return }
      self.emitRemoteCommand(self.playWhenReady ? "pause" : "play")
    }

    center.skipBackwardCommand.preferredIntervals = [
      NSNumber(value: PlayerCore.seekIncrementSeconds)
    ]
    handle(center.skipBackwardCommand) { [weak self] in
      self?.emitRemoteCommand(
        "seekBack", ["intervalSeconds": PlayerCore.seekIncrementSeconds])
    }

    center.skipForwardCommand.preferredIntervals = [
      NSNumber(value: PlayerCore.seekIncrementSeconds)
    ]
    handle(center.skipForwardCommand) { [weak self] in
      self?.emitRemoteCommand(
        "seekForward", ["intervalSeconds": PlayerCore.seekIncrementSeconds])
    }

    center.changePlaybackPositionCommand.isEnabled = false
    center.nextTrackCommand.isEnabled = false
    center.previousTrackCommand.isEnabled = false
    center.changePlaybackRateCommand.isEnabled = false
    center.seekForwardCommand.isEnabled = false
    center.seekBackwardCommand.isEnabled = false
  }

  private func emitRemoteCommand(_ command: String, _ extras: [String: Any] = [:]) {
    var body: [String: Any] = ["command": command]
    extras.forEach { body[$0.key] = $0.value }
    emit?("onRemoteCommand", body)
  }

  // MARK: - Now playing

  /// Everything time-shaped the lock screen shows is translated onto the
  /// book's timeline, exactly as the Android session's interceptor does.
  /// Elapsed time extrapolates from the rate between updates, so this only
  /// needs calling at discontinuities - play, pause, seeks, rate changes and
  /// track transitions - never on a tick.
  private func updateNowPlaying() {
    guard let player, !tracks.isEmpty else {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      return
    }

    let spec = tracks[min(currentIndex, tracks.count - 1)]
    var info: [String: Any] = [
      MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue
    ]

    if let title = spec.title {
      info[MPMediaItemPropertyTitle] = title
    }
    if let artist = spec.artist {
      info[MPMediaItemPropertyArtist] = artist
    }

    let trackPosition = ended ? endedPositionSeconds : positionSeconds()
    if let offsets = bookOffsets, currentIndex < offsets.count {
      info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = offsets[currentIndex] + trackPosition
      info[MPMediaItemPropertyPlaybackDuration] = bookDurationSeconds
    } else {
      info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = trackPosition
      let duration = itemDurationSeconds()
      if duration > 0 {
        info[MPMediaItemPropertyPlaybackDuration] = duration
      }
    }

    info[MPNowPlayingInfoPropertyPlaybackRate] =
      player.timeControlStatus == .playing ? Double(desiredRate) : 0.0
    info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = Double(desiredRate)

    if let artwork {
      info[MPMediaItemPropertyArtwork] = artwork
    }

    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  /// One cover per queue - every track of a recording carries the same
  /// artwork. Fetched with the track's headers because a streamed cover lives
  /// behind the same authenticated server as the audio.
  private func loadArtwork(for spec: TrackSpec?) {
    guard let spec, let artworkUrl = spec.artworkUrl else {
      artwork = nil
      artworkUrlLoaded = nil
      return
    }
    guard artworkUrl != artworkUrlLoaded else { return }

    artwork = nil
    artworkUrlLoaded = artworkUrl

    let url = parseUrl(artworkUrl)
    var request = URLRequest(url: url)
    spec.headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }

    URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      DispatchQueue.main.async {
        guard let self, self.artworkUrlLoaded == artworkUrl else { return }
        self.artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        self.updateNowPlaying()
      }
    }.resume()
  }
}
