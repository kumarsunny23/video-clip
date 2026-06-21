/**
 * VideoPlayer.jsx — Displays the loaded video with metadata overlay.
 *
 * Props:
 *   videoInfo   { session_id, title, duration, thumbnail_url, source_url, width, height }
 *   videoRef    ref forwarded to <video> element (used by TimelineSlider for currentTime)
 */

import { useEffect, useRef, useState } from 'react'
import { Film, Clock, Monitor } from 'lucide-react'

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

export default function VideoPlayer({ videoInfo, videoRef }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Check if the source_url is a direct video (not YouTube)
  const isDirectVideo = videoInfo.source_url &&
    /\.(mp4|mov|webm|mkv|avi|m4v)(\?.*)?$/i.test(videoInfo.source_url)

  return (
    <div className="glass-card p-4 animate-slide-up">
      {/* Title row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="p-1.5 rounded-lg bg-brand-600/20 flex-shrink-0">
          <Film className="w-4 h-4 text-brand-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-sm truncate" title={videoInfo.title}>
            {videoInfo.title}
          </h3>
          <p className="text-slate-400 text-xs mt-0.5 truncate">{videoInfo.source_url}</p>
        </div>
      </div>

      {/* Video element — only shown for direct video URLs */}
      <div className="video-player-wrapper relative rounded-xl overflow-hidden bg-black">
        {isDirectVideo ? (
          <>
            <video
              ref={videoRef}
              src={videoInfo.source_url}
              controls
              preload="metadata"
              crossOrigin="anonymous"
              onLoadedMetadata={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
              className="w-full max-h-[360px] object-contain"
            />
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-800">
                <p className="text-slate-400 text-sm">Unable to preview — clip cutting will still work</p>
              </div>
            )}
          </>
        ) : (
          /* For YouTube / unsupported embeds, show the thumbnail */
          <div className="relative">
            <img
              src={videoInfo.thumbnail_url}
              alt={videoInfo.title}
              className="w-full max-h-[360px] object-cover rounded-xl"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-2 mx-auto">
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
                <p className="text-white text-sm font-medium">Preview not available</p>
                <p className="text-slate-300 text-xs mt-1">Use the timeline below to set clip points</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metadata badges */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <Badge icon={<Clock className="w-3 h-3" />} label={formatDuration(videoInfo.duration)} />
        {videoInfo.width && videoInfo.height && (
          <Badge icon={<Monitor className="w-3 h-3" />} label={`${videoInfo.width}×${videoInfo.height}`} />
        )}
        {videoInfo.fps && (
          <Badge label={`${videoInfo.fps} fps`} />
        )}
        <Badge
          label={`Session: ${videoInfo.session_id.slice(0, 8)}…`}
          className="opacity-50 text-xs font-mono"
        />
      </div>
    </div>
  )
}

function Badge({ icon, label, className = '' }) {
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-600 border border-white/5 text-slate-300 text-xs ${className}`}>
      {icon}
      {label}
    </span>
  )
}
