// src/StandardsModal.jsx
import React from 'react';
import { X, Trophy, Clock } from 'lucide-react';

export default function StandardsModal({ isOpen, onClose, standards, bestTime, eventName }) {
  if (!isOpen) return null;

  // Helper to format time
  const secondsToTime = (val) => {
    if (!val) return "-";
    const mins = Math.floor(val / 60);
    const secs = (val % 60).toFixed(2);
    return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
  };

  // 1. Create a "Ghost Standard" for the swimmer's time
  const myTimeEntry = {
    id: 'my-time',
    name: 'Your Best Time',
    time_seconds: bestTime,
    time_string: secondsToTime(bestTime),
    isMe: true
  };

  // 2. Merge with official standards and Sort (Fastest/Lowest Seconds First)
  const combinedList = [...standards, myTimeEntry].sort((a, b) => a.time_seconds - b.time_seconds);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500"/> Time Standards
            </h3>
            <p className="text-xs text-slate-400">{eventName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1">
          {combinedList.map((std, idx) => (
            <div 
              key={idx}
              className={`flex justify-between items-center p-3 rounded-lg text-sm ${
                std.isMe 
                  ? 'bg-blue-600 text-white font-bold shadow-lg ring-2 ring-blue-400 my-2 scale-105 origin-center z-10 relative' 
                  : 'bg-slate-800/50 text-slate-300 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank/Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                   std.isMe ? 'bg-white text-blue-600' : 'bg-slate-700 text-slate-500'
                }`}>
                   {std.isMe ? <Clock size={16} /> : idx + 1}
                </div>
                <span>{std.name}</span>
              </div>
              <span className="font-mono">{std.time_string}</span>
            </div>
          ))}
        </div>

        {/* Footer Legend */}
        <div className="p-3 bg-slate-800 border-t border-slate-700 text-center text-xs text-slate-500">
          Scroll to see faster times above and slower times below.
        </div>
      </div>
    </div>
  );
}
