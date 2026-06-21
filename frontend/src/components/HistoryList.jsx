import React from 'react';
import { Play, Calendar, Film, ArrowRight } from 'lucide-react';

export default function HistoryList({ videos, onSelectVideo }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-16 px-4 glass rounded-3xl border border-slate-800/80 max-w-2xl mx-auto">
        <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Film className="w-6 h-6 text-slate-500" />
        </div>
        <h4 className="text-lg font-bold text-white mb-2">No lectures compiled yet</h4>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Input an educational topic above, and we will compile a visual animation video with synced voices.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 mb-24">
      <div className="flex items-center justify-between mb-8 border-b border-slate-800/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Your Compiled Lectures</h2>
          <p className="text-sm text-slate-400">Browse previous animation outputs and play them instantly.</p>
        </div>
        <span className="text-xs bg-brand-500/10 border border-brand-500/20 text-brand-100 font-semibold px-3 py-1 rounded-full">
          {videos.length} {videos.length === 1 ? 'Video' : 'Videos'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <div
            key={video.id}
            onClick={() => onSelectVideo(video)}
            className="group glass rounded-2xl overflow-hidden cursor-pointer border border-slate-800/80 hover:border-brand-500/30 transition-all duration-300 shadow-lg hover:shadow-2xl flex flex-col justify-between"
          >
            {/* Visual simulated thumbnail overlay */}
            <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950/40 relative flex items-center justify-center overflow-hidden border-b border-slate-800/80">
              <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors" />
              <div className="w-12 h-12 rounded-full bg-brand-600 group-hover:bg-brand-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300 z-10">
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              </div>
              
              {/* Overlay elements resembling video frames */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-md text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">
                <Film className="w-3 h-3" />
                <span>Animation</span>
              </div>
            </div>

            {/* Content text metadata */}
            <div className="p-5 flex-1 flex flex-col justify-between bg-slate-900/20">
              <div className="mb-4">
                <h3 className="font-bold text-white group-hover:text-brand-500 transition line-clamp-2 text-base leading-snug">
                  {video.title}
                </h3>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(video.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 group-hover:text-white transition">
                  <span>Watch Video</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
