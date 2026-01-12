package expo.modules.shakedetector

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.sqrt

class ShakeDetectorModule : Module(), SensorEventListener {
    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var wakeLock: PowerManager.WakeLock? = null

    // Configuration
    private var sampleWindow = 10
    private var varianceThreshold = 5.0
    private var debugMode = false

    // State
    private val samples = mutableListOf<Double>()
    private var isRunning = false

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context is null")

    override fun definition() = ModuleDefinition {
        Name("ShakeDetector")

        Events("onMotionDetected")

        Function("start") { window: Int, threshold: Double, debug: Boolean ->
            sampleWindow = window
            varianceThreshold = threshold
            debugMode = debug
            startDetection()
        }

        Function("stop") {
            stopDetection()
        }

        Function("isRunning") {
            isRunning
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
            // Device doesn't have accelerometer
            return
        }

        // Acquire a partial wake lock to keep CPU running while screen is off
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ShakeDetector::MotionDetection"
        )
        wakeLock?.acquire()

        // Register listener with SENSOR_DELAY_NORMAL (~200ms between updates)
        sensorManager?.registerListener(
            this,
            accelerometer,
            SensorManager.SENSOR_DELAY_NORMAL
        )

        samples.clear()
        isRunning = true
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

        samples.clear()
        isRunning = false
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
        if (samples.size > sampleWindow) {
            samples.removeAt(0)
        }

        // Calculate variance
        val variance = calculateVariance(samples)

        // In debug mode: send every event (for live variance display)
        // In production mode: only send when threshold exceeded (battery efficient)
        if (debugMode || variance > varianceThreshold) {
            sendEvent("onMotionDetected", mapOf(
                "variance" to variance,
                "timestamp" to System.currentTimeMillis()
            ))
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
}
