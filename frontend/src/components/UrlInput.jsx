/**
 * UrlInput.jsx — Video URL input + Load Video button.
 *
 * Props:
 *   onLoad(videoInfo)  called when the video is successfully loaded
 *   isLoading          whether a load is in progress
 *   setIsLoading(bool) update loading state in parent
 */

import { useState } from 'react'
import { Link2, Loader2, Scissors } from 'lucide-react'

const EXAMPLE_URLS = [
  { label: 'YouTube clip', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { label: 'Direct MP4',   url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
]

export default function UrlInput({ onLoad, isLoading, setIsLoading }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)

  const handleLoad = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a video URL')
      return
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }

    setError('')
    setIsLoading(true)
    setDownloadProgress(0)

    try {
      const res = await fetch('/api/load-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }

      const videoInfo = await res.json()
      onLoad(videoInfo)
    } catch (err) {
      setError(err.message || 'Failed to load video')
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLoad()
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      {/* Hero label */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-brand-600/20 border border-brand-600/30">
          <Scissors className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-brand-400 uppercase tracking-widest">Step 1</h2>
          <p className="text-white font-medium">Load your video</p>
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="video-url-input"
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="Paste YouTube URL or direct video link (.mp4, .mov…)"
            disabled={isLoading}
            className="
              w-full pl-10 pr-4 py-3.5 rounded-xl
              bg-surface-700 border border-white/10
              text-white placeholder-slate-500
              focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              text-sm
            "
          />
        </div>

        <button
          id="load-video-btn"
          onClick={handleLoad}
          disabled={isLoading || !url.trim()}
          className="
            btn-primary flex items-center gap-2 px-6 py-3.5 rounded-xl
            bg-gradient-to-r from-brand-600 to-violet-600
            text-white font-semibold text-sm
            hover:from-brand-500 hover:to-violet-500
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200
            whitespace-nowrap shadow-lg shadow-brand-900/30
          "
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Scissors className="w-4 h-4" />
          )}
          {isLoading ? 'Loading…' : 'Load Video'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
          {error}
        </p>
      )}

      {/* Download progress during load */}
      {isLoading && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Downloading &amp; probing video…</span>
          </div>
          <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
            <div className="h-full shimmer rounded-full" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Example links */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500">Try:</span>
        {EXAMPLE_URLS.map((ex) => (
          <button
            key={ex.url}
            onClick={() => setUrl(ex.url)}
            disabled={isLoading}
            className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2 disabled:opacity-40 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  )
}
