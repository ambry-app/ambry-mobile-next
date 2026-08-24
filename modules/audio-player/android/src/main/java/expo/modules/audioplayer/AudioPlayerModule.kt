package expo.modules.audioplayer

import android.content.Intent
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * The JS boundary. Every function hops to the main thread before touching the
 * player - ExoPlayer is bound to the thread that created it - and resolves its
 * promise from there, so callers get ordering for free: a `seekTo` awaited
 * before a `play` has been applied before the play is.
 */
class AudioPlayerModule : Module() {
  class TrackRecord : Record {
    @Field val url: String = ""
    @Field val title: String? = null
    @Field val artist: String? = null
    @Field val artwork: String? = null
    @Field val headers: Map<String, String>? = null
    @Field val type: String = "default"

    // Seconds. The player derives real durations from the media; this feeds
    // the session's book-time translation, so the notification's bar can show
    // the book rather than the file currently playing.
    @Field val duration: Double? = null
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  private fun onMain(promise: Promise, block: () -> Any?) {
    mainHandler.post {
      try {
        promise.resolve(block())
      } catch (e: Exception) {
        promise.reject("ERR_AUDIO_PLAYER", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AudioPlayer")

    Events("onStateChange", "onRemoteCommand", "onQueueEnded", "onError")

    OnCreate {
      PlayerCore.emit = { name, body -> sendEvent(name, body) }
    }

    OnDestroy {
      PlayerCore.emit = null
      mainHandler.post { PlayerCore.release() }
    }

    AsyncFunction("setup") { promise: Promise ->
      onMain(promise) {
        val context = appContext.reactContext?.applicationContext
          ?: throw IllegalStateException("no application context")
        PlayerCore.ensure(context)
        null
      }
    }

    AsyncFunction("setQueue") { tracks: List<TrackRecord>, promise: Promise ->
      onMain(promise) {
        val context = appContext.reactContext?.applicationContext
          ?: throw IllegalStateException("no application context")

        PlayerCore.setQueue(
          context,
          tracks.map {
            PlayerCore.TrackSpec(
              url = it.url,
              title = it.title,
              artist = it.artist,
              artworkUrl = it.artwork,
              headers = it.headers ?: emptyMap(),
              type = it.type,
              durationSeconds = it.duration,
            )
          },
        )

        // The session (and with it the notification and media keys) lives in
        // the service, so it has to be running whenever a queue is loaded.
        // media3 promotes it to a mediaPlayback FGS when playback starts and
        // demotes it when playback stops; this start is the plain, non-FGS
        // kind, which is only legal from the foreground - and a queue is only
        // ever loaded from the foreground (boot or a user tapping a book) or
        // while playback already holds the service up.
        try {
          context.startService(Intent(context, PlaybackService::class.java))
        } catch (e: IllegalStateException) {
          // Backgrounded app, no service yet: leave it. Nothing can be
          // playing (there was no queue), so the next foreground load
          // starts it.
        }
        null
      }
    }

    AsyncFunction("play") { promise: Promise ->
      onMain(promise) { PlayerCore.player?.play(); null }
    }

    AsyncFunction("pause") { promise: Promise ->
      onMain(promise) { PlayerCore.player?.pause(); null }
    }

    AsyncFunction("seekTo") { index: Int, seconds: Double, promise: Promise ->
      onMain(promise) {
        PlayerCore.player?.seekTo(index, (seconds * 1000).toLong())
        null
      }
    }

    AsyncFunction("setRate") { rate: Double, promise: Promise ->
      onMain(promise) {
        // Pitch stays 1: rate changes speed, the narrator keeps their voice.
        PlayerCore.player?.playbackParameters =
          androidx.media3.common.PlaybackParameters(rate.toFloat(), 1.0f)
        null
      }
    }

    AsyncFunction("setVolume") { volume: Double, promise: Promise ->
      onMain(promise) { PlayerCore.player?.volume = volume.toFloat(); null }
    }

    AsyncFunction("reset") { promise: Promise ->
      onMain(promise) { PlayerCore.reset(); null }
    }

    AsyncFunction("getState") { promise: Promise ->
      onMain(promise) { PlayerCore.snapshot() }
    }
  }
}
