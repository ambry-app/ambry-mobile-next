Pod::Spec.new do |s|
  s.name           = 'ShakeDetector'
  s.version        = '1.0.0'
  s.summary        = 'Shake/motion detector for sleep timer'
  s.description    = 'Detects device motion/shake for resetting sleep timer (Android-only, iOS stub)'
  s.author         = ''
  s.homepage       = 'https://github.com/ambry-app/ambry-mobile-next'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
end
