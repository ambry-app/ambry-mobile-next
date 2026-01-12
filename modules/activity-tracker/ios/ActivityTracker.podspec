Pod::Spec.new do |s|
  s.name           = 'ActivityTracker'
  s.version        = '1.0.0'
  s.summary        = 'Activity tracking for sleep timer'
  s.description    = 'Detects user activity (walking, stationary, etc.) using CMMotionActivityManager on iOS and Activity Recognition API on Android'
  s.author         = ''
  s.homepage       = 'https://github.com/ambry-app/ambry-mobile-next'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreMotion'

  s.source_files = '*.swift'
end
