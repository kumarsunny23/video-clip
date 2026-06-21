/**
 * ClipCard.jsx — Displays a single generated/in-progress clip.
 *
 * Props:
 *   clip  {
 *     clip_id, label, start, end, duration, status,
 *     progress, error_msg, thumbnail_url, download_url, file_size
 *   }
 */

import { Download, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2,'0')}`
}

function fmtBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const STATUS_CONFIG = {
  queued:     { icon: Clock,        color: 'text-slate-400',  bg: 'bg-slate-400/10', label: 'Queued'     },
  processing: { icon: Loader2,      color: 'text-brand-400',  bg: 'bg-brand-400/10', label: 'Processing' },
  done:       { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Done'   },
  error:      { icon: AlertTriangle,color: 'text-red-400',    bg: 'bg-red-400/10',   label: 'Error'      },
}

export default function ClipCard({ clip }) {
  const cfg = STATUS_CONFIG[clip.status] || STATUS_CONFIG.queued
  const StatusIcon = cfg.icon

  const handleDownload = () => {
    if (clip.download_url) {
      const a = document.createElement('a')
      a.href = clip.download_url
      a.download = `${clip.label}.mp4`
      a.click()
    }
  }

  return (
    <div className="clip-card glass-card p-4 space-y-3 transition-all duration-300 animate-slide-up">
      {/* Thumbnail + status badge */}
      <div className="relative">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.label}
            className="w-full h-32 object-cover rounded-lg bg-surface-700"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-32 rounded-lg bg-surface-700 flex items-center justify-center">
            {clip.status === 'processing' ? (
              <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
            ) : (
              <div className="text-slate-600 text-xs text-center px-2">
                {clip.status === 'queued' ? 'Waiting to process…' : 'No preview'}
              </div>
            )}
          </div>
        )}

        {/* Status pill */}
        <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border border-current border-opacity-20`}>
          <StatusIcon className={`w-3 h-3 ${clip.status === 'processing' ? 'animate-spin' : ''}`} />
          {cfg.label}
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-mono">
          {fmt(clip.start)} → {fmt(clip.end)}
        </div>
      </div>

      {/* Label + meta */}
      <div>
        <h4 className="text-white font-semibold text-sm truncate" title={clip.label}>
          {clip.label}
        </h4>
        <p className="text-slate-400 text-xs mt-0.5">
          {clip.duration.toFixed(1)}s
          {clip.file_size ? <span className="ml-2 text-slate-500">· {fmtBytes(clip.file_size)}</span> : ''}
        </p>
      </div>

      {/* Progress bar — only shown during processing */}
      {clip.status === 'processing' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Encoding…</span>
            <span>{clip.progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${clip.progress}%`,
                background: 'linear-gradient(90deg, #4c6ef5, #7c3aed)',
              }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {clip.status === 'error' && clip.error_msg && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg p-2 leading-relaxed">
          {clip.error_msg}
        </p>
      )}

      {/* Download button */}
      {clip.status === 'done' && clip.download_url && (
        <button
          id={`download-clip-${clip.clip_id}`}
          onClick={handleDownload}
          className="
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-xl
            bg-emerald-600/20 border border-emerald-500/30
            text-emerald-400 text-sm font-semibold
            hover:bg-emerald-600/30 hover:border-emerald-500/50
            transition-all duration-200
          "
        >
          <Download className="w-4 h-4" />
          Download clip
        </button>
      )}
    </div>
  )
}
