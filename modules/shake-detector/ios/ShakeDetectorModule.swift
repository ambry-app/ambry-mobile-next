import ExpoModulesCore

public class ShakeDetectorModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ShakeDetector")

        Events("onMotionDetected")

        // No-op on iOS - motion detection not supported in background
        Function("start") { (_: Int, _: Double, _: Bool) in
            // Do nothing on iOS
        }

        Function("stop") {
            // Do nothing on iOS
        }

        Function("isRunning") {
            return false
        }
    }
}
