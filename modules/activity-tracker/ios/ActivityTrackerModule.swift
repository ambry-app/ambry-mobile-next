import CoreMotion
import ExpoModulesCore

public class ActivityTrackerModule: Module {
    private let motionActivityManager = CMMotionActivityManager()
    private var isTracking = false

    public func definition() -> ModuleDefinition {
        Name("ActivityTracker")

        Events("onActivityChange")

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
        AsyncFunction("requestPermission") { (promise: Promise) in
            guard CMMotionActivityManager.isActivityAvailable() else {
                promise.resolve("UNAVAILABLE")
                return
            }

            // Query a tiny bit of historical data to trigger the permission prompt
            let now = Date()
            let oneSecondAgo = now.addingTimeInterval(-1)

            self.motionActivityManager.queryActivityStarting(
                from: oneSecondAgo,
                to: now,
                to: OperationQueue.main
            ) { _, error in
                if let error = error as NSError?,
                   error.domain == CMErrorDomain,
                   error.code == CMErrorMotionActivityNotAuthorized.rawValue {
                    promise.resolve("DENIED")
                    return
                }

                let status = CMMotionActivityManager.authorizationStatus()
                switch status {
                case .authorized:
                    promise.resolve("AUTHORIZED")
                case .denied:
                    promise.resolve("DENIED")
                case .restricted:
                    promise.resolve("RESTRICTED")
                default:
                    promise.resolve("NOT_DETERMINED")
                }
            }
        }

        AsyncFunction("startTracking") { (promise: Promise) in
            guard CMMotionActivityManager.isActivityAvailable() else {
                promise.resolve("FAILED")
                return
            }

            guard CMMotionActivityManager.authorizationStatus() == .authorized else {
                promise.resolve("UNAUTHORIZED")
                return
            }

            if self.isTracking {
                promise.resolve("STARTED")
                return
            }

            self.motionActivityManager.startActivityUpdates(to: OperationQueue.main) { activity in
                guard let activity = activity else { return }

                let activityType: String
                if activity.stationary {
                    activityType = "STATIONARY"
                } else if activity.walking {
                    activityType = "WALKING"
                } else if activity.running {
                    activityType = "RUNNING"
                } else if activity.automotive {
                    activityType = "AUTOMOTIVE"
                } else if activity.cycling {
                    activityType = "CYCLING"
                } else {
                    activityType = "UNKNOWN"
                }

                let confidence: String
                switch activity.confidence {
                case .low:
                    confidence = "LOW"
                case .medium:
                    confidence = "MEDIUM"
                case .high:
                    confidence = "HIGH"
                @unknown default:
                    confidence = "UNKNOWN"
                }

                let event: [String: Any] = [
                    "activityType": activityType,
                    "transitionType": "ENTER",
                    "confidence": confidence,
                    "timestamp": activity.startDate.timeIntervalSince1970 * 1000
                ]

                self.sendEvent("onActivityChange", [
                    "events": [event]
                ])
            }

            self.isTracking = true
            promise.resolve("STARTED")
        }

        AsyncFunction("stopTracking") { (promise: Promise) in
            self.motionActivityManager.stopActivityUpdates()
            self.isTracking = false
            promise.resolve("STOPPED")
        }

        OnDestroy {
            self.motionActivityManager.stopActivityUpdates()
            self.isTracking = false
        }
    }
}
