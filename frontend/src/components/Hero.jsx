import React from 'react';
import { Sparkles, Video, GraduationCap } from 'lucide-react';

export default function Hero() {
  return (
    <div className="relative text-center py-16 px-4 max-w-4xl mx-auto overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-brand-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-brand-500/20 text-brand-100 text-xs font-semibold mb-6 animate-pulse-slow">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>Next Generation Automated E-Learning</span>
      </div>

      <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
        Turn Any Concept into a <br/>
        <span className="bg-gradient-to-r from-brand-500 to-indigo-300 bg-clip-text text-transparent">
          Narrated Animation
        </span>
      </h1>

      <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
        EduAnimate AI orchestrates scriptwriting, Manim visualizations, Coqui voice synthesizers, Whisper transcripts, and FFmpeg assemblies to automatically compile beautiful video lectures.
      </p>

      <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400 font-medium">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-800">
          <GraduationCap className="w-4 h-4 text-brand-500" />
          <span>LLM Lesson Scripting</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-800">
          <Video className="w-4 h-4 text-indigo-400" />
          <span>Manim Rendering</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/40 border border-slate-800">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Whisper Auto-Subtitles</span>
        </div>
      </div>
    </div>
  );
}
