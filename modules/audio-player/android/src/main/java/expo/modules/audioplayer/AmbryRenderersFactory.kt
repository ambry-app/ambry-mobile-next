package expo.modules.audioplayer

import android.content.Context
import android.os.Handler
import androidx.media3.decoder.ffmpeg.FfmpegAudioRenderer
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.audio.AudioRendererEventListener
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector

// FFmpeg is built with only the ac3/eac3 decoders, so it claims nothing else.
// It goes first because platform Dolby decoders accept E-AC-3 JOC (Atmos)
// and then reject the frames; FFmpeg decodes the 5.1 bed and ignores JOC.
class AmbryRenderersFactory(context: Context) : DefaultRenderersFactory(context) {
  override fun buildAudioRenderers(
    context: Context,
    extensionRendererMode: Int,
    mediaCodecSelector: MediaCodecSelector,
    enableDecoderFallback: Boolean,
    audioSink: AudioSink,
    eventHandler: Handler,
    eventListener: AudioRendererEventListener,
    out: ArrayList<Renderer>,
  ) {
    out.add(FfmpegAudioRenderer(eventHandler, eventListener, audioSink))
    super.buildAudioRenderers(
      context, extensionRendererMode, mediaCodecSelector, enableDecoderFallback,
      audioSink, eventHandler, eventListener, out,
    )
  }
}
