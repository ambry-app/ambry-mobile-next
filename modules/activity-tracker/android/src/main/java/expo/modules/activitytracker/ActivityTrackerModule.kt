package expo.modules.activitytracker

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.sqrt

class ActivityTrackerModule : Module(), SensorEventListener {
    companion object {
        private const val TAG = "ActivityTracker"
        private const val EVENT_NAME = "onActivityStateChange"

        // Configuration
        private const val SAMPLE_WINDOW = 10
        private const val VARIANCE_THRESHOLD = 0.5 // Lower than shake detector - we want to detect stillness
        private const val STATIONARY_DELAY_MS = 5000L // 5 seconds of stillness = stationary
    }

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val samples = mutableListOf<Double>()
    private var isRunning = false
    private var currentState: String? = null
    private var lastMotionTime: Long = 0
    private var stationaryCheckHandler: Handler? = null
    private var stationaryCheckRunnable: Runnable? = null

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context is null")

    override fun definition() = ModuleDefinition {
        Name("ActivityTracker")

        Events(EVENT_NAME)

        // No permission needed for accelerometer on Android
        AsyncFunction("getPermissionStatus") {
            "AUTHORIZED"
        }

        AsyncFunction("requestPermission") {
            "AUTHORIZED"
        }

        AsyncFunction("startTracking") {
            startDetection()
            if (isRunning) "STARTED" else "FAILED"
        }

        AsyncFunction("stopTracking") {
            stopDetection()
            "STOPPED"
        }

        OnDestroy {
            stopDetection()
        }
    }

    private fun startDetection() {
        if (isRunning) return

        sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        if (accelerometer == null) {
            return
        }

        // Acquire a partial wake lock to keep CPU running while screen is off
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ActivityTracker::StationaryDetection"
        )
        wakeLock?.acquire()

        // Set up handler for stationary check
        stationaryCheckHandler = Handler(Looper.getMainLooper())

        // Register listener
        sensorManager?.registerListener(
            this,
            accelerometer,
            SensorManager.SENSOR_DELAY_NORMAL
        )

        samples.clear()
        currentState = null
        lastMotionTime = System.currentTimeMillis()
        isRunning = true

        // Start checking for stationary state
        scheduleStationaryCheck()
    }

    private fun stopDetection() {
        if (!isRunning) return

        sensorManager?.unregisterListener(this)
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null

        stationaryCheckRunnable?.let { stationaryCheckHandler?.removeCallbacks(it) }
        stationaryCheckHandler = null
        stationaryCheckRunnable = null

        samples.clear()
        currentState = null
        isRunning = false
    }

    private fun scheduleStationaryCheck() {
        stationaryCheckRunnable = Runnable {
            checkForStationary()
            if (isRunning) {
                scheduleStationaryCheck()
            }
        }
        stationaryCheckHandler?.postDelayed(stationaryCheckRunnable!!, 1000)
    }

    private fun checkForStationary() {
        val now = System.currentTimeMillis()
        val timeSinceMotion = now - lastMotionTime

        if (timeSinceMotion >= STATIONARY_DELAY_MS && currentState != "STATIONARY") {
            currentState = "STATIONARY"
            sendStateEvent("STATIONARY", "HIGH")
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type != Sensor.TYPE_ACCELEROMETER) return

        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        // Calculate magnitude of acceleration
        val magnitude = sqrt((x * x + y * y + z * z).toDouble())

        // Add to rolling window
        samples.add(magnitude)
        if (samples.size > SAMPLE_WINDOW) {
            samples.removeAt(0)
        }

        // Calculate variance
        val variance = calculateVariance(samples)

        // Check if motion detected
        if (variance > VARIANCE_THRESHOLD) {
            lastMotionTime = System.currentTimeMillis()

            // If we were stationary, now we're not
            if (currentState != "NOT_STATIONARY") {
                currentState = "NOT_STATIONARY"
                val confidence = when {
                    variance > 2.0 -> "HIGH"
                    variance > 1.0 -> "MEDIUM"
                    else -> "LOW"
                }
                sendStateEvent("NOT_STATIONARY", confidence)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not needed
    }

    private fun calculateVariance(values: List<Double>): Double {
        if (values.size < 2) return 0.0
        val mean = values.average()
        return values.map { (it - mean) * (it - mean) }.average()
    }

    private fun sendStateEvent(state: String, confidence: String) {
        sendEvent(EVENT_NAME, mapOf(
            "state" to state,
            "confidence" to confidence,
            "timestamp" to System.currentTimeMillis()
        ))
    }
}
