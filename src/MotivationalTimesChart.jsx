// src/MotivationalTimesChart.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabase';
import { Timer, ChevronDown, ChevronUp, Zap, Target } from 'lucide-react';

// Standard column definitions with colors
const STANDARD_COLS = [
  { key: 'B', label: 'B', bg: 'bg-amber-900/40', text: 'text-amber-400', achieved: 'bg-amber-600', border: 'border-amber-700' },
  { key: 'BB', label: 'BB', bg: 'bg-slate-600/40', text: 'text-slate-300', achieved: 'bg-slate-500', border: 'border-slate-500' },
  { key: 'A', label: 'A', bg: 'bg-yellow-900/40', text: 'text-yellow-400', achieved: 'bg-yellow-500', border: 'border-yellow-600' },
  { key: 'AA', label: 'AA', bg: 'bg-blue-900/40', text: 'text-blue-400', achieved: 'bg-blue-500', border: 'border-blue-600' },
  { key: 'AAA', label: 'AAA', bg: 'bg-purple-900/40', text: 'text-purple-400', achieved: 'bg-purple-500', border: 'border-purple-600' },
  { key: 'AAAA', label: 'AAAA', bg: 'bg-rose-900/40', text: 'text-rose-400', achieved: 'bg-rose-500', border: 'border-rose-600' },
];

// Time conversion helpers
const timeToSeconds = (timeStr) => {
  if (!timeStr) return 999999;
  if (['DQ', 'NS', 'DFS', 'SCR', 'DNF', 'NT'].some(s => timeStr.toUpperCase().includes(s))) return 999999;
  const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
  if (!cleanStr) return 999999;
  const parts = cleanStr.split(':');
  let val = 0;
  if (parts.length === 2) {
    val = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    val = parseFloat(parts[0]);
  }
  return isNaN(val) ? 999999 : val;
};

const secondsToTime = (val) => {
  if (!val || val >= 999999) return "-";
  const mins = Math.floor(val / 60);
  const secs = (val % 60).toFixed(2);
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
};

// Normalize event names for comparison
const normalizeEvent = (evt) => {
  if (!evt) return '';
  const clean = evt.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const match = clean.match(/(\d+)\s*(?:m|y)?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual\s*medley|im)/i);
  if (match) {
    let dist = match[1];
    let stroke = match[2];
    if (stroke === 'free') stroke = 'freestyle';
    if (stroke === 'back') stroke = 'backstroke';
    if (stroke === 'breast') stroke = 'breaststroke';
    if (stroke === 'fly') stroke = 'butterfly';
    if (stroke === 'individual medley') stroke = 'im';
    return `${dist} ${stroke}`;
  }
  return clean;
};

// Format event name for display
const formatEventDisplay = (evt) => {
  const parts = evt.split(' ');
  if (parts.length >= 2) {
    const dist = parts[0];
    let stroke = parts.slice(1).join(' ');
    stroke = stroke.charAt(0).toUpperCase() + stroke.slice(1);
    if (stroke.toLowerCase() === 'im') stroke = 'IM';
    return `${dist} ${stroke}`;
  }
  return evt;
};

