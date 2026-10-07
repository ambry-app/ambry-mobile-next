package expo.modules.audioplayer

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.dash.DashMediaSource
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource

/**
 * The one ExoPlayer, shared between the module (JS commands in) and the
 * playback service (media session out). Application-scoped rather than owned
 * by either, because the two have different lifetimes: the module lives as
 * long as the JS runtime, the service only while playback needs a
 * notification. Everything here must run on the main thread - ExoPlayer is
 * single-threaded by contract - and the module's dispatch guarantees that.
 */
object PlayerCore {
  const val SEEK_INCREMENT_MS = 10_000L

  /** The real player. JS commands land here, and here only. */
  var player: ExoPlayer? = null
    private set

  /**
   * What the media session sees. Transport commands from the notification,
   * lock screen and media keys are swallowed and emitted to JS instead of
   * acting - JS owns pause-rewind ordering and rate-scaled seeks, so a command
   * that acted natively would produce a different event history than the same
   * button pressed in the app. Reads pass through, so the session and
   * notification always render the real player's state.
   */
  var sessionPlayer: Player? = null
    private set

  /** Wired by the module; events are dropped while the JS runtime is gone. */
  var emit: ((name: String, body: Map<String, Any?>) -> Unit)? = null

  /**
   * A transport command from a remote surface, delivered to JS un-acted.
   * Called by the interceptor below for the standard commands, and by the
   * service for the custom ±10s notification buttons.
   */
  fun emitRemoteCommand(command: String, extras: Map<String, Any?> = emptyMap()) {
    emit?.invoke("onRemoteCommand", mapOf("command" to command) + extras)
  }

  data class TrackSpec(
    val url: String,
    val title: String?,
    val artist: String?,
    val artworkUrl: String?,
    val headers: Map<String, String>,
    val type: String,
    val durationSeconds: Double?,
  )

  /**
   * Where each file starts on the book's timeline, in ms, and the book's
   * whole length. This is what lets the SESSION speak book time: the
   * notification's bar must read "3:12:44 of 14:02:10", not where file 23 of
   * 40 happens to be. Null when the queue is a single stream (already the
   * whole book) or a duration is missing, in which case file time is shown
   * as-is.
   */
  private var bookOffsetsMs: LongArray? = null
  private var bookDurationMs: Long = 0L

  fun ensure(context: Context): ExoPlayer {
    player?.let { return it }

    val exo = ExoPlayer.Builder(context)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
          .build(),
        // handleAudioFocus: pause on loss, duck on transient loss, resume on
        // gain. JS learns of the resulting state through onIsPlayingChanged -
        // the same visibility it has today.
        true,
      )
      .setHandleAudioBecomingNoisy(true)
      .setSeekBackIncrementMs(SEEK_INCREMENT_MS)
      .setSeekForwardIncrementMs(SEEK_INCREMENT_MS)
      .setWakeMode(C.WAKE_MODE_NETWORK)
      .build()

    exo.addListener(object : Player.Listener {
      // A snapshot every second while audio runs, so JS can mirror the
      // player's state without polling across the bridge.
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) startTick() else stopTick()
        emitState()
      }

