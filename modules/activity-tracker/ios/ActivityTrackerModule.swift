import CoreMotion
import ExpoModulesCore

public class ActivityTrackerModule: Module {
    private let motionActivityManager = CMMotionActivityManager()
    private var isTracking = false
    private var lastState: String? = nil

    public func definition() -> ModuleDefinition {
        Name("ActivityTracker")

        Events("onActivityStateChange")

        AsyncFunction("getPermissionStatus") { (promise: Promise) in
            guard CMMotionActivityManager.isActivityAvailable() else {
                promise.resolve("UNAVAILABLE")
                return
            }

            let status = CMMotionActivityManager.authorizationStatus()
            switch status {
            case .notDetermined:
                promise.resolve("NOT_DETERMINED")
            case .restricted:
                promise.resolve("RESTRICTED")
            case .denied:
                promise.resolve("DENIED")
            case .authorized:
                promise.resolve("AUTHORIZED")
            @unknown default:
                promise.resolve("NOT_DETERMINED")
            }
        }

        // On iOS, requesting permission happens implicitly when you start tracking
        // Just return current status - the prompt will appear on first startTracking call
        AsyncFunction("requestPermission") { (promise: Promise) in
            guard CMMotionActivityManager.isActivityAvailable() else {
                promise.resolve("UNAVAILABLE")
                return
            }

            let status = CMMotionActivityManager.authorizationStatus()
            switch status {
            case .notDetermined:
                // Return AUTHORIZED to let startTracking proceed and trigger the prompt
                promise.resolve("AUTHORIZED")
            case .restricted:
                promise.resolve("RESTRICTED")
            case .denied:
                promise.resolve("DENIED")
            case .authorized:
                promise.resolve("AUTHORIZED")
            @unknown default:
                promise.resolve("NOT_DETERMINED")
            }
        }

        AsyncFunction("startTracking") { (promise: Promise) in
            guard CMMotionActivityManager.isActivityAvailable() else {
                promise.resolve("FAILED")
                return
            }

            let status = CMMotionActivityManager.authorizationStatus()
            // Allow notDetermined - the prompt will appear when we start updates
            guard status == .authorized || status == .notDetermined else {
                promise.resolve("UNAUTHORIZED")
                return
            }

            if self.isTracking {
                promise.resolve("STARTED")
                return
            }

            self.motionActivityManager.startActivityUpdates(to: OperationQueue.main) { [weak self] activity in
                guard let self = self else { return }
                guard let activity = activity else { return }

                // Determine if stationary or not
                let state: String
                if activity.stationary {
                    state = "STATIONARY"
                } else {
                    state = "NOT_STATIONARY"
                }

                // Only send event if state changed
                if state != self.lastState {
                    self.lastState = state

                    let confidence: String
                    switch activity.confidence {
                    case .low:
                        confidence = "LOW"
                    case .medium:
                        confidence = "MEDIUM"
                    case .high:
                        confidence = "HIGH"
                    @unknown default:
                        confidence = "MEDIUM"
                    }

                    let timestamp = Int64(activity.startDate.timeIntervalSince1970 * 1000)

                    self.sendEvent("onActivityStateChange", [
                        "state": state,
                        "confidence": confidence,
                        "timestamp": timestamp
                    ])
                }
            }

            self.isTracking = true
            self.lastState = nil
            promise.resolve("STARTED")
        }

        AsyncFunction("stopTracking") { (promise: Promise) in
            self.motionActivityManager.stopActivityUpdates()
            self.isTracking = false
            self.lastState = nil
            promise.resolve("STOPPED")
        }

        OnDestroy {
            self.motionActivityManager.stopActivityUpdates()
            self.isTracking = false
            self.lastState = nil
        }
    }
}
