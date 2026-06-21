/**
 * App.jsx — Root application component.
 *
 * State machine:
 *   idle        → user has not loaded a video yet
 *   loading     → yt-dlp/HTTP download in progress
 *   ready       → video loaded; user defines clips
 *   processing  → FFmpeg running; polling /api/status
 *   done        → all clips ready for download
 *
 * Key flows:
 *   1. UrlInput calls onLoad() → sets videoInfo → transitions to "ready"
 *   2. User drags TimelineSlider + clicks Add Clip → pendingClips array grows
 *   3. ProcessingPanel calls /api/add-clips then /api/process-clips
 *   4. useEffect polls /api/status every 1.5s while state === "processing"
 *   5. Done clips appear as ClipCard grid with individual + ZIP download
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Scissors, RefreshCw, Github, Sparkles } from 'lucide-react'
import UrlInput from './components/UrlInput.jsx'
import VideoPlayer from './components/VideoPlayer.jsx'
import ClipQueue from './components/ClipQueue.jsx'
import ClipCard from './components/ClipCard.jsx'
import ProcessingPanel from './components/ProcessingPanel.jsx'
import AutoDetect from './components/AutoDetect.jsx'

// Poll interval while processing
const POLL_MS = 1500

export default function App() {
  const [appState, setAppState] = useState('idle')   // idle | loading | ready | processing | done
  const [videoInfo, setVideoInfo] = useState(null)
  const [pendingClips, setPendingClips] = useState([])
  const [sessionStatus, setSessionStatus] = useState(null)
  const [toast, setToast] = useState(null)

  const videoRef = useRef(null)
  const pollRef = useRef(null)

  // ── Toast helper ──
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Video loaded ──
  const handleVideoLoaded = (info) => {
    setVideoInfo(info)
    setPendingClips([])
    setSessionStatus(null)
    setAppState('ready')
    showToast(`"${info.title}" loaded successfully`, 'success')
  }

  // ── Auto-segment results ──
  const handleAutoSegments = (segments) => {
    const newClips = segments.map((seg, i) => ({
      start: seg.start,
      end: seg.end,
      label: `Segment ${pendingClips.length + i + 1}`,
      effect: 'none',
      caption: null,
      fast_cut: true,
    }))
    setPendingClips((prev) => [...prev, ...newClips])
    showToast(`${newClips.length} segments added to queue`, 'success')
  }

  // ── Processing started ──
  const handleProcessStart = () => {
    setAppState('processing')
    setPendingClips([])   // submitted; clear queue
  }

  // ── Poll status ──
  useEffect(() => {
    if (appState !== 'processing' || !videoInfo?.session_id) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/status/${videoInfo.session_id}`)
        if (!res.ok) return
        const status = await res.json()
        setSessionStatus(status)

        const overall = status.overall_status
        if (overall === 'done' || overall === 'done_with_errors') {
          clearInterval(pollRef.current)
          setAppState('done')
          const doneCount = status.clips.filter((c) => c.status === 'done').length
          showToast(`${doneCount} clip${doneCount !== 1 ? 's' : ''} ready to download!`, 'success')
        }
      } catch (_) {
        // Network glitch — keep polling
      }
    }

    poll() // immediate first call
    pollRef.current = setInterval(poll, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [appState, videoInfo])

  // ── Reset everything ──
  const handleReset = async () => {
    if (videoInfo?.session_id) {
      fetch(`/api/session/${videoInfo.session_id}`, { method: 'DELETE' }).catch(() => {})
    }
    clearInterval(pollRef.current)
    setAppState('idle')
    setVideoInfo(null)
    setPendingClips([])
    setSessionStatus(null)
  }

  const isLoading = appState === 'loading'
  const isProcessing = appState === 'processing'

  return (
    <div className="min-h-screen bg-surface-900 relative overflow-x-hidden">
      {/* Decorative background orbs */}
      <div className="orb w-[600px] h-[600px] -top-64 -left-64 bg-brand-700/20" />
      <div className="orb w-[500px] h-[500px] -bottom-48 -right-48 bg-violet-700/15" />
      <div className="orb w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-700/10" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ── Header ── */}
        <header className="border-b border-white/5 bg-surface-800/50 backdrop-blur sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 shadow-lg shadow-brand-900/30">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">Video Clip Cutter</h1>
                <p className="text-slate-400 text-xs mt-0.5">Powered by FFmpeg + yt-dlp</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {appState !== 'idle' && (
                <button
                  id="reset-btn"
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-700 border border-white/10 text-slate-300 text-sm hover:border-white/20 hover:text-white transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Video
                </button>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                v1.0
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

          {/* ── IDLE: URL input ── */}
          {appState === 'idle' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
              {/* Hero text */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-300 text-sm font-medium mb-2">
                  <Sparkles className="w-4 h-4" />
                  Cut • Crop • Export
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                  Clip any video,{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-violet-400">
                    instantly
                  </span>
                </h2>
                <p className="text-slate-400 text-lg max-w-xl">
                  Paste a YouTube URL or direct video link. Define your clips. Export ready-to-post
                  vertical videos for Shorts, Reels &amp; TikTok.
                </p>
              </div>

              <UrlInput
                onLoad={handleVideoLoaded}
                isLoading={isLoading}
                setIsLoading={(v) => setAppState(v ? 'loading' : 'idle')}
              />

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-400">
                {['YouTube & direct MP4', 'FFmpeg stream copy', '9:16 crop for Shorts', 'Batch ZIP download', 'Scene detection', 'Text overlays'].map((f) => (
                  <span key={f} className="px-3 py-1.5 rounded-full bg-surface-700 border border-white/5">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── LOADING ── */}
          {appState === 'loading' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-surface-600 border-t-brand-500 animate-spin" />
                <Scissors className="absolute inset-0 m-auto w-7 h-7 text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-lg">Loading video…</p>
                <p className="text-slate-400 text-sm mt-1">Downloading & probing metadata with yt-dlp</p>
              </div>
              <div className="w-64 h-1.5 bg-surface-600 rounded-full overflow-hidden">
                <div className="h-full shimmer rounded-full w-full" />
              </div>
            </div>
          )}

          {/* ── READY / PROCESSING / DONE ── */}
          {(appState === 'ready' || appState === 'processing' || appState === 'done') && videoInfo && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left column: video + clip definition */}
              <div className="lg:col-span-3 space-y-5">
                <VideoPlayer videoInfo={videoInfo} videoRef={videoRef} />

                {appState === 'ready' && (
                  <>
                    <ClipQueue
                      sessionId={videoInfo.session_id}
                      duration={videoInfo.duration}
                      clips={pendingClips}
                      onClipsChange={setPendingClips}
                      videoRef={videoRef}
                    />

                    <AutoDetect
                      sessionId={videoInfo.session_id}
                      duration={videoInfo.duration}
                      onSegments={handleAutoSegments}
                      disabled={false}
                    />
                  </>
                )}

                <ProcessingPanel
                  sessionId={videoInfo.session_id}
                  clips={pendingClips}
                  sessionStatus={sessionStatus}
                  onProcessStart={handleProcessStart}
                  onDownloadAll={() => showToast('ZIP download started', 'success')}
                />
              </div>

              {/* Right column: generated clips grid */}
              <div className="lg:col-span-2 space-y-4">
                {sessionStatus?.clips?.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-white font-bold text-sm">
                        Generated Clips
                        <span className="text-brand-400 ml-2">
                          ({sessionStatus.clips.filter(c => c.status === 'done').length}/{sessionStatus.clips.length})
                        </span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                      {sessionStatus.clips.map((clip) => (
                        <ClipCard key={clip.clip_id} clip={clip} />
                      ))}
                    </div>
                  </>
                ) : appState === 'ready' ? (
                  <div className="glass-card p-6 text-center space-y-2 h-48 flex flex-col items-center justify-center">
                    <div className="text-3xl">✂️</div>
                    <p className="text-slate-400 text-sm">
                      Define clips using the timeline, then click<br/>
                      <span className="text-brand-400 font-medium">Process Clips</span> to generate them.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
          Video Clip Cutter · Built with FastAPI, FFmpeg, yt-dlp &amp; React
        </footer>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`
            toast-enter fixed bottom-6 right-6 z-50
            px-4 py-3 rounded-xl shadow-2xl
            flex items-center gap-2 text-sm font-medium
            ${toast.type === 'success'
              ? 'bg-emerald-600/90 text-white border border-emerald-500/50'
              : toast.type === 'error'
              ? 'bg-red-600/90 text-white border border-red-500/50'
              : 'bg-surface-600/90 text-white border border-white/10'}
            backdrop-blur
          `}
        >
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '✕'}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
