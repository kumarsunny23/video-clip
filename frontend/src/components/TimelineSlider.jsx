/**
 * TimelineSlider.jsx — Dual-handle range slider for selecting clip start/end.
 *
 * Two overlapping <input type="range"> elements create a dual-handle effect.
 * A coloured fill strip is drawn between the two thumb positions.
 *
 * Props:
 *   duration     number (total video seconds)
 *   start        number (current start value, seconds)
 *   end          number (current end value, seconds)
 *   onChange({start, end})  callback fired on every handle move
 *   videoRef     optional ref to HTMLVideoElement — clicking on timeline seeks it
 */

import { useCallback, useRef } from 'react'

function fmt(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  const ms = Math.floor((secs % 1) * 10)
  if (h > 0)
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}.${ms}`
}

const MIN_GAP = 0.5 // seconds minimum clip length

export default function TimelineSlider({ duration, start, end, onChange, videoRef }) {
  const containerRef = useRef(null)

  const handleStartChange = useCallback((e) => {
    const val = parseFloat(e.target.value)
    if (val >= end - MIN_GAP) return
    onChange({ start: val, end })
    if (videoRef?.current) videoRef.current.currentTime = val
  }, [end, onChange, videoRef])

  const handleEndChange = useCallback((e) => {
    const val = parseFloat(e.target.value)
    if (val <= start + MIN_GAP) return
    onChange({ start, end: val })
    if (videoRef?.current) videoRef.current.currentTime = val
  }, [start, onChange, videoRef])

  // Calculate fill strip position as percentages
  const startPct = duration > 0 ? (start / duration) * 100 : 0
  const endPct   = duration > 0 ? (end   / duration) * 100 : 100

  const clipDuration = end - start
  const clipDurationFormatted = fmt(clipDuration)

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Timeline Selection</h3>
        <span className="text-brand-400 font-mono text-sm bg-brand-900/30 px-2.5 py-1 rounded-lg border border-brand-800/50">
          ✂ {clipDurationFormatted}
        </span>
      </div>

      {/* Dual-handle slider */}
      <div className="range-slider-container" ref={containerRef}>
        {/* Background track */}
        <div className="range-slider-track" />

        {/* Coloured fill between handles */}
        <div
          className="range-slider-fill"
          style={{
            left:  `${startPct}%`,
            width: `${endPct - startPct}%`,
          }}
        />

        {/* Start handle (lower z-index) */}
        <input
          id="timeline-start"
          type="range"
          className="range-slider-input"
          style={{ zIndex: start > duration - 1 ? 5 : 3 }}
          min={0}
          max={duration}
          step={0.1}
          value={start}
          onChange={handleStartChange}
        />

        {/* End handle (higher z-index) */}
        <input
          id="timeline-end"
          type="range"
          className="range-slider-input"
          style={{ zIndex: 4 }}
          min={0}
          max={duration}
          step={0.1}
          value={end}
          onChange={handleEndChange}
        />
      </div>

      {/* Time labels row */}
      <div className="flex items-center justify-between text-xs">
        {/* Start time edit */}
        <TimeInput
          id="start-time-input"
          label="Start"
          value={start}
          min={0}
          max={end - MIN_GAP}
          step={0.1}
          onChange={(v) => onChange({ start: v, end })}
        />

        {/* Centre tick marks */}
        <div className="flex-1 mx-3 flex justify-between px-1">
          {[0.25, 0.5, 0.75].map((frac) => (
            <div key={frac} className="flex flex-col items-center gap-1">
              <div className="w-px h-2 bg-white/20" />
              <span className="text-slate-500" style={{ fontSize: '0.6rem' }}>
                {fmt(duration * frac)}
              </span>
            </div>
          ))}
        </div>

        {/* End time edit */}
        <TimeInput
          id="end-time-input"
          label="End"
          value={end}
          min={start + MIN_GAP}
          max={duration}
          step={0.1}
          onChange={(v) => onChange({ start, end: v })}
        />
      </div>
    </div>
  )
}

/** Small numeric input for precise time entry */
function TimeInput({ id, label, value, min, max, step, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-slate-400 uppercase tracking-wider" style={{ fontSize: '0.6rem' }}>{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value.toFixed(1)}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v) && v >= min && v <= max) onChange(v)
        }}
        className="
          w-20 text-center px-2 py-1 rounded-lg
          bg-surface-600 border border-white/10
          text-white font-mono text-xs
          focus:outline-none focus:border-brand-500
          transition-colors
        "
      />
      <span className="text-brand-400 font-mono font-semibold">{fmt(value)}</span>
    </div>
  )
}
