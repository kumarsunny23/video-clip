/**
 * ProcessingPanel.jsx — "Process Clips" button + overall status bar.
 *
 * Props:
 *   sessionId       string
 *   clips           queued clip specs (pre-submit)
 *   sessionStatus   status object from /api/status polling (null if not started)
 *   onProcessStart  callback when processing begins
 *   onDownloadAll   callback for ZIP download
 */

import { useState } from 'react'
import { Play, Download, Loader2, CheckCircle2, AlertTriangle, PackageOpen } from 'lucide-react'

function countByStatus(clips, status) {
  return clips.filter((c) => c.status === status).length
}

export default function ProcessingPanel({
  sessionId,
  clips,
  sessionStatus,
  onProcessStart,
  onDownloadAll,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const processedClips = sessionStatus?.clips || []
  const totalClips = processedClips.length
  const doneCount = countByStatus(processedClips, 'done')
  const errorCount = countByStatus(processedClips, 'error')
  const processingCount = countByStatus(processedClips, 'processing')
  const overallPct = totalClips > 0 ? Math.round((doneCount / totalClips) * 100) : 0
  const isProcessing = sessionStatus?.overall_status === 'processing'
  const isDone = sessionStatus?.overall_status === 'done' || sessionStatus?.overall_status === 'done_with_errors'

  const handleProcess = async () => {
    if (!sessionId || clips.length === 0) return
    setError('')
    setLoading(true)

    try {
      // First: commit queued clips to the backend
      const addRes = await fetch('/api/add-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          clips: clips.map((c) => ({
            start: c.start,
            end: c.end,
            label: c.label,
            effect: c.effect || 'none',
            caption: c.caption || null,
            fast_cut: c.fast_cut !== false,
          })),
        }),
      })
      if (!addRes.ok) {
        const d = await addRes.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to queue clips')
      }

      // Then: trigger processing
      const procRes = await fetch('/api/process-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!procRes.ok) {
        const d = await procRes.json().catch(() => ({}))
        throw new Error(d.detail || 'Failed to start processing')
      }

      onProcessStart()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadAll = () => {
    const url = `/api/download-all/${sessionId}`
    const a = document.createElement('a')
    a.href = url
    a.download = 'clips.zip'
    a.click()
    if (onDownloadAll) onDownloadAll()
  }

  // ── Show processing status panel ──
  if (isProcessing || isDone) {
    return (
      <div className="glass-card p-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">
            {isProcessing ? 'Processing Clips…' : 'Processing Complete'}
          </h3>
          <div className="flex items-center gap-2 text-xs">
            {doneCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {doneCount} done
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" /> {errorCount} failed
              </span>
            )}
            {processingCount > 0 && (
              <span className="flex items-center gap-1 text-brand-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {processingCount} processing
              </span>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{doneCount} / {totalClips} clips complete</span>
            <span>{overallPct}%</span>
          </div>
          <div className="h-2 bg-surface-600 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${overallPct}%`,
                background: isDone && errorCount === 0
                  ? 'linear-gradient(90deg,#10b981,#059669)'
                  : 'linear-gradient(90deg,#4c6ef5,#7c3aed)',
              }}
            />
          </div>
        </div>

        {/* Download all ZIP button */}
        {isDone && doneCount > 0 && (
          <button
            id="download-all-btn"
            onClick={handleDownloadAll}
            className="
              w-full flex items-center justify-center gap-2
              px-4 py-3 rounded-xl
              bg-gradient-to-r from-emerald-700 to-teal-700
              hover:from-emerald-600 hover:to-teal-600
              text-white text-sm font-semibold
              transition-all duration-200 shadow-lg
            "
          >
            <PackageOpen className="w-4 h-4" />
            Download all as ZIP ({doneCount} clips)
          </button>
        )}
      </div>
    )
  }

  // ── Show "Process" button when clips are queued but not yet submitted ──
  return (
    <div className="glass-card p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Ready to Export</h3>
        {clips.length > 0 && (
          <span className="text-xs text-brand-400 bg-brand-600/20 px-2.5 py-1 rounded-full border border-brand-600/30">
            {clips.length} clip{clips.length !== 1 ? 's' : ''} queued
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        id="process-clips-btn"
        onClick={handleProcess}
        disabled={loading || clips.length === 0}
        className="
          btn-primary w-full flex items-center justify-center gap-2
          px-4 py-3.5 rounded-xl
          bg-gradient-to-r from-brand-600 to-violet-600
          hover:from-brand-500 hover:to-violet-500
          text-white text-sm font-bold
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all duration-200
          shadow-xl shadow-brand-900/30
        "
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4 fill-white" />
        )}
        {loading ? 'Starting…' : `Process ${clips.length} Clip${clips.length !== 1 ? 's' : ''}`}
      </button>

      {clips.length === 0 && (
        <p className="text-xs text-slate-500 text-center">
          Add clips using the timeline above to enable processing
        </p>
      )}
    </div>
  )
}