      override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) = emitState()

      override fun onPlaybackStateChanged(playbackState: Int) {
        emitState()
        if (playbackState == Player.STATE_ENDED) {
          emit?.invoke("onQueueEnded", emptyMap())
        }
      }

      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = emitState()

      override fun onPositionDiscontinuity(
        oldPosition: Player.PositionInfo,
        newPosition: Player.PositionInfo,
        reason: Int,
      ) = emitState()

      override fun onPlaybackParametersChanged(playbackParameters: PlaybackParameters) = emitState()

      override fun onPlayerError(error: PlaybackException) {
        // The summary line names the renderer; the WHY lives in the cause
        // chain ("Decoder failed: c2.dolby.eac3.decoder"), and JS logs are
        // often all there is - flatten the whole chain into the message.
        val chain = generateSequence<Throwable>(error) { it.cause }
          .joinToString(" <- ") { it.message ?: it.javaClass.simpleName }
        emit?.invoke("onError", mapOf("message" to "${error.errorCodeName}: $chain"))
      }
    })

    player = exo
    sessionPlayer = RemoteCommandInterceptor(exo)
    return exo
  }

  fun setQueue(context: Context, tracks: List<TrackSpec>) {
    val exo = ensure(context)

    if (tracks.size > 1 && tracks.all { it.durationSeconds != null }) {
      val offsets = LongArray(tracks.size)
      var elapsed = 0L
      tracks.forEachIndexed { index, track ->
        offsets[index] = elapsed
        elapsed += ((track.durationSeconds ?: 0.0) * 1000).toLong()
      }
      bookOffsetsMs = offsets
      bookDurationMs = elapsed
    } else {
      bookOffsetsMs = null
      bookDurationMs = 0L
    }

    exo.setMediaSources(tracks.map { buildSource(context, it) })
    exo.prepare()
  }

  fun reset() {
    bookOffsetsMs = null
    bookDurationMs = 0L
    player?.let {
      it.stop()
      it.clearMediaItems()
    }
  }

  fun release() {
    stopTick()
    player?.release()
    player = null
    sessionPlayer = null
  }

  private val tickHandler = Handler(Looper.getMainLooper())
  private val tickRunnable = object : Runnable {
    override fun run() {
      emitState()
      tickHandler.postDelayed(this, 1000L)
    }
  }

  private fun startTick() {
    tickHandler.removeCallbacks(tickRunnable)
    tickHandler.postDelayed(tickRunnable, 1000L)
  }

  private fun stopTick() {
    tickHandler.removeCallbacks(tickRunnable)
  }

  fun snapshot(): Map<String, Any?> {
    val exo = player ?: return mapOf(
      "state" to "idle",
      "playing" to false,
      "playWhenReady" to false,
      "index" to 0,
      "positionSeconds" to 0.0,
      "durationSeconds" to 0.0,
      "bufferedSeconds" to 0.0,
      "rate" to 1.0,
    )

    val duration = exo.duration
    return mapOf(
      "state" to when (exo.playbackState) {
        Player.STATE_BUFFERING -> "buffering"
        Player.STATE_READY -> "ready"
        Player.STATE_ENDED -> "ended"
        else -> "idle"
      },
      "playing" to exo.isPlaying,
      "playWhenReady" to exo.playWhenReady,
      "index" to exo.currentMediaItemIndex,
      "positionSeconds" to exo.currentPosition / 1000.0,
      "durationSeconds" to if (duration == C.TIME_UNSET) 0.0 else duration / 1000.0,
      "bufferedSeconds" to exo.bufferedPosition / 1000.0,
      "rate" to exo.playbackParameters.speed.toDouble(),
    )
  }

  private fun emitState() {
    emit?.invoke("onStateChange", snapshot())
  }

  /**
   * Each track gets its own data-source factory because headers are
   * per-track: streamed files carry the session's bearer token, downloaded
   * files carry nothing. `DefaultDataSource` routes file:// URIs past the
   * http factory, so local playback never sees the headers at all.
   */
  private fun buildSource(context: Context, spec: TrackSpec): MediaSource {
    val httpFactory = DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true)
    if (spec.headers.isNotEmpty()) {
      httpFactory.setDefaultRequestProperties(spec.headers)
    }
    val dataSourceFactory = DefaultDataSource.Factory(context, httpFactory)

    val metadata = MediaMetadata.Builder()
      .setTitle(spec.title)
      .setArtist(spec.artist)
      .setArtworkUri(spec.artworkUrl?.let(Uri::parse))
      .build()

    val item = MediaItem.Builder()
      .setUri(spec.url)
      .setMediaMetadata(metadata)
      .build()

    return when (spec.type) {
      "dash" -> DashMediaSource.Factory(dataSourceFactory).createMediaSource(item)
      "hls" -> HlsMediaSource.Factory(dataSourceFactory).createMediaSource(item)
      else -> ProgressiveMediaSource.Factory(dataSourceFactory).createMediaSource(item)
    }
  }

  /**
   * Swallows transport commands and reports them to JS instead.
   *
   * The media session resolves a headset's play/pause toggle against
   * `playWhenReady` before calling one of these, so a toggle arrives as the
   * play or pause it meant - nothing here needs to resolve it again.
   *
   * The advertised commands are also where remote surfaces get their shape:
   * next/previous are removed (an audiobook's files are not chapters, no
   * surface in the app offers track skipping), and so is seeking within the
   * item, which is what makes the notification's timeline draggable - too
   * sensitive to be useful against a ten-hour book. The ±10s buttons the
   * notification shows instead are custom session commands, built in
   * PlaybackService.
   */
  private class RemoteCommandInterceptor(player: Player) : ForwardingPlayer(player) {
    private fun report(command: String, extras: Map<String, Any?> = emptyMap()) {
      emitRemoteCommand(command, extras)
    }

    override fun play() = report("play")

    override fun pause() = report("pause")

    override fun setPlayWhenReady(playWhenReady: Boolean) {
      if (playWhenReady) report("play") else report("pause")
    }

    override fun seekBack() =
      report("seekBack", mapOf("intervalSeconds" to SEEK_INCREMENT_MS / 1000.0))

    override fun seekForward() =
      report("seekForward", mapOf("intervalSeconds" to SEEK_INCREMENT_MS / 1000.0))

    // NOTE if seek-in-item is ever re-advertised: with book-time translation
    // active (bookOffsetsMs != null), a controller's seekTo arrives in BOOK
    // coordinates, not track coordinates - the emission below would need to
    // say which it is so the wrapper doesn't translate twice. Today nothing
    // can trigger these: the command is removed from getAvailableCommands.
    override fun seekTo(positionMs: Long) =
      report("seekTo", mapOf("positionSeconds" to positionMs / 1000.0))

    override fun seekTo(mediaItemIndex: Int, positionMs: Long) =
      report("seekTo", mapOf("positionSeconds" to positionMs / 1000.0, "index" to mediaItemIndex))

    // ----- Book time for the session ------------------------------------
    // Everything time-shaped the session (and so the notification, lock
    // screen and any controller) reads is translated onto the book's
    // timeline. Reads of the REAL player (the module's snapshot) stay in
    // track coordinates - JS owns that translation, as it always has.

    private fun bookOffsetMs(): Long? =
      bookOffsetsMs?.getOrNull(super.getCurrentMediaItemIndex())

    override fun getCurrentPosition(): Long =
      bookOffsetMs()?.plus(super.getCurrentPosition()) ?: super.getCurrentPosition()

    override fun getContentPosition(): Long =
      bookOffsetMs()?.plus(super.getContentPosition()) ?: super.getContentPosition()

    override fun getBufferedPosition(): Long =
      bookOffsetMs()?.plus(super.getBufferedPosition()) ?: super.getBufferedPosition()

    override fun getContentBufferedPosition(): Long =
      bookOffsetMs()?.plus(super.getContentBufferedPosition())
        ?: super.getContentBufferedPosition()

    override fun getDuration(): Long =
      if (bookOffsetsMs != null) bookDurationMs else super.getDuration()

    override fun getContentDuration(): Long =
      if (bookOffsetsMs != null) bookDurationMs else super.getContentDuration()

    override fun getAvailableCommands(): Player.Commands =
      super.getAvailableCommands()
        .buildUpon()
        .removeAll(
          COMMAND_SEEK_TO_NEXT,
          COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
          COMMAND_SEEK_TO_PREVIOUS,
          COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
          COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
          COMMAND_SEEK_TO_MEDIA_ITEM,
        )
        .build()

    override fun isCommandAvailable(command: Int): Boolean =
      getAvailableCommands().contains(command)
  }
}
