package expo.modules.backgroundtimer

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * A clock that keeps running while the Activity is paused.
 *
 * React Native drives `setTimeout`/`setInterval` from a choreographer frame
 * callback that `JavaTimerManager.onHostPause` unhooks whenever the Activity
 * pauses - Home press, screen off, or swipe away. Every JS timer stops there
 * and only fires on `onHostResume`, all overdue ones at once. That is fatal for
 * an audiobook player, which keeps playing long after its Activity is gone.
 *
 * This module schedules on a `Handler` of its own instead, and sends an event
 * per fire. `sendEvent` reaches JS through the runtime's call invoker, which is
 * not choreographer-driven, so callbacks arrive with the Activity paused.
 *
 * Timers are identified by an integer the JS side allocates; it owns the
 * callback table, so this class only has to know when to fire.
 */
class BackgroundTimerModule : Module() {
  companion object {
    private const val EVENT_NAME = "onTimerFired"
    private const val THREAD_NAME = "BackgroundTimer"
    private const val WAKE_LOCK_TAG = "BackgroundTimer::Pending"

    /**
     * A leak guard, not a schedule. Every post refreshes it, so a repeating
     * timer holds the lock for as long as it ticks; what it bounds is a timer
     * that JS forgets to cancel. A one-shot delay longer than this would be
     * left to fire whenever the CPU next wakes - nothing in the app schedules
     * one anywhere near it.
     */
    private const val WAKE_LOCK_TIMEOUT_MS = 10L * 60L * 1000L
  }

  private val lock = Any()
  private var thread: HandlerThread? = null
  private var handler: Handler? = null

  /** Pending timers by id. Guarded by [lock]. */
  private val pending = mutableMapOf<Int, Runnable>()

  private var wakeLock: PowerManager.WakeLock? = null

  override fun definition() = ModuleDefinition {
    Name("BackgroundTimer")

    Events(EVENT_NAME)

    // Delays come in as Double: a JS number that is not whole would fail
    // conversion to Int outright, and a timer is not worth crashing over.
    Function("schedule") { id: Int, delayMs: Double ->
      post(id, delayMs.toLong(), repeating = false)
    }

    Function("scheduleInterval") { id: Int, everyMs: Double ->
      post(id, everyMs.toLong(), repeating = true)
    }

    Function("cancel") { id: Int ->
      synchronized(lock) { cancelLocked(id) }
    }

    Function("cancelAll") {
      synchronized(lock) { cancelAllLocked() }
    }

    OnDestroy {
      synchronized(lock) {
        cancelAllLocked()
        thread?.quitSafely()
        thread = null
        handler = null
      }
    }
  }

  /**
   * Schedule (or reschedule) a timer. A repeating timer re-posts itself after
   * each fire rather than using a fixed-rate schedule: a tick that arrives late
   * because the device was busy should not be followed by a burst of catch-up
   * ticks.
   */
  private fun post(id: Int, delayMs: Long, repeating: Boolean) {
    synchronized(lock) {
      cancelLocked(id)

      val handler = ensureHandlerLocked()

      val runnable = object : Runnable {
        override fun run() {
          synchronized(lock) {
            // Cancelled after this fire was already dequeued.
            if (pending[id] !== this) return

            if (repeating) {
              handler.postDelayed(this, delayMs)
              acquireWakeLockLocked()
            } else {
              pending.remove(id)
              releaseWakeLockIfIdleLocked()
            }
          }

          sendEvent(EVENT_NAME, mapOf("id" to id))
        }
      }

      pending[id] = runnable
      handler.postDelayed(runnable, delayMs)
      acquireWakeLockLocked()
    }
  }

  private fun cancelLocked(id: Int) {
    val runnable = pending.remove(id) ?: return
    handler?.removeCallbacks(runnable)
    releaseWakeLockIfIdleLocked()
  }

  private fun cancelAllLocked() {
    pending.values.forEach { handler?.removeCallbacks(it) }
    pending.clear()
    releaseWakeLockIfIdleLocked()
  }

  private fun ensureHandlerLocked(): Handler {
    handler?.let { return it }

    val newThread = HandlerThread(THREAD_NAME).also { it.start() }
    val newHandler = Handler(newThread.looper)

    thread = newThread
    handler = newHandler

    return newHandler
  }

  /**
   * Hold the CPU awake while anything is pending.
   *
   * `Handler.postDelayed` counts in `SystemClock.uptimeMillis`, which stops
   * advancing in deep sleep, so without this a timer armed with the screen off
   * would fire late by however long the device dozed - the same failure the
   * module exists to fix. In practice timers are only pending during playback
   * or for a debounce window measured in seconds.
   */
  private fun acquireWakeLockLocked() {
    val context = appContext.reactContext ?: return
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return

    val held = wakeLock ?: powerManager
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG)
      .also {
        it.setReferenceCounted(false)
        wakeLock = it
      }

    held.acquire(WAKE_LOCK_TIMEOUT_MS)
  }

  private fun releaseWakeLockIfIdleLocked() {
    if (pending.isNotEmpty()) return
    wakeLock?.let { if (it.isHeld) it.release() }
  }
}
