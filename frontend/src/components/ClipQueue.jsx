/**
 * ClipQueue.jsx — Displays the list of queued clips and provides
 * controls for defining new ones.
 *
 * Props:
 *   sessionId         string
 *   duration          number (video total seconds)
 *   clips             array of { start, end, label, effect, caption, fast_cut }
 *   onClipsChange(cs) update clips in parent
 *   videoRef          ref to <video> element
 */

import { useState } from 'react'
import { Plus, Trash2, Scissors, ChevronDown, ChevronUp } from 'lucide-react'
import TimelineSlider from './TimelineSlider.jsx'

const EFFECTS = [
  { value: 'none',         label: 'No effect' },
  { value: 'fade',         label: 'Fade in/out' },
  { value: 'crop_vertical',label: '9:16 crop (Shorts)' },
  { value: 'fade_crop',    label: 'Fade + 9:16 crop' },
]

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2,'0')}`
}

export default function ClipQueue({ sessionId, duration, clips, onClipsChange, videoRef }) {
  // Current slider state for new-clip definition
  const [newStart, setNewStart] = useState(0)
  const [newEnd,   setNewEnd]   = useState(Math.min(30, duration))
  const [newLabel, setNewLabel] = useState('')
  const [newEffect, setNewEffect] = useState('none')
  const [newCaption, setNewCaption] = useState('')
  const [newFastCut, setNewFastCut] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSliderChange = ({ start, end }) => {
    setNewStart(start)
    setNewEnd(end)
  }

  const handleAddClip = () => {
    const label = newLabel.trim() || `Clip ${clips.length + 1}`
    onClipsChange([
      ...clips,
      {
        start: newStart,
        end: newEnd,
        label,
        effect: newEffect,
        caption: newCaption.trim() || null,
        fast_cut: newFastCut,
      },
    ])
    // Reset label, keep slider position so user can quickly add adjacent clips
    setNewLabel('')
  }

  const handleRemove = (idx) => {
    onClipsChange(clips.filter((_, i) => i !== idx))
  }

  const clipDuration = newEnd - newStart

  return (
    <div className="space-y-4">
      {/* ── Define new clip ── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-brand-400" />
          <h3 className="text-white font-semibold text-sm">Define Clip</h3>
        </div>

        {/* Timeline slider */}
        <TimelineSlider
          duration={duration}
          start={newStart}
          end={newEnd}
          onChange={handleSliderChange}
          videoRef={videoRef}
        />

        {/* Label */}
        <div>
          <label htmlFor="clip-label" className="block text-xs text-slate-400 mb-1">
            Clip label (optional)
          </label>
          <input
            id="clip-label"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={`Clip ${clips.length + 1}`}
            maxLength={60}
            className="
              w-full px-3 py-2 rounded-lg
              bg-surface-600 border border-white/10
              text-white text-sm placeholder-slate-500
              focus:outline-none focus:border-brand-500
              transition-colors
            "
          />
        </div>

        {/* Advanced options toggle */}
        <button
          id="advanced-options-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Advanced options
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-1 animate-fade-in">
            {/* Effect */}
            <div>
              <label htmlFor="clip-effect" className="block text-xs text-slate-400 mb-1">Effect</label>
              <select
                id="clip-effect"
                value={newEffect}
                onChange={(e) => setNewEffect(e.target.value)}
                className="
                  w-full px-3 py-2 rounded-lg
                  bg-surface-600 border border-white/10
                  text-white text-sm
                  focus:outline-none focus:border-brand-500
                "
              >
                {EFFECTS.map((ef) => (
                  <option key={ef.value} value={ef.value}>{ef.label}</option>
                ))}
              </select>
            </div>

            {/* Caption */}
            <div>
              <label htmlFor="clip-caption" className="block text-xs text-slate-400 mb-1">
                Text overlay / caption (optional)
              </label>
              <input
                id="clip-caption"
                type="text"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                placeholder="e.g. My highlight reel"
                maxLength={80}
                className="
                  w-full px-3 py-2 rounded-lg
                  bg-surface-600 border border-white/10
                  text-white text-sm placeholder-slate-500
                  focus:outline-none focus:border-brand-500
                  transition-colors
                "
              />
            </div>

            {/* Fast cut toggle */}
            <label id="fast-cut-toggle" className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setNewFastCut(!newFastCut)}
                className={`
                  relative w-10 h-5 rounded-full transition-all duration-200
                  ${newFastCut ? 'bg-brand-600' : 'bg-surface-500'}
                `}
              >
                <div
                  className={`
                    absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow
                    transition-transform duration-200
                    ${newFastCut ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                Fast cut <span className="text-slate-500 text-xs">(-c copy, no re-encode)</span>
              </span>
            </label>

            {!newFastCut && (
              <p className="text-xs text-amber-400/80 bg-amber-400/10 rounded-lg px-3 py-2">
                ⚠ Re-encode mode is slower but frame-accurate and required for effects.
              </p>
            )}
          </div>
        )}

        {/* Add button */}
        <button
          id="add-clip-btn"
          onClick={handleAddClip}
          className="
            btn-primary w-full flex items-center justify-center gap-2
            px-4 py-3 rounded-xl
            bg-gradient-to-r from-brand-600 to-violet-600
            hover:from-brand-500 hover:to-violet-500
            text-white text-sm font-semibold
            transition-all duration-200 shadow-lg shadow-brand-900/20
          "
        >
          <Plus className="w-4 h-4" />
          + Add Clip&ensp;
          <span className="text-brand-200 font-normal">
            ({fmt(newStart)} → {fmt(newEnd)}, {(clipDuration).toFixed(1)}s)
          </span>
        </button>
      </div>

      {/* ── Queued clips list ── */}
      {clips.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Clip Queue <span className="text-brand-400 ml-1">({clips.length})</span>
            </h3>
            <button
              id="clear-all-clips-btn"
              onClick={() => onClipsChange([])}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>

          {clips.map((clip, idx) => (
            <div
              key={idx}
              className="
                flex items-center gap-3 px-4 py-3 rounded-xl
                bg-surface-700 border border-white/5
                hover:border-white/10 transition-all
                animate-slide-up
              "
            >
              {/* Index badge */}
              <span className="
                w-6 h-6 rounded-full bg-brand-600/20 border border-brand-600/30
                text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0
              ">
                {idx + 1}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{clip.label}</p>
                <p className="text-slate-400 text-xs">
                  {fmt(clip.start)} → {fmt(clip.end)}
                  <span className="ml-2 text-slate-500">
                    ({(clip.end - clip.start).toFixed(1)}s)
                  </span>
                  {clip.effect !== 'none' && (
                    <span className="ml-2 text-violet-400">
                      ✦ {EFFECTS.find(e => e.value === clip.effect)?.label}
                    </span>
                  )}
                </p>
              </div>

              {/* Remove */}
              <button
                onClick={() => handleRemove(idx)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
