package expo.modules.activitytracker

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ActivityTrackerModule : Module() {
    companion object {
        private const val TAG = "ActivityTracker"
        private const val EVENT_NAME = "onActivityChange"
        private const val REQUEST_CODE = 1002
        private const val ACTION = "expo.modules.activitytracker.ACTIVITY_TRANSITION"
    }

    private var receiver: BroadcastReceiver? = null
    private var isTracking = false
    private lateinit var context: Context

    private val pendingIntent: PendingIntent by lazy {
        val intent = Intent(ACTION).setPackage(context.packageName)
        PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        )
    }

    override fun definition() = ModuleDefinition {
        Name("ActivityTracker")

        Events(EVENT_NAME)

        Constants {
            val availability = GoogleApiAvailability.getInstance()
                .isGooglePlayServicesAvailable(appContext.reactContext!!)
            mapOf(
                "isGooglePlayServicesAvailable" to (availability == ConnectionResult.SUCCESS)
            )
        }

        OnCreate {
            context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        }

        OnDestroy {
            stopTrackingInternal()
        }

        AsyncFunction("getPermissionStatus") { promise: Promise ->
            val status = checkPermissionStatus()
            promise.resolve(status)
        }

        AsyncFunction("requestPermission") { promise: Promise ->
            // On Android, we can't programmatically request - just return current status
            // The app should use PermissionsAndroid.request() from JS side
            val status = checkPermissionStatus()
            promise.resolve(status)
        }

        AsyncFunction("startTracking") { promise: Promise ->
            if (!isGooglePlayServicesAvailable()) {
                promise.resolve("FAILED")
                return@AsyncFunction
            }

            if (checkPermissionStatus() != "AUTHORIZED") {
                promise.resolve("UNAUTHORIZED")
                return@AsyncFunction
            }

            if (isTracking) {
                promise.resolve("STARTED")
                return@AsyncFunction
            }

            registerReceiver()
            startActivityTransitionUpdates(promise)
        }

        AsyncFunction("stopTracking") { promise: Promise ->
            stopTrackingInternal()
            promise.resolve("STOPPED")
        }
    }

    private fun checkPermissionStatus(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            when (ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION)) {
                PackageManager.PERMISSION_GRANTED -> "AUTHORIZED"
                PackageManager.PERMISSION_DENIED -> "DENIED"
                else -> "NOT_DETERMINED"
            }
        } else {
            // Pre-Android Q doesn't need runtime permission
            "AUTHORIZED"
        }
    }

    private fun isGooglePlayServicesAvailable(): Boolean {
        val availability = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(context)
        return availability == ConnectionResult.SUCCESS
    }

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    private fun registerReceiver() {
        if (receiver != null) return

        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (ActivityTransitionResult.hasResult(intent)) {
                    val result = ActivityTransitionResult.extractResult(intent) ?: return

                    val events = result.transitionEvents.map { event ->
                        mapOf(
                            "activityType" to mapActivityType(event.activityType),
                            "transitionType" to mapTransitionType(event.transitionType),
                            "confidence" to "UNKNOWN", // Activity transitions don't provide confidence
                            "timestamp" to event.elapsedRealTimeNanos / 1_000_000 // Convert to ms
                        )
                    }

                    if (events.isNotEmpty()) {
                        sendEvent(EVENT_NAME, mapOf("events" to events))
                    }
                }
            }
        }

        val intentFilter = IntentFilter(ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, intentFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, intentFilter)
        }
    }

    private fun unregisterReceiver() {
        receiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (e: IllegalArgumentException) {
                // Already unregistered
            }
        }
        receiver = null
    }

    private fun startActivityTransitionUpdates(promise: Promise) {
        val transitions = mutableListOf<ActivityTransition>()

        val activities = listOf(
            DetectedActivity.IN_VEHICLE,
            DetectedActivity.WALKING,
            DetectedActivity.ON_BICYCLE,
            DetectedActivity.RUNNING,
            DetectedActivity.STILL
        )

        activities.forEach { activityType ->
            transitions.add(
                ActivityTransition.Builder()
                    .setActivityType(activityType)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    .build()
            )
            transitions.add(
                ActivityTransition.Builder()
                    .setActivityType(activityType)
                    .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                    .build()
            )
        }

        val request = ActivityTransitionRequest(transitions)

        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            promise.resolve("UNAUTHORIZED")
            return
        }

        ActivityRecognition.getClient(context)
            .requestActivityTransitionUpdates(request, pendingIntent)
            .addOnSuccessListener {
                Log.i(TAG, "Successfully registered for activity transitions")
                isTracking = true
                promise.resolve("STARTED")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to register for activity transitions", e)
                unregisterReceiver()
                promise.resolve("FAILED")
            }
    }

    private fun stopTrackingInternal() {
        if (!isTracking) return

        unregisterReceiver()

        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            ActivityRecognition.getClient(context)
                .removeActivityTransitionUpdates(pendingIntent)
                .addOnSuccessListener {
                    Log.i(TAG, "Successfully deregistered from activity transitions")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to deregister from activity transitions", e)
                }
        }

        isTracking = false
    }

    private fun mapActivityType(type: Int): String {
        return when (type) {
            DetectedActivity.IN_VEHICLE -> "AUTOMOTIVE"
            DetectedActivity.WALKING -> "WALKING"
            DetectedActivity.RUNNING -> "RUNNING"
            DetectedActivity.ON_BICYCLE -> "CYCLING"
            DetectedActivity.STILL -> "STATIONARY"
            else -> "UNKNOWN"
        }
    }

    private fun mapTransitionType(type: Int): String {
        return when (type) {
            ActivityTransition.ACTIVITY_TRANSITION_ENTER -> "ENTER"
            ActivityTransition.ACTIVITY_TRANSITION_EXIT -> "EXIT"
            else -> "ENTER"
        }
    }
}
