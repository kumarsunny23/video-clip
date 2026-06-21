/**
 * AutoDetect.jsx — Controls for auto-generating clip segments.
 *
 * Props:
 *   sessionId        string
 *   duration         number (total video seconds)
 *   onSegments([])   called with array of { start, end } objects
 *   disabled         boolean
 */

import { useState } from 'react'
import { Wand2, Loader2, Film, Zap } from 'lucide-react'

export default function AutoDetect({ sessionId, duration, onSegments, disabled }) {
  const [mode, setMode] = useState('interval')         // 'interval' | 'scene'
  const [intervalSecs, setIntervalSecs] = useState(30)
  const [maxClips, setMaxClips] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auto-segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          mode,
          interval_seconds: parseFloat(intervalSecs),
          max_clips: parseInt(maxClips),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onSegments(data.segments || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-violet-400" />
        <h3 className="text-white font-semibold text-sm">Auto-Detect Segments</h3>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <ModeBtn
          id="mode-interval"
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Interval"
          active={mode === 'interval'}
          onClick={() => setMode('interval')}
        />
        <ModeBtn
          id="mode-scene"
          icon={<Film className="w-3.5 h-3.5" />}
          label="Scene Change"
          active={mode === 'scene'}
          onClick={() => setMode('scene')}
        />
      </div>

      {/* Interval controls */}
      {mode === 'interval' && (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="interval-seconds" className="block text-xs text-slate-400 mb-1">
              Clip length (seconds)
            </label>
            <input
              id="interval-seconds"
              type="number"
              min={5}
              max={Math.floor(duration)}
              value={intervalSecs}
              onChange={(e) => setIntervalSecs(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="max-clips" className="block text-xs text-slate-400 mb-1">
              Max clips
            </label>
            <input
              id="max-clips"
              type="number"
              min={1}
              max={50}
              value={maxClips}
              onChange={(e) => setMaxClips(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Scene mode info */}
      {mode === 'scene' && (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="scene-max-clips" className="block text-xs text-slate-400 mb-1">
              Max clips
            </label>
            <input
              id="scene-max-clips"
              type="number"
              min={1}
              max={50}
              value={maxClips}
              onChange={(e) => setMaxClips(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-600 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <p className="flex-1 text-xs text-slate-400 pb-2">
            FFmpeg detects cuts between scenes. May take a moment for long videos.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        id="auto-detect-btn"
        onClick={handleGenerate}
        disabled={loading || disabled}
        className="
          w-full flex items-center justify-center gap-2
          px-4 py-2.5 rounded-xl
          bg-gradient-to-r from-violet-700 to-purple-700
          hover:from-violet-600 hover:to-purple-600
          text-white text-sm font-semibold
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all duration-200
        "
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {loading ? 'Detecting…' : 'Generate Segments'}
      </button>
    </div>
  )
}

function ModeBtn({ id, icon, label, active, onClick }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        border transition-all duration-200
        ${active
          ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
          : 'bg-surface-600 border-white/10 text-slate-400 hover:border-white/20'}
      `}
    >
      {icon}
      {label}
    </button>
  )
}