export default function MotivationalTimesChart({ swimmerId, age, gender }) {
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'event', direction: 'asc' });
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!swimmerId || !age || !gender) return;

      // Fetch swimmer's results
      const { data: results } = await supabase
        .from('results')
        .select('event, time, date')
        .eq('swimmer_id', swimmerId);

      // Fetch motivational standards for this age/gender
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*')
        .eq('gender', gender)
        .in('name', ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'])
        .lte('age_min', age)
        .gte('age_max', age);

      if (!results || !standards) {
        setLoading(false);
        return;
      }

      // Group results by normalized event, find best time
      const bestTimes = {};
      results.forEach(r => {
        const normEvent = normalizeEvent(r.event);
        if (!normEvent || normEvent.startsWith('25 ')) return; // Skip 25s
        
        const seconds = timeToSeconds(r.time);
        if (seconds > 0 && seconds < 999999) {
          if (!bestTimes[normEvent] || seconds < bestTimes[normEvent].seconds) {
            bestTimes[normEvent] = {
              seconds,
              timeStr: r.time,
              date: r.date
            };
          }
        }
      });

      // Build rows for each event the swimmer has swum
      const rows = [];
      
      Object.keys(bestTimes).forEach(normEvent => {
        const pb = bestTimes[normEvent];
        
        // Find standards for this event
        const eventStandards = standards.filter(s => {
          const stdNorm = normalizeEvent(s.event);
          return stdNorm === normEvent;
        });

        // Build standards map for this row
        const stdMap = {};
        let highestAchieved = null;
        let nextCut = null;
        let nextCutDiff = null;

        // Sort standards from easiest (B) to hardest (AAAA) for determining next cut
        const orderedStds = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];
        
        orderedStds.forEach(stdName => {
          const std = eventStandards.find(s => s.name === stdName);
          if (std) {
            const achieved = pb.seconds <= std.time_seconds;
            stdMap[stdName] = {
              time: std.time_string || secondsToTime(std.time_seconds),
              seconds: std.time_seconds,
              achieved
            };
            
            if (achieved) {
              highestAchieved = stdName;
            } else if (!nextCut) {
              nextCut = stdName;
              nextCutDiff = pb.seconds - std.time_seconds;
            }
          }
        });

        rows.push({
          event: normEvent,
          displayEvent: formatEventDisplay(normEvent),
          pb: pb.timeStr,
          pbSeconds: pb.seconds,
          date: pb.date,
          standards: stdMap,
          highestAchieved,
          nextCut,
          nextCutDiff
        });
      });

      setEventData(rows);
      setLoading(false);
    };

    fetchData();
  }, [swimmerId, age, gender]);

  // Sorting logic
  const sortedData = useMemo(() => {
    const sorted = [...eventData];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      if (sortConfig.key === 'event') {
        aVal = a.displayEvent;
        bVal = b.displayEvent;
      } else if (sortConfig.key === 'pb') {
        aVal = a.pbSeconds;
        bVal = b.pbSeconds;
      } else if (sortConfig.key === 'nextCut') {
        aVal = a.nextCutDiff ?? 999;
        bVal = b.nextCutDiff ?? 999;
      } else {
        // Sort by standard column
        aVal = a.standards[sortConfig.key]?.achieved ? 0 : 1;
        bVal = b.standards[sortConfig.key]?.achieved ? 0 : 1;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [eventData, sortConfig]);

  const displayedData = showAllEvents ? sortedData : sortedData.slice(0, 5);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={12} className="inline ml-1" />
      : <ChevronDown size={12} className="inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8">
        <div className="flex items-center justify-center text-slate-400 gap-2">
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Loading times...
        </div>
      </div>
    );
  }

  if (eventData.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 text-center">
        <Timer size={32} className="mx-auto text-slate-600 mb-3" />
        <p className="text-slate-400 font-medium">No event times recorded yet</p>
        <p className="text-slate-500 text-sm mt-1">Import meet results to see progress</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalEvents = eventData.length;
  const qualifiedEvents = eventData.filter(e => e.highestAchieved).length;
  const closestCut = eventData
    .filter(e => e.nextCutDiff !== null)
    .sort((a, b) => a.nextCutDiff - b.nextCutDiff)[0];

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Motivational Times Progress</h3>
              <p className="text-slate-400 text-xs">Personal bests vs. time standards</p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{qualifiedEvents}<span className="text-slate-500">/{totalEvents}</span></div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Events Qualified</div>
            </div>
            {closestCut && (
              <div className="text-right border-l border-slate-700 pl-4">
                <div className="text-lg font-bold text-emerald-400">-{closestCut.nextCutDiff.toFixed(2)}s</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Closest to {closestCut.nextCut}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              <th 
                onClick={() => handleSort('event')}
                className="text-left px-4 py-3 text-slate-400 font-bold text-xs uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
              >
                Event <SortIcon columnKey="event" />
              </th>
              <th 
                onClick={() => handleSort('pb')}
                className="text-center px-3 py-3 text-slate-400 font-bold text-xs uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
              >
                PB <SortIcon columnKey="pb" />
              </th>
              {STANDARD_COLS.map(col => (
                <th 
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`text-center px-2 py-3 font-bold text-xs uppercase tracking-wider cursor-pointer hover:text-white transition-colors ${col.text}`}
                >
                  {col.label} <SortIcon columnKey={col.key} />
                </th>
              ))}
              <th 
                onClick={() => handleSort('nextCut')}
                className="text-right px-4 py-3 text-slate-400 font-bold text-xs uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
              >
                To Next <SortIcon columnKey="nextCut" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {displayedData.map((row, idx) => (
              <tr 
                key={row.event} 
                className="hover:bg-slate-800/30 transition-colors group"
              >
                {/* Event Name */}
                <td className="px-4 py-3">
                  <div className="font-bold text-white group-hover:text-blue-400 transition-colors">
                    {row.displayEvent}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                  </div>
                </td>

                {/* Personal Best */}
                <td className="px-3 py-3 text-center">
                  <div className="inline-flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                    <Timer size={12} className="text-blue-400" />
                    <span className="font-mono font-bold text-white">{row.pb}</span>
                  </div>
                </td>

                {/* Standard Columns */}
                {STANDARD_COLS.map(col => {
                  const std = row.standards[col.key];
                  if (!std) {
                    return (
                      <td key={col.key} className="px-2 py-3 text-center">
                        <span className="text-slate-600 text-xs">-</span>
                      </td>
                    );
                  }

                  const isAchieved = std.achieved;
                  const isHighest = row.highestAchieved === col.key;
                  const isNext = row.nextCut === col.key;

                  return (
                    <td key={col.key} className="px-2 py-3 text-center">
                      <div 
                        className={`
                          relative inline-flex flex-col items-center justify-center min-w-[60px] px-2 py-1.5 rounded-lg text-xs font-mono transition-all
                          ${isAchieved 
                            ? `${col.achieved} text-white shadow-lg ring-1 ring-white/20` 
                            : `${col.bg} ${col.text} border ${col.border}`
                          }
                          ${isHighest ? 'scale-110 ring-2 ring-yellow-400/50' : ''}
                          ${isNext ? 'animate-pulse' : ''}
                        `}
                      >
                        <span className="font-bold">{std.time}</span>
                        {isAchieved && (
                          <Zap size={10} className="absolute -top-1 -right-1 text-yellow-300 fill-yellow-300" />
                        )}
                      </div>
                    </td>
                  );
                })}

                {/* Time to Next Cut */}
                <td className="px-4 py-3 text-right">
                  {row.nextCutDiff !== null ? (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.nextCutDiff < 1 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : row.nextCutDiff < 3 
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                    }`}>
                      {row.nextCutDiff < 1 && <Zap size={10} className="text-emerald-400" />}
                      -{row.nextCutDiff.toFixed(2)}s
                    </div>
                  ) : (
                    <span className="text-emerald-400 text-xs font-bold">MAX</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show More / Less */}
      {sortedData.length > 5 && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center">
          <button
            onClick={() => setShowAllEvents(!showAllEvents)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all"
          >
            {showAllEvents ? (
              <>
                <ChevronUp size={16} />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show All {sortedData.length} Events
              </>
            )}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/50 flex flex-wrap gap-3 items-center justify-center">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-2">Legend:</span>
        {STANDARD_COLS.map(col => (
          <div key={col.key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${col.achieved}`} />
            <span className="text-[10px] text-slate-400">{col.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-700">
          <Zap size={10} className="text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] text-slate-400">Achieved</span>
        </div>
      </div>
    </div>
  );
}
