Pod::Spec.new do |s|
  s.name           = 'AudioPlayer'
  s.version        = '1.0.0'
  s.summary        = "Ambry's own queue player"
  s.description    = 'AVQueuePlayer + MPRemoteCommandCenter + MPNowPlayingInfoCenter behind the same contract as the Android media3 module'
  s.author         = ''
  s.homepage       = 'https://github.com/ambry-app/ambry-mobile-next'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'MediaPlayer'

  s.source_files = '*.swift'
end
