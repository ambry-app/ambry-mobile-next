import AVFoundation
import MediaPlayer
import UIKit

/// The iOS half of the audio-player module: AVQueuePlayer plus the remote
/// command center and now-playing info it feeds. Remote commands are NOT
/// acted on natively - each handler reports to JS un-acted, same contract as
/// the Android ForwardingPlayer. Everything runs on the main thread.
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

  var emit: ((String, [String: Any]) -> Void)?

  private var player: AVQueuePlayer?
  private var tracks: [TrackSpec] = []
  private var currentIndex = 0

  // Items are recreated on every rebuild (an AVPlayerItem cannot be
  // re-inserted), so this map is how an item finds its track index.
  private var itemIndices: [ObjectIdentifier: Int] = [:]

  // Play intent, kept apart from whether audio is running: AVPlayer's rate
  // drops to zero for stalls and interruptions without the intent changing.
  private var playWhenReady = false
  private var desiredRate: Float = 1.0

  // AVQueuePlayer ends with currentItem == nil and every read zeroed; media3
  // keeps reporting the final position in STATE_ENDED, so remember it.
  private var ended = false
  private var endedPositionSeconds = 0.0

  private var suppressItemTransitions = false

  // AVPlayer's position reads lag a pending seek, so a cross-file seek would
  // briefly report the new file's head (lock screen included). Reporting the
  // target until the seek lands also matches media3, where position reflects
  // a seek immediately.
  private var pendingSeekSeconds: Double?
  private var seekGeneration = 0

  // Book-time offsets for the lock screen, mirroring the Android session's
  // translation. Nil for a single stream or when a duration is missing.
  private var bookOffsets: [Double]?
  private var bookDurationSeconds = 0.0

  private var periodicTimeObserver: Any?
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

    // A snapshot every second while audio runs, so JS can mirror the
    // player's state without polling across the bridge.
    periodicTimeObserver = queuePlayer.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 1.0, preferredTimescale: 10),
      queue: .main
    ) { [weak self] _ in
      self?.emitState()
    }

    observeNotifications()
    configureRemoteCommands()
  }

  func release() {
    if let periodicTimeObserver {
      player?.removeTimeObserver(periodicTimeObserver)
    }
    periodicTimeObserver = nil
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
    seekGeneration += 1
    pendingSeekSeconds = nil

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
    seekGeneration += 1
    pendingSeekSeconds = nil
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

    // A nonzero rate IS the play command, and it keeps
    // automaticallyWaitsToMinimizeStalling in charge.
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
    seekGeneration += 1
    let generation = seekGeneration
    pendingSeekSeconds = seconds

    if target == currentIndex, let item = player.currentItem {
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
          if self.seekGeneration == generation {
            self.pendingSeekSeconds = nil
          }
          self.emitState()
          self.updateNowPlaying()
          completion()
        }
      }
      return
    }

    // AVQueuePlayer only advances forward, so a cross-file seek rebuilds the
    // queue; playback holds until the seek lands so the listener never hears
    // the head of the target file.
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
        if self.seekGeneration == generation {
          self.pendingSeekSeconds = nil
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
    if let pendingSeekSeconds { return pendingSeekSeconds }
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

  private func makeItem(_ spec: TrackSpec) -> AVPlayerItem {
    let url = parseUrl(spec.url)
    let options: [String: Any]? =
      spec.headers.isEmpty ? nil : ["AVURLAssetHTTPHeaderFieldsKey": spec.headers]
    let asset = AVURLAsset(url: url, options: options)
    let item = AVPlayerItem(asset: asset)

    // What RNTP's PitchAlgorithm.Voice mapped to; holds pitch across 0.5-3.0.
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

    // Interruptions act natively (the system already stopped the audio); JS
    // learns of the resulting state, as it does on Android.
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

    // Becoming-noisy: iOS pauses the audio itself; record the intent change.
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

  // Handlers report to JS and act on nothing. Next/previous and timeline
  // dragging are disabled, matching the Android session's shape.
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

    // Resolve a headset's toggle against play intent, as media3 does.
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

  // Book time, like the Android session. Elapsed extrapolates from the rate
  // between updates, so this is only called at discontinuities.
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
