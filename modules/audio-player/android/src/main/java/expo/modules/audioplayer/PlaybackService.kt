package expo.modules.audioplayer

import android.app.PendingIntent
import android.content.Intent
import android.os.Bundle
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Owns the media session and the foreground-service lifetime, nothing else.
 * The player belongs to [PlayerCore]; media3 posts the notification and moves
 * this service in and out of the foreground as playback starts and stops.
 *
 * The lifecycle policy is deliberate and narrower than RNTP's:
 *
 * - `START_NOT_STICKY`: if the process dies while the service is started,
 *   Android must not restart it. A restarted service would build a headless
 *   JS context with listeners but no boot, no player and no playthrough - the
 *   split-context dead end (and Session-ID crash) the old player carried.
 * - Task removal stops the service unless something is actually playing. The
 *   operator's call: the app dying more often is fine, dying mid-listen is
 *   not.
 *
 * The remote surfaces are shaped here too. Standard commands give an
 * audiobook the wrong controls - next/previous mean nothing, and a draggable
 * timeline is too sensitive against a ten-hour book (both are removed from
 * the advertised player commands in [PlayerCore]'s interceptor). What the
 * notification and lock screen get instead are two custom ±10s buttons,
 * routed to JS un-acted like every other transport command, so a lock-screen
 * ±10s means exactly what an in-app one means.
 */
class PlaybackService : MediaSessionService() {
  companion object {
    private const val ACTION_SEEK_BACK = "app.ambry.seek_back"
    private const val ACTION_SEEK_FORWARD = "app.ambry.seek_forward"
    private const val SEEK_BUTTON_SECONDS = 10.0
  }

  private var mediaSession: MediaSession? = null

  private val seekBackCommand = SessionCommand(ACTION_SEEK_BACK, Bundle.EMPTY)
  private val seekForwardCommand = SessionCommand(ACTION_SEEK_FORWARD, Bundle.EMPTY)

  private inner class Callback : MediaSession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult =
      MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(
          MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS
            .buildUpon()
            .add(seekBackCommand)
            .add(seekForwardCommand)
            .build(),
        )
        .build()

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      args: Bundle,
    ): ListenableFuture<SessionResult> {
      when (customCommand.customAction) {
        ACTION_SEEK_BACK ->
          PlayerCore.emitRemoteCommand(
            "seekBack",
            mapOf("intervalSeconds" to SEEK_BUTTON_SECONDS),
          )
        ACTION_SEEK_FORWARD ->
          PlayerCore.emitRemoteCommand(
            "seekForward",
            mapOf("intervalSeconds" to SEEK_BUTTON_SECONDS),
          )
        else -> return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
      }
      return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
    }
  }

  override fun onCreate() {
    super.onCreate()

    // Started with no player - a system quirk NOT_STICKY should preclude.
    // There is nothing to run a session over; go away quietly.
    val sessionPlayer = PlayerCore.sessionPlayer
    if (sessionPlayer == null) {
      stopSelf()
      return
    }

    val sessionActivity = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val seekBackButton = CommandButton.Builder(CommandButton.ICON_SKIP_BACK_10)
      .setSessionCommand(seekBackCommand)
      .setDisplayName("Back 10 seconds")
      .build()

    val seekForwardButton = CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD_10)
      .setSessionCommand(seekForwardCommand)
      .setDisplayName("Forward 10 seconds")
      .build()

    // An explicit ID: media3 keeps a process-wide registry keyed by session
    // ID and the default is "", so any other library building a default
    // session in this process would collide with ours and crash both.
    val session = MediaSession.Builder(this, sessionPlayer)
      .setId("AmbryAudioPlayer")
      .setCallback(Callback())
      .setCustomLayout(ImmutableList.of(seekBackButton, seekForwardButton))
      .apply { sessionActivity?.let { intent -> setSessionActivity(intent) } }
      .build()

    mediaSession = session

    // A session only joins the service's notification and foreground
    // machinery once it is ADDED to the service. onGetSession does that when
    // an external controller connects - and nothing in this app ever
    // connects one, so without this line the session works as a raw
    // framework session (media keys, Bluetooth) while no notification is
    // ever posted and the service never goes foreground.
    addSession(session)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
    mediaSession

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    super.onStartCommand(intent, flags, startId)
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // The real player, not the session's interceptor: this pause is Android
    // housekeeping, not a listener's command, and it must act even though JS
    // may be about to die with the task.
    val player = PlayerCore.player
    if (player == null || !player.playWhenReady) {
      player?.pause()
      stopSelf()
    }
  }

  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    super.onDestroy()
  }
}
