import React, { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function TopicForm({ onSubmit, loading }) {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    onSubmit(topic.trim());
    setTopic('');
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 mb-16">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-2 flex gap-2 items-center shadow-2xl focus-within:ring-2 focus-within:ring-brand-500/50 transition-all duration-300">
        <div className="flex-1 flex items-center pl-3">
          <Sparkles className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            placeholder="Describe an educational topic (e.g. Binary Search, Photosynthesis)..."
            className="w-full bg-transparent border-0 outline-none ring-0 text-white placeholder-slate-500 text-base"
          />
        </div>
        
        <button
          type="submit"
          disabled={!topic.trim() || loading}
          className="bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-xl flex items-center gap-2 transition-all shrink-0 cursor-pointer shadow-lg shadow-brand-600/35"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Animate</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
      
      {/* Quick topics suggestions */}
      <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs font-medium text-slate-500">
        <span>Try suggesting:</span>
        <button
          type="button"
          onClick={() => setTopic('Binary Search')}
          className="hover:text-indigo-400 transition cursor-pointer"
        >
          "Binary Search"
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setTopic('How Neural Networks Learn')}
          className="hover:text-indigo-400 transition cursor-pointer"
        >
          "Neural Networks"
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setTopic('The Water Cycle')}
          className="hover:text-indigo-400 transition cursor-pointer"
        >
          "Water Cycle"
        </button>
      </div>
    </div>
  );
}
