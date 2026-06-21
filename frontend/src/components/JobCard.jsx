import React from 'react';
import { Loader2, AlertCircle, PlayCircle, Layers } from 'lucide-react';

export default function JobCard({ job }) {
  const isFailed = job.status === 'FAILED';
  const isCompleted = job.status === 'COMPLETED';
  const isRunning = !isFailed && !isCompleted;

  // Make human friendly status label
  const getStatusText = (status) => {
    if (status === 'PENDING') return 'Queued in pipeline...';
    if (status === 'GENERATING_SCRIPT') return 'Writing lesson script...';
    if (status.startsWith('RENDERING_ANIMATION')) return 'Rendering visuals (Manim)...';
    if (status.startsWith('GENERATING_AUDIO')) return 'Synthesizing voice (Coqui)...';
    if (status.startsWith('GENERATING_SUBTITLES')) return 'Transcribing audio (Whisper)...';
    if (status.startsWith('ASSEMBLING')) return 'Combining tracks (FFmpeg)...';
    if (status === 'CONCATENATING_SCENES') return 'Stitching final scenes...';
    if (status === 'COMPLETED') return 'Finished successfully!';
    if (status === 'FAILED') return 'Generation failed';
    return status;
  };

  return (
    <div className={`glass rounded-2xl p-6 border transition-all duration-300 ${isFailed ? 'border-red-500/20' : 'border-slate-800'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-semibold text-brand-500 uppercase tracking-widest mb-1 block">Active Generation</span>
          <h3 className="text-lg font-bold text-white truncate max-w-sm sm:max-w-md">{job.topic}</h3>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-900/50 border border-slate-800">
          {isRunning && <Loader2 className="w-3 h-3 animate-spin text-brand-500" />}
          {isFailed && <AlertCircle className="w-3 h-3 text-red-400" />}
          {isCompleted && <PlayCircle className="w-3 h-3 text-emerald-400" />}
          <span className={isFailed ? 'text-red-400' : isCompleted ? 'text-emerald-400' : 'text-slate-300'}>
            {job.status}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Progress Bar Container */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-400 mb-1">
            <span>{getStatusText(job.status)}</span>
            <span>{Math.round(job.progress)}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-brand-600 to-indigo-400'
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>

        {/* Error message displays */}
        {isFailed && job.error_message && (
          <div className="bg-red-500/10 border border-red-500/15 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2 max-h-24 overflow-y-auto mt-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-mono">{job.error_message}</p>
          </div>
        )}

        <div className="flex justify-between text-[11px] font-medium text-slate-500">
          <span>ID: {job.id.substring(0, 8)}...</span>
          <span>Created: {new Date(job.created_at).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
